
-- ============ 0. extensiones ============
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ 1. helpers de rol ============
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
   ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.my_role() IN ('owner','manager')
$$;

-- ============ 2. asignación miembro <-> propiedad ============
CREATE TABLE IF NOT EXISTS public.member_property_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);
GRANT SELECT ON public.member_property_access TO authenticated;
GRANT ALL ON public.member_property_access TO service_role;
ALTER TABLE public.member_property_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own or org admin" ON public.member_property_access;
CREATE POLICY "read own or org admin" ON public.member_property_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE OR REPLACE FUNCTION public.can_access_property(_p uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.my_role() IN ('owner','manager','accounting')
      THEN EXISTS (SELECT 1 FROM public.properties p WHERE p.id = _p AND p.org_id = public.current_org_id())
    ELSE EXISTS (SELECT 1 FROM public.member_property_access a
                  WHERE a.user_id = auth.uid() AND a.property_id = _p)
  END
$$;

-- ============ 3. invitaciones con token ============
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS property_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_hash_key ON public.invitations(token_hash);

ALTER TABLE public.maintenance_issues ADD COLUMN IF NOT EXISTS created_by uuid;

-- ============ 4. RLS por rol ============
DROP POLICY IF EXISTS "org properties" ON public.properties;
CREATE POLICY "members read allowed properties" ON public.properties FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_access_property(id));
CREATE POLICY "org admins write properties" ON public.properties FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "org admins update properties" ON public.properties FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "org admins delete properties" ON public.properties FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org reservations" ON public.reservations;
CREATE POLICY "read reservations" ON public.reservations FOR SELECT TO authenticated
  USING (org_id = public.current_org_id()
     AND (public.is_org_admin() OR public.my_role() = 'accounting'
          OR (public.my_role() = 'reception' AND public.can_access_property(property_id))));
CREATE POLICY "write reservations" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'));
CREATE POLICY "update reservations" ON public.reservations FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'))
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'));
CREATE POLICY "delete reservations" ON public.reservations FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org guests" ON public.guests;
CREATE POLICY "guests for admin and reception" ON public.guests FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'))
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'));

DROP POLICY IF EXISTS "org cleaning" ON public.cleaning_tasks;
CREATE POLICY "read cleaning" ON public.cleaning_tasks FOR SELECT TO authenticated
  USING (org_id = public.current_org_id()
     AND (public.is_org_admin()
          OR (public.my_role() IN ('cleaning','reception') AND public.can_access_property(property_id))));
CREATE POLICY "insert cleaning" ON public.cleaning_tasks FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "update cleaning" ON public.cleaning_tasks FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id()
     AND (public.is_org_admin() OR (public.my_role() = 'cleaning' AND public.can_access_property(property_id))))
  WITH CHECK (org_id = public.current_org_id()
     AND (public.is_org_admin() OR (public.my_role() = 'cleaning' AND public.can_access_property(property_id))));
CREATE POLICY "delete cleaning" ON public.cleaning_tasks FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org maintenance" ON public.maintenance_issues;
CREATE POLICY "read maintenance" ON public.maintenance_issues FOR SELECT TO authenticated
  USING (org_id = public.current_org_id()
     AND (public.is_org_admin()
          OR (public.my_role() IN ('maintenance','cleaning') AND public.can_access_property(property_id))));
CREATE POLICY "insert maintenance" ON public.maintenance_issues FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id()
     AND (public.is_org_admin()
          OR (public.my_role() IN ('maintenance','cleaning') AND public.can_access_property(property_id))));
CREATE POLICY "update maintenance" ON public.maintenance_issues FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id()
     AND (public.is_org_admin() OR (public.my_role() = 'maintenance' AND public.can_access_property(property_id))))
  WITH CHECK (org_id = public.current_org_id()
     AND (public.is_org_admin() OR (public.my_role() = 'maintenance' AND public.can_access_property(property_id))));
CREATE POLICY "delete maintenance" ON public.maintenance_issues FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org transactions" ON public.transactions;
CREATE POLICY "finance roles transactions" ON public.transactions FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'accounting'))
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'accounting'));

