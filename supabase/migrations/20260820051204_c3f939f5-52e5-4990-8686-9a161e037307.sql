REVOKE EXECUTE ON FUNCTION public.property_is_available(uuid, date, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_direct_reservation(uuid, date, date, uuid, text, text, text, text, text, text, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.property_is_available(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_direct_reservation(uuid, date, date, uuid, text, text, text, text, text, text, numeric, integer, text) TO authenticated;