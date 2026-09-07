-- CasaFlow: all company properties are visible to staff, while operational
-- tasks remain private to their assignee. Reports continue to be protected by
-- transaction RLS (owner/manager/accounting only).

CREATE OR REPLACE FUNCTION public.can_access_property(_p uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = _p
      AND p.org_id = public.current_org_id()
  )
$$;

DROP POLICY IF EXISTS "read cleaning" ON public.cleaning_tasks;
CREATE POLICY "read cleaning" ON public.cleaning_tasks
FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND (
    public.is_org_admin()
    OR public.my_role() = 'reception'
    OR (public.my_role() = 'cleaning' AND assignee_user_id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "update cleaning" ON public.cleaning_tasks;
CREATE POLICY "update cleaning" ON public.cleaning_tasks
FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND (
    public.is_org_admin()
    OR (public.my_role() = 'cleaning' AND assignee_user_id = (SELECT auth.uid()))
  )
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.is_org_admin()
    OR (public.my_role() = 'cleaning' AND assignee_user_id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "read maintenance" ON public.maintenance_issues;
CREATE POLICY "read maintenance" ON public.maintenance_issues
FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND (
    public.is_org_admin()
    OR public.my_role() = 'reception'
    OR (public.my_role() = 'maintenance' AND assignee_user_id = (SELECT auth.uid()))
    OR (public.my_role() = 'cleaning' AND created_by = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "update maintenance" ON public.maintenance_issues;
CREATE POLICY "update maintenance" ON public.maintenance_issues
FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND (
    public.is_org_admin()
    OR (public.my_role() = 'maintenance' AND assignee_user_id = (SELECT auth.uid()))
  )
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.is_org_admin()
    OR (public.my_role() = 'maintenance' AND assignee_user_id = (SELECT auth.uid()))
  )
);

CREATE TABLE IF NOT EXISTS public.maintenance_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  checklist_month date NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, property_id, checklist_month),
  CONSTRAINT checklist_month_first_day CHECK (checklist_month = date_trunc('month', checklist_month)::date)
);

GRANT SELECT, INSERT, UPDATE ON public.maintenance_checklists TO authenticated;
GRANT ALL ON public.maintenance_checklists TO service_role;
ALTER TABLE public.maintenance_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read maintenance checklists" ON public.maintenance_checklists
FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND public.my_role() IN ('owner', 'manager', 'maintenance', 'accounting')
);

CREATE POLICY "insert maintenance checklists" ON public.maintenance_checklists
FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.current_org_id()
  AND property_id IN (SELECT id FROM public.properties WHERE org_id = public.current_org_id())
  AND public.my_role() IN ('owner', 'manager', 'maintenance')
  AND completed_by = (SELECT auth.uid())
);

CREATE POLICY "update maintenance checklists" ON public.maintenance_checklists
FOR UPDATE TO authenticated
USING (
  org_id = public.current_org_id()
  AND public.my_role() IN ('owner', 'manager', 'maintenance')
)
WITH CHECK (
  org_id = public.current_org_id()
  AND property_id IN (SELECT id FROM public.properties WHERE org_id = public.current_org_id())
  AND public.my_role() IN ('owner', 'manager', 'maintenance')
);

CREATE INDEX IF NOT EXISTS maintenance_checklists_org_month_idx
  ON public.maintenance_checklists(org_id, checklist_month);

REVOKE ALL ON FUNCTION public.can_access_property(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_property(uuid) TO authenticated;
