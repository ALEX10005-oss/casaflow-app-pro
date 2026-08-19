-- 1. Asignación real de personas a tareas
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance_issues ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cleaning_tasks_assignee_user_idx ON public.cleaning_tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS maintenance_issues_assignee_user_idx ON public.maintenance_issues(assignee_user_id);

-- Helper: ¿la tarea es mía o está libre en una propiedad autorizada?
CREATE OR REPLACE FUNCTION public.is_my_task(_assignee uuid, _property uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_access_property(_property)
     AND (_assignee IS NULL OR _assignee = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_my_task(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_my_task(uuid, uuid) TO authenticated;

-- 2. RESERVAS: recepción limitada a propiedades asignadas también al escribir
DROP POLICY IF EXISTS "write reservations" ON public.reservations;
DROP POLICY IF EXISTS "update reservations" ON public.reservations;
CREATE POLICY "write reservations" ON public.reservations FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'reception' AND public.can_access_property(property_id)))
);
CREATE POLICY "update reservations" ON public.reservations FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'reception' AND public.can_access_property(property_id)))
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'reception' AND public.can_access_property(property_id)))
);

-- 3. HUÉSPEDES: recepción solo los vinculados a sus propiedades
DROP POLICY IF EXISTS "guests for admin and reception" ON public.guests;
CREATE POLICY "read guests" ON public.guests FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'reception' AND EXISTS (
             SELECT 1 FROM public.reservations r
              WHERE r.guest_id = guests.id
                AND public.can_access_property(r.property_id))))
);
-- Recepción puede dar de alta huéspedes nuevos (aún sin reserva vinculada)
CREATE POLICY "insert guests" ON public.guests FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.is_org_admin() OR public.my_role() = 'reception')
);
CREATE POLICY "update guests" ON public.guests FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'reception' AND EXISTS (
             SELECT 1 FROM public.reservations r
              WHERE r.guest_id = guests.id
                AND public.can_access_property(r.property_id))))
)
WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "delete guests" ON public.guests FOR DELETE TO authenticated
USING (org_id = public.current_org_id() AND public.is_org_admin());

-- 4. LIMPIEZA: solo tareas propias o sin asignar en propiedades autorizadas
DROP POLICY IF EXISTS "read cleaning" ON public.cleaning_tasks;
DROP POLICY IF EXISTS "update cleaning" ON public.cleaning_tasks;
CREATE POLICY "read cleaning" ON public.cleaning_tasks FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'reception' AND public.can_access_property(property_id))
       OR (public.my_role() = 'cleaning' AND public.is_my_task(assignee_user_id, property_id)))
);
CREATE POLICY "update cleaning" ON public.cleaning_tasks FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'cleaning' AND public.is_my_task(assignee_user_id, property_id)))
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'cleaning' AND public.can_access_property(property_id)
           AND (assignee_user_id IS NULL OR assignee_user_id = auth.uid())))
);

-- 5. MANTENIMIENTO: asignado real; limpieza solo lo que ella reportó
DROP POLICY IF EXISTS "read maintenance" ON public.maintenance_issues;
DROP POLICY IF EXISTS "update maintenance" ON public.maintenance_issues;
DROP POLICY IF EXISTS "insert maintenance" ON public.maintenance_issues;
CREATE POLICY "read maintenance" ON public.maintenance_issues FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'maintenance' AND public.is_my_task(assignee_user_id, property_id))
       OR (public.my_role() = 'cleaning' AND created_by = auth.uid()
           AND public.can_access_property(property_id)))
);
CREATE POLICY "insert maintenance" ON public.maintenance_issues FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() IN ('maintenance','cleaning')
           AND public.can_access_property(property_id)
           AND created_by = auth.uid()))
);
CREATE POLICY "update maintenance" ON public.maintenance_issues FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'maintenance' AND public.is_my_task(assignee_user_id, property_id)))
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.is_org_admin()
       OR (public.my_role() = 'maintenance' AND public.can_access_property(property_id)
           AND (assignee_user_id IS NULL OR assignee_user_id = auth.uid())))
);

-- 6. ACEPTAR INVITACIÓN: no reasignar cuentas de otra organización
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations%ROWTYPE; uid uuid := auth.uid(); uemail text;
        _seats int; _max int; _current_org uuid;
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
END; $$;

-- 7. Asignación de tareas a personas reales (solo owner/manager de la organización)
CREATE OR REPLACE FUNCTION public.org_assign_task(_kind text, _task_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id(); _name text;
BEGIN
  IF NOT public.is_org_admin() OR _org IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = _user_id AND org_id = _org) THEN
    RAISE EXCEPTION 'member_not_in_org';
  END IF;
  SELECT nullif(trim(concat_ws(' ', first_name, last_name)), '') INTO _name
    FROM public.profiles WHERE id = _user_id;

  IF _kind = 'cleaning' THEN
    UPDATE public.cleaning_tasks SET assignee_user_id = _user_id, assignee = _name
     WHERE id = _task_id AND org_id = _org;
  ELSIF _kind = 'maintenance' THEN
    UPDATE public.maintenance_issues SET assignee_user_id = _user_id, assignee = _name
     WHERE id = _task_id AND org_id = _org;
  ELSE
    RAISE EXCEPTION 'invalid_kind';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.org_assign_task(text, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_assign_task(text, uuid, uuid) TO authenticated;