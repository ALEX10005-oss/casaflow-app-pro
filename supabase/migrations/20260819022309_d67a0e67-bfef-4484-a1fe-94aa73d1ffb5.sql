CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role app_role NOT NULL DEFAULT 'cleaning',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX invitations_email_pending_idx ON public.invitations (lower(email)) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org invitations" ON public.invitations FOR ALL TO authenticated
USING (org_id = public.current_org_id())
WITH CHECK (org_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.invitations%ROWTYPE;
  target_org uuid;
  target_role app_role;
BEGIN
  SELECT * INTO inv FROM public.invitations
   WHERE lower(email) = lower(NEW.email) AND status = 'pending'
   ORDER BY created_at DESC LIMIT 1;

  IF inv.id IS NOT NULL THEN
    target_org := inv.org_id;
    target_role := inv.role;
    UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
  ELSE
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data ->> 'company', 'Mi empresa'))
    RETURNING id INTO target_org;
    target_role := 'owner';
  END IF;

  INSERT INTO public.profiles (id, org_id, first_name, last_name, company, phone, email)
  VALUES (
    NEW.id,
    target_org,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', inv.full_name),
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'company',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, target_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;