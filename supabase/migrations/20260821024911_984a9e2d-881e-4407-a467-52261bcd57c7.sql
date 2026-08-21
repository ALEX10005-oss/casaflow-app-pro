
-- 1) Guard trigger: only controlled SECURITY DEFINER flows may change org_id / access_status
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('casaflow.allow_profile_admin', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    NEW.org_id := OLD.org_id;
  END IF;
  IF NEW.access_status IS DISTINCT FROM OLD.access_status THEN
    NEW.access_status := OLD.access_status;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile_id_immutable';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_profiles_sensitive ON public.profiles;
CREATE TRIGGER guard_profiles_sensitive
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- 2) Replace the over-broad FOR ALL self policy with SELECT + UPDATE only
DROP POLICY IF EXISTS "own profile" ON public.profiles;

CREATE POLICY "own profile read" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "own profile update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3) Allow the legitimate flows to bypass the guard
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inv public.invitations%ROWTYPE; uid uuid := auth.uid(); uemail text;
        _seats int; _max int; _current_org uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('casaflow.allow_profile_admin', 'on', true);
  SELECT lower(email) INTO uemail FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.invitations
   WHERE token_hash = encode(extensions.digest(coalesce(_token,''),'sha256'),'hex') FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid_invitation'; END IF;
  IF inv.status = 'revoked' THEN RAISE EXCEPTION 'revoked_invitation'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() AND inv.status <> 'accepted' THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'expired_invitation';
  END IF;
  IF lower(inv.email) <> uemail THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  IF inv.status = 'accepted' AND inv.accepted_by IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'already_used'; END IF;

  SELECT org_id INTO _current_org FROM public.profiles WHERE id = uid;
  IF _current_org IS NOT NULL AND _current_org <> inv.org_id THEN
    RAISE EXCEPTION 'account_already_belongs_to_another_org';
  END IF;

  SELECT max_users INTO _max FROM public.organizations WHERE id = inv.org_id;
  SELECT count(*) INTO _seats FROM public.profiles WHERE org_id = inv.org_id AND id <> uid;
  IF _seats >= _max THEN RAISE EXCEPTION 'max_users_reached'; END IF;

  INSERT INTO public.profiles (id, org_id, first_name, email, access_status)
  VALUES (uid, inv.org_id, inv.full_name, uemail, 'active')
  ON CONFLICT (id) DO UPDATE SET org_id = inv.org_id,
    first_name = COALESCE(public.profiles.first_name, inv.full_name),
    email = COALESCE(public.profiles.email, uemail),
    access_status = 'active';

  DELETE FROM public.user_roles WHERE user_id = uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, inv.role) ON CONFLICT DO NOTHING;

  DELETE FROM public.member_property_access WHERE user_id = uid;
  INSERT INTO public.member_property_access (org_id, user_id, property_id)
  SELECT inv.org_id, uid, x FROM unnest(COALESCE(inv.property_ids,'{}')) x
  ON CONFLICT DO NOTHING;

  UPDATE public.invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = uid, token_hash = NULL
   WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'role', inv.role, 'org_id', inv.org_id,
                            'org_name', (SELECT name FROM public.organizations WHERE id = inv.org_id));
END; $function$;

CREATE OR REPLACE FUNCTION public.org_set_member_status(_user_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
  IF public.role_of(_user_id) = 'owner' THEN RAISE EXCEPTION 'cannot_change_owner'; END IF;
  PERFORM set_config('casaflow.allow_profile_admin', 'on', true);
  UPDATE public.profiles SET access_status = _status
   WHERE id = _user_id AND org_id = public.current_org_id();
END; $function$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;
