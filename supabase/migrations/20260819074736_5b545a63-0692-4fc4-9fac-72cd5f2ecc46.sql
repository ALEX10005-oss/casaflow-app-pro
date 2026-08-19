
CREATE TABLE public.platform_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_recipient text,
  notify_critical boolean NOT NULL DEFAULT true,
  notify_warning boolean NOT NULL DEFAULT false,
  warning_repeat_threshold integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_notification_settings TO authenticated;
GRANT ALL ON public.platform_notification_settings TO service_role;
ALTER TABLE public.platform_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin own settings"
  ON public.platform_notification_settings FOR ALL TO authenticated
  USING (public.is_platform_admin() AND platform_admin_user_id = auth.uid())
  WITH CHECK (public.is_platform_admin() AND platform_admin_user_id = auth.uid());

CREATE TRIGGER platform_notification_settings_updated_at
  BEFORE UPDATE ON public.platform_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.platform_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.system_incidents(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  severity text,
  recipient text,
  status text NOT NULL,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_notification_deliveries_incident_idx
  ON public.platform_notification_deliveries (incident_id, status, sent_at DESC);

GRANT SELECT ON public.platform_notification_deliveries TO authenticated;
GRANT ALL ON public.platform_notification_deliveries TO service_role;
ALTER TABLE public.platform_notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin own deliveries"
  ON public.platform_notification_deliveries FOR SELECT TO authenticated
  USING (public.is_platform_admin() AND platform_admin_user_id = auth.uid());

-- Devuelve los avisos de WhatsApp pendientes aplicando reglas anti-spam.
CREATE OR REPLACE FUNCTION public.platform_pending_whatsapp_alerts()
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
  SELECT i.id, s.platform_admin_user_id, s.whatsapp_recipient, i.severity, i.title,
         i.description, i.recommended_action, i.detected_at,
         COALESCE(o.name, 'Global')
    FROM public.system_incidents i
    CROSS JOIN public.platform_notification_settings s
    LEFT JOIN public.organizations o ON o.id = i.org_id
    LEFT JOIN public.system_health_checks c ON c.check_key = i.check_key
   WHERE i.status <> 'resolved'
     AND s.whatsapp_enabled
     AND s.whatsapp_recipient IS NOT NULL
     AND length(trim(s.whatsapp_recipient)) > 5
     AND (
       (i.severity = 'critical' AND s.notify_critical)
       OR (i.severity = 'warning' AND s.notify_warning
           AND COALESCE(c.consecutive_failures, 0) >= s.warning_repeat_threshold)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.platform_notification_deliveries d
        WHERE d.incident_id = i.id
          AND d.channel = 'whatsapp'
          AND d.status = 'sent'
          AND d.severity = i.severity
          AND d.platform_admin_user_id = s.platform_admin_user_id
          AND d.sent_at >= i.detected_at
     );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_pending_whatsapp_alerts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_pending_whatsapp_alerts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_record_whatsapp_delivery(
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
  VALUES (_platform_admin_user_id, _incident_id, 'whatsapp', _severity,
          left(coalesce(_recipient,''), 32), _status, _provider_message_id,
          left(_error_message, 300),
          CASE WHEN _status = 'sent' THEN now() END)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_record_whatsapp_delivery(uuid,uuid,text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_record_whatsapp_delivery(uuid,uuid,text,text,text,text,text) TO authenticated, service_role;