DROP POLICY IF EXISTS "org blocks" ON public.property_blocks;
CREATE POLICY "read blocks" ON public.property_blocks FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_access_property(property_id));
CREATE POLICY "admins manage blocks" ON public.property_blocks FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org alerts" ON public.alerts;
CREATE POLICY "admins alerts" ON public.alerts FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org integrations" ON public.integrations;
CREATE POLICY "admins integrations" ON public.integrations FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org team" ON public.team_members;
CREATE POLICY "admins team" ON public.team_members FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org invitations" ON public.invitations;
CREATE POLICY "admins read invitations" ON public.invitations FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org messages" ON public.whatsapp_messages;
CREATE POLICY "guest messaging" ON public.whatsapp_messages FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'))
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'));

DROP POLICY IF EXISTS "org templates" ON public.whatsapp_templates;
CREATE POLICY "admins templates" ON public.whatsapp_templates FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_org_admin() OR public.my_role() = 'reception'))
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS "org automations" ON public.whatsapp_automations;
CREATE POLICY "admins automations" ON public.whatsapp_automations FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "org admins read member profiles" ON public.profiles FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

-- ============ 5. contexto del usuario ============
CREATE OR REPLACE FUNCTION public.my_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles%ROWTYPE; o public.organizations%ROWTYPE; r app_role;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO o FROM public.organizations WHERE id = p.org_id;
  r := public.my_role();
  RETURN jsonb_build_object(
    'user_id', auth.uid(),
    'role', r,
    'org_id', p.org_id,
    'org_name', o.name,
    'license_status', o.license_status,
    'access_status', COALESCE(p.access_status, 'active'),
    'is_platform_admin', public.is_platform_admin(),
    'property_ids', COALESCE((SELECT jsonb_agg(a.property_id) FROM public.member_property_access a
                               WHERE a.user_id = auth.uid()), '[]'::jsonb));
END; $$;

