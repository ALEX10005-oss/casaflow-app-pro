DROP POLICY IF EXISTS "members read allowed properties" ON public.properties;
CREATE POLICY "members read allowed properties" ON public.properties
FOR SELECT TO authenticated
USING (
  org_id = public.current_org_id()
  AND (
    public.my_role() IN ('owner','manager','accounting')
    OR EXISTS (
      SELECT 1 FROM public.member_property_access a
      WHERE a.user_id = auth.uid() AND a.property_id = properties.id
    )
  )
);