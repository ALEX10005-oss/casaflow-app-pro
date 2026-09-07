-- Cambios aditivos para los seis ajustes pendientes de CasaFlow.
-- No elimina ni sobrescribe datos existentes.

ALTER TABLE public.maintenance_issues
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time text;

CREATE OR REPLACE FUNCTION public.schedule_cleaning_task(
  _property_id uuid,
  _scheduled_date date,
  _scheduled_time text DEFAULT NULL,
  _assignee_user_id uuid DEFAULT NULL,
  _priority text DEFAULT 'normal'
) RETURNS public.cleaning_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid := public.current_org_id();
  _row public.cleaning_tasks;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _scheduled_date IS NULL THEN RAISE EXCEPTION 'date_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=_property_id AND org_id=_org) THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  INSERT INTO public.cleaning_tasks (
    org_id, property_id, reservation_id, scheduled_date, checkout_time,
    next_checkin_time, assignee, assignee_user_id, priority, status
  ) VALUES (
    _org, _property_id, NULL, _scheduled_date, nullif(trim(coalesce(_scheduled_time,'')),''),
    NULL, NULL, _assignee_user_id, coalesce(nullif(trim(coalesce(_priority,'')),''),'normal'), 'pendiente'
  ) RETURNING * INTO _row;
  RETURN _row;
END; $$;

REVOKE ALL ON FUNCTION public.schedule_cleaning_task(uuid,date,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_cleaning_task(uuid,date,text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.schedule_maintenance_issue(
  _property_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _scheduled_date date DEFAULT NULL,
  _scheduled_time text DEFAULT NULL,
  _assignee_user_id uuid DEFAULT NULL,
  _priority text DEFAULT 'media',
  _blocks_guests boolean DEFAULT false
) RETURNS public.maintenance_issues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid := public.current_org_id();
  _row public.maintenance_issues;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF nullif(trim(coalesce(_title,'')),'') IS NULL THEN RAISE EXCEPTION 'title_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=_property_id AND org_id=_org) THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  INSERT INTO public.maintenance_issues (
    org_id, property_id, title, description, assignee, assignee_user_id,
    priority, status, blocks_guests, reported_on, created_by, scheduled_date, scheduled_time
  ) VALUES (
    _org, _property_id, trim(_title), nullif(trim(coalesce(_description,'')),''),
    NULL, _assignee_user_id, coalesce(nullif(trim(coalesce(_priority,'')),''),'media'),
    'nueva', coalesce(_blocks_guests,false), current_date, auth.uid(), _scheduled_date,
    nullif(trim(coalesce(_scheduled_time,'')),'')
  ) RETURNING * INTO _row;
  RETURN _row;
END; $$;

REVOKE ALL ON FUNCTION public.schedule_maintenance_issue(uuid,text,text,date,text,uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_maintenance_issue(uuid,text,text,date,text,uuid,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.resize_reservation_checkout(
  _id uuid,
  _check_out date
) RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid := public.current_org_id();
  _r public.reservations;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT * INTO _r FROM public.reservations WHERE id=_id AND org_id=_org FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'reservation_not_found'; END IF;
  IF _check_out IS NULL OR _check_out <= _r.check_in THEN RAISE EXCEPTION 'invalid_dates'; END IF;
  IF NOT public.property_is_available(_r.property_id, _r.check_in, _check_out, _r.id) THEN
    RAISE EXCEPTION 'property_not_available';
  END IF;

  UPDATE public.reservations SET check_out=_check_out WHERE id=_r.id RETURNING * INTO _r;
  RETURN _r;
END; $$;

REVOKE ALL ON FUNCTION public.resize_reservation_checkout(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resize_reservation_checkout(uuid,date) TO authenticated;