-- ============ 6. gestión de equipo ============
CREATE OR REPLACE FUNCTION public.org_list_members()
RETURNS TABLE(user_id uuid, first_name text, last_name text, email text, role app_role,
              access_status text, created_at timestamptz, property_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.first_name, p.last_name, p.email, public.role_of(p.id),
           COALESCE(p.access_status,'active'), p.created_at,
           COALESCE(ARRAY(SELECT a.property_id FROM public.member_property_access a WHERE a.user_id = p.id), '{}'::uuid[])
      FROM public.profiles p
     WHERE p.org_id = public.current_org_id()
     ORDER BY p.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.role_of(_uid uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _uid
   ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.org_invite_member(
  _email text, _full_name text, _role app_role, _property_ids uuid[] DEFAULT '{}', _message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _org public.organizations%ROWTYPE; _token text; _hash text; _id uuid;
        _seats int; _pending int; _mail text := lower(trim(_email));
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _role = 'owner' THEN RAISE EXCEPTION 'owner_role_not_invitable'; END IF;
  IF _mail IS NULL OR position('@' in _mail) < 2 THEN RAISE EXCEPTION 'invalid_email'; END IF;

  SELECT * INTO _org FROM public.organizations WHERE id = public.current_org_id();
  IF _org.id IS NULL THEN RAISE EXCEPTION 'organization_not_found'; END IF;
  IF _org.license_status <> 'active' THEN RAISE EXCEPTION 'license_inactive'; END IF;

  SELECT count(*) INTO _seats FROM public.profiles WHERE org_id = _org.id;
  SELECT count(*) INTO _pending FROM public.invitations
   WHERE org_id = _org.id AND status = 'pending' AND lower(email) <> _mail;
  IF _seats + _pending >= _org.max_users THEN RAISE EXCEPTION 'max_users_reached'; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = _mail AND org_id = _org.id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  PERFORM 1 FROM public.properties WHERE org_id = _org.id AND id = ANY(_property_ids);
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(_property_ids,'{}')) x
              WHERE x NOT IN (SELECT id FROM public.properties WHERE org_id = _org.id)) THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  UPDATE public.invitations SET status = 'revoked', revoked_at = now()
   WHERE org_id = _org.id AND lower(email) = _mail AND status = 'pending';

  _token := encode(extensions.gen_random_bytes(24), 'hex');
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  INSERT INTO public.invitations (org_id, email, full_name, role, status, invited_by,
                                  token_hash, expires_at, property_ids, message)
  VALUES (_org.id, _mail, NULLIF(trim(coalesce(_full_name,'')),''), _role, 'pending', auth.uid(),
          _hash, now() + interval '7 days', COALESCE(_property_ids,'{}'), NULLIF(trim(coalesce(_message,'')),''))
  RETURNING id INTO _id;

  RETURN jsonb_build_object('invitation_id', _id, 'token', _token, 'email', _mail,
                            'org_name', _org.name, 'role', _role);
END; $$;

CREATE OR REPLACE FUNCTION public.org_resend_invitation(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.invitations%ROWTYPE; _token text;
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO inv FROM public.invitations WHERE id = _id AND org_id = public.current_org_id();
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF inv.status = 'accepted' THEN RAISE EXCEPTION 'already_accepted'; END IF;
  _token := encode(extensions.gen_random_bytes(24), 'hex');
  UPDATE public.invitations
     SET token_hash = encode(extensions.digest(_token,'sha256'),'hex'),
         expires_at = now() + interval '7 days', status = 'pending', revoked_at = NULL
   WHERE id = _id;
  RETURN jsonb_build_object('invitation_id', _id, 'token', _token, 'email', inv.email,
                            'org_name', (SELECT name FROM public.organizations WHERE id = inv.org_id),
                            'role', inv.role);
END; $$;

CREATE OR REPLACE FUNCTION public.org_revoke_invitation(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.invitations SET status = 'revoked', revoked_at = now(), token_hash = NULL
   WHERE id = _id AND org_id = public.current_org_id() AND status <> 'accepted';
END; $$;

CREATE OR REPLACE FUNCTION public.org_set_member_properties(_user_id uuid, _property_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id();
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND org_id = _org) THEN
    RAISE EXCEPTION 'member_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(_property_ids,'{}')) x
              WHERE x NOT IN (SELECT id FROM public.properties WHERE org_id = _org)) THEN
    RAISE EXCEPTION 'invalid_property'; END IF;
  DELETE FROM public.member_property_access WHERE user_id = _user_id AND org_id = _org;
  INSERT INTO public.member_property_access (org_id, user_id, property_id)
  SELECT _org, _user_id, x FROM unnest(COALESCE(_property_ids,'{}')) x
  ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.org_set_member_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
  IF public.role_of(_user_id) = 'owner' THEN RAISE EXCEPTION 'cannot_change_owner'; END IF;
  UPDATE public.profiles SET access_status = _status
   WHERE id = _user_id AND org_id = public.current_org_id();
END; $$;

-- ============ 7. invitación pública / aceptación ============
CREATE OR REPLACE FUNCTION public.invitation_preview(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.invitations
   WHERE token_hash = encode(extensions.digest(coalesce(_token,''),'sha256'),'hex');
  IF inv.id IS NULL THEN RETURN jsonb_build_object('valid', false, 'reason', 'invalid'); END IF;
  IF inv.status = 'revoked' THEN RETURN jsonb_build_object('valid', false, 'reason', 'revoked'); END IF;
  IF inv.status = 'accepted' THEN RETURN jsonb_build_object('valid', false, 'reason', 'accepted'); END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired'); END IF;
  RETURN jsonb_build_object('valid', true, 'email', inv.email, 'full_name', inv.full_name,
    'role', inv.role, 'message', inv.message,
    'org_name', (SELECT name FROM public.organizations WHERE id = inv.org_id));
END; $$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.invitations%ROWTYPE; uid uuid := auth.uid(); uemail text; _seats int; _max int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
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
END; $$;

GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO anon, authenticated;

-- ============ 8. alta de usuarios: sin herencia por correo ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_org uuid;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'invited', '') = 'true' THEN
    INSERT INTO public.profiles (id, org_id, first_name, last_name, phone, email)
    VALUES (NEW.id, NULL, NEW.raw_user_meta_data ->> 'first_name',
            NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'phone', NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'company',''), 'Mi empresa'))
  RETURNING id INTO target_org;

  INSERT INTO public.profiles (id, org_id, first_name, last_name, company, phone, email)
  VALUES (NEW.id, target_org, NEW.raw_user_meta_data ->> 'first_name',
          NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'company',
          NEW.raw_user_meta_data ->> 'phone', NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
