
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.record_health_check(text,text,text,text,jsonb,uuid,text,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.role_of(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO anon;
