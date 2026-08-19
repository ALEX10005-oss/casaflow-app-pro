-- ============ TABLES ============
CREATE TABLE public.system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL UNIQUE,
  check_name text NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  severity text NOT NULL DEFAULT 'info',
  org_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  first_failed_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_health_checks TO authenticated;
GRANT ALL ON public.system_health_checks TO service_role;
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read health checks" ON public.system_health_checks
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE TABLE public.system_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'health_check',
  check_key text NOT NULL,
  org_id uuid,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text,
  recommended_action text,
  status text NOT NULL DEFAULT 'open',
  fingerprint text NOT NULL UNIQUE,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_incidents TO authenticated;
GRANT ALL ON public.system_incidents TO service_role;
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read incidents" ON public.system_incidents
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE TABLE public.platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_user_id uuid NOT NULL,
  incident_id uuid REFERENCES public.system_incidents(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'incident',
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_notifications_unique_incident
  ON public.platform_notifications (platform_admin_user_id, incident_id, type)
  WHERE incident_id IS NOT NULL;
GRANT SELECT ON public.platform_notifications TO authenticated;
GRANT ALL ON public.platform_notifications TO service_role;
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read own notifications" ON public.platform_notifications
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() AND platform_admin_user_id = auth.uid());

CREATE TRIGGER system_health_checks_updated_at BEFORE UPDATE ON public.system_health_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER system_incidents_updated_at BEFORE UPDATE ON public.system_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INTERNAL HELPER ============
CREATE OR REPLACE FUNCTION public.record_health_check(
  _key text, _name text, _status text, _severity text, _details jsonb,
  _org_id uuid, _title text, _description text, _action text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _fp text := _key || ':' || coalesce(_org_id::text, 'global');
  _inc public.system_incidents%ROWTYPE;
  _failing boolean := _status <> 'healthy';
  _is_new boolean := false;
BEGIN
  INSERT INTO public.system_health_checks AS c
    (check_key, check_name, status, severity, org_id, details, last_checked_at,
     first_failed_at, consecutive_failures)
  VALUES (_key, _name, _status, _severity, _org_id, _details, now(),
          CASE WHEN _failing THEN now() END, CASE WHEN _failing THEN 1 ELSE 0 END)
  ON CONFLICT (check_key) DO UPDATE SET
    check_name = EXCLUDED.check_name,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    org_id = EXCLUDED.org_id,
    details = EXCLUDED.details,
    last_checked_at = now(),
    first_failed_at = CASE WHEN _failing THEN coalesce(c.first_failed_at, now()) ELSE NULL END,
    consecutive_failures = CASE WHEN _failing THEN c.consecutive_failures + 1 ELSE 0 END;

  SELECT * INTO _inc FROM public.system_incidents WHERE fingerprint = _fp;

  IF _failing THEN
    IF _inc.id IS NULL THEN
      INSERT INTO public.system_incidents
        (source, check_key, org_id, severity, title, description, recommended_action, fingerprint, metadata)
      VALUES ('health_check', _key, _org_id, _severity, _title, _description, _action, _fp, _details)
      RETURNING * INTO _inc;
      _is_new := true;
    ELSE
      UPDATE public.system_incidents SET
        severity = _severity,
        title = _title,
        description = _description,
        recommended_action = _action,
        metadata = _details,
        status = CASE WHEN _inc.status = 'resolved' THEN 'open' ELSE _inc.status END,
        detected_at = CASE WHEN _inc.status = 'resolved' THEN now() ELSE _inc.detected_at END,
        resolved_at = NULL
      WHERE id = _inc.id;
      _is_new := _inc.status = 'resolved';
    END IF;

    IF _is_new THEN
      INSERT INTO public.platform_notifications (platform_admin_user_id, incident_id, type, title, body)
      SELECT pa.user_id, _inc.id, 'incident',
             CASE WHEN _severity = 'critical' THEN 'Incidente crítico: ' ELSE 'Aviso: ' END || _title,
             _description
      FROM public.platform_admins pa
      WHERE pa.status = 'ACTIVE'
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF _inc.id IS NOT NULL AND _inc.status <> 'resolved' THEN
    UPDATE public.system_incidents
      SET status = 'resolved', resolved_at = now()
      WHERE id = _inc.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_health_check(text,text,text,text,jsonb,uuid,text,text,text) FROM PUBLIC, anon, authenticated;

-- ============ MAIN DIAGNOSTIC ============
CREATE OR REPLACE FUNCTION public.run_platform_health_check()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
  n2 integer;
  tbl text;
  global text;
  crit int; warn int; ok int;
BEGIN
  IF NOT public.is_platform_admin() AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- 1. connectivity
  PERFORM 1;
  PERFORM public.record_health_check('db_connectivity','Conectividad de base de datos','healthy','info',
    jsonb_build_object('checked_at', now()), NULL, 'Base de datos accesible', NULL, NULL);

  -- 2. critical tables readable
  BEGIN
    FOREACH tbl IN ARRAY ARRAY['organizations','profiles','properties','reservations','invitations','user_roles'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I', tbl) INTO n;
    END LOOP;
    PERFORM public.record_health_check('critical_tables','Lectura de tablas críticas','healthy','info',
      jsonb_build_object('tables', 6), NULL, 'Tablas críticas legibles', NULL, NULL);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.record_health_check('critical_tables','Lectura de tablas críticas','critical','critical',
      jsonb_build_object('error', SQLERRM), NULL, 'No se pueden leer tablas críticas', SQLERRM,
      'Revisar el esquema y los permisos de las tablas afectadas.');
  END;

  -- 3a. invalid license status
  SELECT count(*) INTO n FROM public.organizations WHERE license_status NOT IN ('active','suspended');
  PERFORM public.record_health_check('license_status_invalid','Licencias con estado inválido',
    CASE WHEN n > 0 THEN 'critical' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('count', n), NULL,
    'Organizaciones con estado de licencia inválido',
    n || ' organización(es) tienen un license_status fuera de active/suspended.',
    'Corregir el estado de licencia desde /control/licencias.');

  -- 3b. suspended orgs
  SELECT count(*) INTO n FROM public.organizations WHERE license_status = 'suspended';
  PERFORM public.record_health_check('license_suspended','Licencias suspendidas',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Hay licencias suspendidas',
    n || ' organización(es) con licencia suspendida; sus usuarios pueden reportar bloqueos.',
    'Confirmar si la suspensión es intencional en /control/licencias.');

  -- 4. profiles without org
  SELECT count(*) INTO n FROM public.profiles p
   WHERE p.org_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = p.id AND a.status='ACTIVE');
  PERFORM public.record_health_check('profiles_without_org','Perfiles sin organización',
    CASE WHEN n > 0 THEN 'critical' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Perfiles sin organización asignada',
    n || ' perfil(es) sin org_id no podrán ver ningún dato de la aplicación.',
    'Reasignar la organización correcta o revisar el alta por invitación.');

  -- 5. users without roles
  SELECT count(*) INTO n FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = p.id AND a.status='ACTIVE');
  PERFORM public.record_health_check('users_without_roles','Usuarios sin rol',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Usuarios sin rol asignado',
    n || ' usuario(s) no tienen ningún rol; el menú puede aparecer vacío.',
    'Asignar rol desde Equipo o revisar el trigger de alta.');

  -- 6. stale invitations
  SELECT count(*) INTO n FROM public.invitations
   WHERE status = 'pending' AND created_at < now() - interval '72 hours';
  PERFORM public.record_health_check('stale_invitations','Invitaciones pendientes antiguas',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Invitaciones sin aceptar hace más de 72 h',
    n || ' invitación(es) llevan más de 72 horas pendientes.',
    'Reenviar la invitación o verificar la entrega de correo.');

  -- 7. reservations integrity
  SELECT count(*) INTO n FROM public.reservations r
   WHERE NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = r.property_id);
  SELECT count(*) INTO n2 FROM public.reservations WHERE check_out <= check_in;
  PERFORM public.record_health_check('reservations_integrity','Integridad de reservas',
    CASE WHEN n + n2 > 0 THEN 'critical' ELSE 'healthy' END,
    CASE WHEN n + n2 > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('orphans', n, 'invalid_dates', n2), NULL, 'Reservas inconsistentes',
    n || ' reserva(s) sin propiedad y ' || n2 || ' con fechas inválidas.',
    'Corregir o eliminar las reservas afectadas antes de que el cliente lo note.');

  -- 8. integrations
  SELECT count(*) INTO n FROM public.integrations WHERE status = 'error';
  SELECT count(*) INTO n2 FROM public.integrations
   WHERE status = 'connected' AND last_sync IS NOT NULL AND last_sync < now() - interval '24 hours';
  PERFORM public.record_health_check('integrations_status','Integraciones de canales',
    CASE WHEN n > 0 THEN 'critical' WHEN n2 > 0 THEN 'warning' ELSE 'healthy' END,
    CASE WHEN n > 0 THEN 'critical' WHEN n2 > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('errors', n, 'stale_sync', n2), NULL, 'Integraciones con problemas',
    n || ' integración(es) en error y ' || n2 || ' sin sincronizar hace más de 24 h.',
    'Reconectar el canal afectado desde Integraciones.');

  -- 9. whatsapp failures
  SELECT count(*) INTO n FROM public.whatsapp_messages
   WHERE status = 'fallido' AND sent_at > now() - interval '24 hours';
  PERFORM public.record_health_check('whatsapp_failures','Mensajes de WhatsApp fallidos',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Mensajes de WhatsApp fallidos en 24 h',
    n || ' mensaje(s) no se entregaron en las últimas 24 horas.',
    'Revisar plantillas y el estado de la integración de mensajería.');

  -- 10. maintenance conflicts
  SELECT count(*) INTO n FROM public.properties p
   WHERE p.status = 'maintenance'
     AND EXISTS (SELECT 1 FROM public.reservations r
                  WHERE r.property_id = p.id AND r.status IN ('confirmada','en_curso')
                    AND r.check_in <= CURRENT_DATE AND r.check_out > CURRENT_DATE);
  PERFORM public.record_health_check('maintenance_conflicts','Propiedades en mantenimiento con huéspedes',
    CASE WHEN n > 0 THEN 'critical' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Mantenimiento con estancia activa',
    n || ' propiedad(es) en mantenimiento tienen una estancia en curso.',
    'Reubicar la reserva o cambiar el estado de la propiedad.');

  -- 11. cross-org consistency
  SELECT (SELECT count(*) FROM public.reservations r JOIN public.properties p ON p.id = r.property_id
           WHERE p.org_id <> r.org_id)
       + (SELECT count(*) FROM public.cleaning_tasks c JOIN public.properties p ON p.id = c.property_id
           WHERE p.org_id <> c.org_id)
       + (SELECT count(*) FROM public.maintenance_issues m JOIN public.properties p ON p.id = m.property_id
           WHERE p.org_id <> m.org_id)
    INTO n;
  PERFORM public.record_health_check('org_consistency','Consistencia entre organizaciones',
    CASE WHEN n > 0 THEN 'critical' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('mismatches', n), NULL, 'Registros con organización cruzada',
    n || ' registro(s) relacionados apuntan a una organización distinta a la de su propiedad.',
    'Corregir el org_id de los registros afectados; puede implicar fuga de datos entre empresas.');

  SELECT count(*) FILTER (WHERE status='critical'), count(*) FILTER (WHERE status='warning'),
         count(*) FILTER (WHERE status='healthy')
    INTO crit, warn, ok FROM public.system_health_checks;

  global := CASE WHEN crit > 0 THEN 'CRITICAL' WHEN warn > 0 THEN 'WARNING' ELSE 'HEALTHY' END;

  RETURN jsonb_build_object('global_status', global, 'critical', crit, 'warning', warn,
    'healthy', ok, 'checked_at', now(),
    'open_incidents', (SELECT count(*) FROM public.system_incidents WHERE status <> 'resolved'));
