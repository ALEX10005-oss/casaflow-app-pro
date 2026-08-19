CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'SUPER_ADMIN',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin reads own record"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'ACTIVE');

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid() AND status = 'ACTIVE'
  )
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_admins_updated_at
BEFORE UPDATE ON public.platform_admins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lectura de plataforma: organizaciones (solo admins de plataforma)
CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS SETOF public.organizations
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.organizations ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_organizations() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT jsonb_build_object(
    'organizations', (SELECT count(*) FROM public.organizations),
    'licenses_active', (SELECT count(*) FROM public.organizations WHERE license_status = 'active'),
    'licenses_suspended', (SELECT count(*) FROM public.organizations WHERE license_status = 'suspended'),
    'users', (SELECT count(*) FROM public.profiles),
    'properties', (SELECT count(*) FROM public.properties)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_list_users()
RETURNS TABLE (id uuid, email text, first_name text, last_name text, org_id uuid, org_name text, access_status text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.first_name, p.last_name, p.org_id, o.name, p.access_status, p.created_at
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.id = p.org_id
    ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_users() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_update_license(
  _org_id uuid,
  _license_status text DEFAULT NULL,
  _license_type text DEFAULT NULL,
  _max_properties integer DEFAULT NULL,
  _max_users integer DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated public.organizations;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _license_status IS NOT NULL AND _license_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'invalid_license_status';
  END IF;
  UPDATE public.organizations SET
    license_status = COALESCE(_license_status, license_status),
    license_type = COALESCE(_license_type, license_type),
    max_properties = COALESCE(_max_properties, max_properties),
    max_users = COALESCE(_max_users, max_users)
  WHERE id = _org_id
  RETURNING * INTO updated;
  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'organization_not_found';
  END IF;
  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_update_license(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_update_license(uuid, text, text, integer, integer) TO authenticated, service_role;