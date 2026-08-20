-- ============ 1. QA CLEANUP (solo organizaciones/usuarios temporales de prueba) ============
DO $$
DECLARE qa_orgs uuid[]; qa_users uuid[];
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO qa_orgs FROM public.organizations WHERE name LIKE 'QA TEMP%';
  SELECT coalesce(array_agg(id), '{}') INTO qa_users FROM public.profiles WHERE email LIKE '%@qatemp.casaflow.test';

  DELETE FROM public.transactions WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.whatsapp_messages WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.whatsapp_automations WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.whatsapp_templates WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.cleaning_tasks WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.maintenance_issues WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.alerts WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.property_blocks WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.reservations WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.guests WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.integrations WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.team_members WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.invitations WHERE org_id = ANY(qa_orgs)
     OR email LIKE '%@qatemp.casaflow.test';
  DELETE FROM public.member_property_access WHERE org_id = ANY(qa_orgs) OR user_id = ANY(qa_users);
  DELETE FROM public.properties WHERE org_id = ANY(qa_orgs);
  DELETE FROM public.user_roles WHERE user_id = ANY(qa_users);
  DELETE FROM public.profiles WHERE id = ANY(qa_users);
  DELETE FROM public.organizations WHERE id = ANY(qa_orgs);
END $$;

-- ============ 2. iCal: enlace de exportación por propiedad ============
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS ical_token uuid NOT NULL DEFAULT gen_random_uuid();

-- ============ 3. Calendarios iCal por propiedad y canal ============
CREATE TABLE IF NOT EXISTS public.property_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('Airbnb','Booking','VRBO','Otro')),
  ical_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','error','disabled')),
  last_sync timestamptz,
  last_error text,
  events_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_calendars TO authenticated;
GRANT ALL ON public.property_calendars TO service_role;
ALTER TABLE public.property_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage property calendars" ON public.property_calendars
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

CREATE TRIGGER property_calendars_updated_at BEFORE UPDATE ON public.property_calendars
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. Eventos externos importados ============
CREATE TABLE IF NOT EXISTS public.external_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES public.property_calendars(id) ON DELETE CASCADE,
  channel text NOT NULL,
  external_uid text NOT NULL,
  summary text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, external_uid)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_calendar_events TO authenticated;
GRANT ALL ON public.external_calendar_events TO service_role;
ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read external events" ON public.external_calendar_events
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_access_property(property_id));

CREATE POLICY "admins write external events" ON public.external_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "admins update external events" ON public.external_calendar_events
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "admins delete external events" ON public.external_calendar_events
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

CREATE TRIGGER external_calendar_events_updated_at BEFORE UPDATE ON public.external_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS external_events_property_dates
  ON public.external_calendar_events (property_id, start_date, end_date);

-- ============ 5. Disponibilidad ============
CREATE OR REPLACE FUNCTION public.property_is_available(
  _property_id uuid, _check_in date, _check_out date, _exclude_reservation uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT (
    EXISTS (SELECT 1 FROM public.reservations r
             WHERE r.property_id = _property_id
               AND (_exclude_reservation IS NULL OR r.id <> _exclude_reservation)
               AND r.status NOT IN ('cancelada','cancelled','no_show')
               AND r.check_in < _check_out AND r.check_out > _check_in)
    OR EXISTS (SELECT 1 FROM public.external_calendar_events e
                WHERE e.property_id = _property_id AND e.status = 'active'
                  AND e.start_date < _check_out AND e.end_date > _check_in)
    OR EXISTS (SELECT 1 FROM public.property_blocks b
                WHERE b.property_id = _property_id
                  AND b.start_date < _check_out AND b.end_date > _check_in)
  )
$$;

-- ============ 6. Crear reserva directa con validación ============
CREATE OR REPLACE FUNCTION public.create_direct_reservation(
  _property_id uuid,
  _check_in date,
  _check_out date,
  _guest_id uuid DEFAULT NULL,
  _guest_name text DEFAULT NULL,
  _guest_email text DEFAULT NULL,
  _guest_phone text DEFAULT NULL,
  _channel text DEFAULT 'Web Directa',
  _status text DEFAULT 'confirmada',
  _payment_status text DEFAULT 'pendiente',
  _total_amount numeric DEFAULT 0,
  _guests_count integer DEFAULT 1,
  _notes text DEFAULT NULL
) RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id(); _g uuid := _guest_id; _row public.reservations; _code text;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.is_org_admin()
          OR (public.my_role() = 'reception' AND public.can_access_property(_property_id))) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = _property_id AND org_id = _org) THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;
  IF _check_out <= _check_in THEN RAISE EXCEPTION 'invalid_dates'; END IF;
  IF NOT public.property_is_available(_property_id, _check_in, _check_out, NULL) THEN
    RAISE EXCEPTION 'property_not_available';
  END IF;

  IF _g IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.guests WHERE id = _g AND org_id = _org) THEN
      RAISE EXCEPTION 'invalid_guest';
    END IF;
  ELSIF nullif(trim(coalesce(_guest_name,'')),'') IS NOT NULL THEN
    SELECT id INTO _g FROM public.guests
     WHERE org_id = _org
       AND ( (nullif(trim(coalesce(_guest_email,'')),'') IS NOT NULL AND lower(email) = lower(trim(_guest_email)))
          OR (nullif(trim(coalesce(_guest_phone,'')),'') IS NOT NULL AND phone = trim(_guest_phone))
          OR lower(full_name) = lower(trim(_guest_name)) )
     LIMIT 1;
    IF _g IS NULL THEN
      INSERT INTO public.guests (org_id, full_name, email, phone)
      VALUES (_org, trim(_guest_name), nullif(trim(coalesce(_guest_email,'')),''), nullif(trim(coalesce(_guest_phone,'')),''))
      RETURNING id INTO _g;
    END IF;
  END IF;

  _code := 'CF-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  INSERT INTO public.reservations (org_id, code, property_id, guest_id, channel, check_in, check_out,
                                   status, payment_status, total_amount, commission, guests_count, notes)
  VALUES (_org, _code, _property_id, _g, coalesce(nullif(trim(_channel),''),'Web Directa'), _check_in, _check_out,
          coalesce(nullif(trim(_status),''),'confirmada'), coalesce(nullif(trim(_payment_status),''),'pendiente'),
          coalesce(_total_amount,0), 0, greatest(coalesce(_guests_count,1),1), nullif(trim(coalesce(_notes,'')),''))
  RETURNING * INTO _row;

  RETURN _row;
END; $$;