END;
$$;
REVOKE ALL ON FUNCTION public.run_platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_platform_health_check() TO authenticated, service_role;

-- ============ READ / ACTION RPCS ============
CREATE OR REPLACE FUNCTION public.platform_health_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE crit int; warn int; ok int; last_at timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT count(*) FILTER (WHERE status='critical'), count(*) FILTER (WHERE status='warning'),
         count(*) FILTER (WHERE status='healthy'), max(last_checked_at)
    INTO crit, warn, ok, last_at FROM public.system_health_checks;
  RETURN jsonb_build_object(
    'global_status', CASE WHEN crit > 0 THEN 'CRITICAL' WHEN warn > 0 THEN 'WARNING'
                          WHEN ok > 0 THEN 'HEALTHY' ELSE 'UNKNOWN' END,
    'critical', coalesce(crit,0), 'warning', coalesce(warn,0), 'healthy', coalesce(ok,0),
    'last_checked_at', last_at,
    'open_incidents', (SELECT count(*) FROM public.system_incidents WHERE status <> 'resolved'),
    'unread_notifications', (SELECT count(*) FROM public.platform_notifications
                              WHERE platform_admin_user_id = auth.uid() AND read_at IS NULL));
END; $$;
REVOKE ALL ON FUNCTION public.platform_health_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_acknowledge_incident(_incident_id uuid)
RETURNS public.system_incidents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.system_incidents;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.system_incidents
     SET status = 'acknowledged', acknowledged_at = now()
   WHERE id = _incident_id AND status = 'open' RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'incident_not_found'; END IF;
  RETURN row;
END; $$;
REVOKE ALL ON FUNCTION public.platform_acknowledge_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_acknowledge_incident(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_mark_notifications_read(_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected int;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.platform_notifications SET read_at = now()
   WHERE platform_admin_user_id = auth.uid() AND read_at IS NULL
     AND (_ids IS NULL OR id = ANY(_ids));
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.platform_mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_mark_notifications_read(uuid[]) TO authenticated;

-- ============ SCHEDULER ============
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('casaflow-health-check', '*/15 * * * *',
  $$SELECT public.run_platform_health_check();$$);

-- initial run
SELECT public.run_platform_health_check();