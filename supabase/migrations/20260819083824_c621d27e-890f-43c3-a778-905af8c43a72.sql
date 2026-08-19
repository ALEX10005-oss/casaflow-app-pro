CREATE OR REPLACE FUNCTION public.run_platform_health_check()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  n integer; n2 integer; tbl text; global text; crit int; warn int; ok int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  PERFORM 1;
  PERFORM public.record_health_check('db_connectivity','Conectividad de base de datos','healthy','info',
    jsonb_build_object('checked_at', now()), NULL, 'Base de datos accesible', NULL, NULL);

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

  SELECT count(*) INTO n FROM public.organizations WHERE license_status NOT IN ('active','suspended');
  PERFORM public.record_health_check('license_status_invalid','Licencias con estado inválido',
    CASE WHEN n > 0 THEN 'critical' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('count', n), NULL,
    'Organizaciones con estado de licencia inválido',
    n || ' organización(es) tienen un license_status fuera de active/suspended.',
    'Corregir el estado de licencia desde /control/licencias.');

  SELECT count(*) INTO n FROM public.organizations WHERE license_status = 'suspended';
  PERFORM public.record_health_check('license_suspended','Licencias suspendidas',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Hay licencias suspendidas',
    n || ' organización(es) con licencia suspendida; sus usuarios pueden reportar bloqueos.',
    'Confirmar si la suspensión es intencional en /control/licencias.');

  SELECT count(*) INTO n FROM public.profiles p
   WHERE p.org_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = p.id AND a.status='ACTIVE');
  PERFORM public.record_health_check('profiles_without_org','Perfiles sin organización',
    CASE WHEN n > 0 THEN 'critical' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Perfiles sin organización asignada',
    n || ' perfil(es) sin org_id no podrán ver ningún dato de la aplicación.',
    'Reasignar la organización correcta o revisar el alta por invitación.');

  SELECT count(*) INTO n FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = p.id AND a.status='ACTIVE');
  PERFORM public.record_health_check('users_without_roles','Usuarios sin rol',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Usuarios sin rol asignado',
    n || ' usuario(s) no tienen ningún rol; el menú puede aparecer vacío.',
    'Asignar rol desde Equipo o revisar el trigger de alta.');

  SELECT count(*) INTO n FROM public.invitations
   WHERE status = 'pending' AND created_at < now() - interval '72 hours';
  PERFORM public.record_health_check('stale_invitations','Invitaciones pendientes antiguas',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Invitaciones sin aceptar hace más de 72 h',
    n || ' invitación(es) llevan más de 72 horas pendientes.',
    'Reenviar la invitación o verificar la entrega de correo.');

  SELECT count(*) INTO n FROM public.reservations r
   WHERE NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = r.property_id);
  SELECT count(*) INTO n2 FROM public.reservations WHERE check_out <= check_in;
  PERFORM public.record_health_check('reservations_integrity','Integridad de reservas',
    CASE WHEN n + n2 > 0 THEN 'critical' ELSE 'healthy' END,
    CASE WHEN n + n2 > 0 THEN 'critical' ELSE 'info' END,
    jsonb_build_object('orphans', n, 'invalid_dates', n2), NULL, 'Reservas inconsistentes',
    n || ' reserva(s) sin propiedad y ' || n2 || ' con fechas inválidas.',
    'Corregir o eliminar las reservas afectadas antes de que el cliente lo note.');

  SELECT count(*) INTO n FROM public.integrations WHERE status = 'error';
  SELECT count(*) INTO n2 FROM public.integrations
   WHERE status = 'connected' AND last_sync IS NOT NULL AND last_sync < now() - interval '24 hours';
  PERFORM public.record_health_check('integrations_status','Integraciones de canales',
    CASE WHEN n > 0 THEN 'critical' WHEN n2 > 0 THEN 'warning' ELSE 'healthy' END,
    CASE WHEN n > 0 THEN 'critical' WHEN n2 > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('errors', n, 'stale_sync', n2), NULL, 'Integraciones con problemas',
    n || ' integración(es) en error y ' || n2 || ' sin sincronizar hace más de 24 h.',
    'Reconectar el canal afectado desde Integraciones.');

  SELECT count(*) INTO n FROM public.whatsapp_messages
   WHERE status = 'fallido' AND sent_at > now() - interval '24 hours';
  PERFORM public.record_health_check('whatsapp_failures','Mensajes de WhatsApp fallidos',
    CASE WHEN n > 0 THEN 'warning' ELSE 'healthy' END, CASE WHEN n > 0 THEN 'warning' ELSE 'info' END,
    jsonb_build_object('count', n), NULL, 'Mensajes de WhatsApp fallidos en 24 h',
    n || ' mensaje(s) no se entregaron en las últimas 24 horas.',
    'Revisar plantillas y el estado de la integración de mensajería.');

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
$function$;

CREATE OR REPLACE FUNCTION public.platform_pending_email_alerts()
 RETURNS TABLE(incident_id uuid, platform_admin_user_id uuid, recipient text, severity text, title text, description text, recommended_action text, detected_at timestamp with time zone, org_name text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT i.id, s.platform_admin_user_id, s.email_recipient, i.severity, i.title,
         i.description, i.recommended_action, i.detected_at,
         COALESCE(o.name, 'Global')
    FROM public.system_incidents i
    CROSS JOIN public.platform_notification_settings s
    LEFT JOIN public.organizations o ON o.id = i.org_id
    LEFT JOIN public.system_health_checks c ON c.check_key = i.check_key
   WHERE i.status <> 'resolved'
     AND s.email_enabled
     AND s.email_recipient IS NOT NULL
     AND position('@' in s.email_recipient) > 1
     AND (
       (i.severity = 'critical' AND s.notify_critical)
       OR (i.severity = 'warning' AND s.notify_warning
           AND COALESCE(c.consecutive_failures, 0) >= s.warning_repeat_threshold)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.platform_notification_deliveries d
        WHERE d.incident_id = i.id AND d.channel = 'email' AND d.status = 'sent'
          AND d.severity = i.severity
          AND d.platform_admin_user_id = s.platform_admin_user_id
          AND d.sent_at >= i.detected_at
     );
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_record_email_delivery(_platform_admin_user_id uuid, _incident_id uuid, _severity text, _recipient text, _status text, _provider_message_id text DEFAULT NULL::text, _error_message text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.platform_notification_deliveries
    (platform_admin_user_id, incident_id, channel, severity, recipient, status,
     provider_message_id, error_message, sent_at)
  VALUES (_platform_admin_user_id, _incident_id, 'email', _severity,
          left(coalesce(_recipient,''), 320), _status, _provider_message_id,
          left(_error_message, 300),
          CASE WHEN _status = 'sent' THEN now() END)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;