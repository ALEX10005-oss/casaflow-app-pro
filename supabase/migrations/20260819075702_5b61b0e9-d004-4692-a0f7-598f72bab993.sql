
ALTER TABLE public.platform_notification_settings RENAME COLUMN whatsapp_enabled TO email_enabled;
ALTER TABLE public.platform_notification_settings RENAME COLUMN whatsapp_recipient TO email_recipient;
ALTER TABLE public.platform_notification_deliveries ALTER COLUMN channel SET DEFAULT 'email';

DROP FUNCTION IF EXISTS public.platform_pending_whatsapp_alerts();
DROP FUNCTION IF EXISTS public.platform_record_whatsapp_delivery(uuid,uuid,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.platform_pending_email_alerts()
RETURNS TABLE(
  incident_id uuid,
  platform_admin_user_id uuid,
  recipient text,
  severity text,
  title text,
  description text,
  recommended_action text,
  detected_at timestamptz,
  org_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin()
     AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
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
        WHERE d.incident_id = i.id
          AND d.channel = 'email'
          AND d.status = 'sent'
          AND d.severity = i.severity
          AND d.platform_admin_user_id = s.platform_admin_user_id
          AND d.sent_at >= i.detected_at
     );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_pending_email_alerts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_pending_email_alerts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_record_email_delivery(
  _platform_admin_user_id uuid,
  _incident_id uuid,
  _severity text,
  _recipient text,
  _status text,
  _provider_message_id text DEFAULT NULL,
  _error_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.is_platform_admin()
     AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
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
$$;

REVOKE ALL ON FUNCTION public.platform_record_email_delivery(uuid,uuid,text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_record_email_delivery(uuid,uuid,text,text,text,text,text) TO authenticated, service_role;

INSERT INTO public.platform_notification_settings (platform_admin_user_id, email_enabled, email_recipient)
SELECT pa.user_id, true, 'alexivang13@gmail.com'
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
 WHERE u.email = 'alexivang13@gmail.com'
ON CONFLICT (platform_admin_user_id) DO UPDATE
  SET email_recipient = COALESCE(public.platform_notification_settings.email_recipient, 'alexivang13@gmail.com');
