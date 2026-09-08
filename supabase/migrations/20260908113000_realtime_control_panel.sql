-- Panel maestro: licencias auditables, datos en vivo y diagnóstico continuo.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS license_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.organizations
SET license_activated_at = COALESCE(license_activated_at, created_at)
WHERE license_status = 'active';

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_license_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_license_status_check
  CHECK (license_status IN ('pending', 'active', 'suspended', 'revoked'));

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.platform_license_overview()
RETURNS TABLE (
  id uuid, name text, license_type text, license_status text,
  max_properties integer, max_users integer,
  properties_used bigint, users_used bigint, reservations_total bigint,
  activated_at timestamptz, expires_at timestamptz,
  updated_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.license_type, o.license_status,
         o.max_properties, o.max_users,
         (SELECT count(*) FROM public.properties p WHERE p.org_id = o.id),
         (SELECT count(*) FROM public.profiles pr WHERE pr.org_id = o.id),
         (SELECT count(*) FROM public.reservations r WHERE r.org_id = o.id),
         o.license_activated_at, o.license_expires_at, o.updated_at, o.created_at
    FROM public.organizations o
   ORDER BY o.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_license_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_license_overview() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.platform_update_license(uuid, text, text, integer, integer);
CREATE FUNCTION public.platform_update_license(
  _org_id uuid,
  _license_status text DEFAULT NULL,
  _license_type text DEFAULT NULL,
  _max_properties integer DEFAULT NULL,
  _max_users integer DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated public.organizations;
  property_count integer;
  user_count integer;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _license_status IS NOT NULL AND _license_status NOT IN ('pending','active','suspended','revoked') THEN
    RAISE EXCEPTION 'invalid_license_status';
  END IF;
  IF _license_type IS NOT NULL AND length(trim(_license_type)) = 0 THEN
    RAISE EXCEPTION 'invalid_license_type';
  END IF;

  SELECT count(*) INTO property_count FROM public.properties WHERE org_id = _org_id;
  SELECT count(*) INTO user_count FROM public.profiles WHERE org_id = _org_id;
  IF _max_properties IS NOT NULL AND _max_properties < property_count THEN
    RAISE EXCEPTION 'property_limit_below_current_usage';
  END IF;
  IF _max_users IS NOT NULL AND _max_users < user_count THEN
    RAISE EXCEPTION 'user_limit_below_current_usage';
  END IF;

  UPDATE public.organizations SET
    license_status = COALESCE(_license_status, license_status),
    license_type = COALESCE(NULLIF(trim(_license_type), ''), license_type),
    max_properties = COALESCE(_max_properties, max_properties),
    max_users = COALESCE(_max_users, max_users),
    license_expires_at = _expires_at,
    license_activated_at = CASE
      WHEN _license_status = 'active' AND license_status <> 'active' THEN now()
      ELSE license_activated_at
    END
  WHERE organizations.id = _org_id
  RETURNING * INTO updated;
  IF updated.id IS NULL THEN RAISE EXCEPTION 'organization_not_found'; END IF;
  RETURN updated;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_update_license(uuid, text, text, integer, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_update_license(uuid, text, text, integer, integer, timestamptz) TO authenticated, service_role;

-- Realtime is a signal; the client refetches authoritative data after every event.
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_health_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_notifications;

-- A one-minute independent database heartbeat keeps working with the web panel closed.
SELECT cron.unschedule('casaflow-health-check');
SELECT cron.schedule('casaflow-health-check', '* * * * *',
  $$SELECT public.run_platform_health_check();$$);

SELECT public.run_platform_health_check();
