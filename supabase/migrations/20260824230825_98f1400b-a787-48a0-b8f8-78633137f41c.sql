CREATE OR REPLACE FUNCTION public.update_reservation(
  _id uuid,
  _property_id uuid,
  _check_in date,
  _check_out date,
  _guest_name text DEFAULT NULL,
  _guest_email text DEFAULT NULL,
  _guest_phone text DEFAULT NULL,
  _channel text DEFAULT NULL,
  _code text DEFAULT NULL,
  _status text DEFAULT NULL,
  _payment_status text DEFAULT NULL,
  _total_amount numeric DEFAULT NULL,
  _guests_count integer DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org uuid := public.current_org_id();
  _row public.reservations;
  _old public.reservations;
  _g uuid;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _old FROM public.reservations WHERE id = _id AND org_id = _org;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'reservation_not_found'; END IF;

  IF NOT (public.is_org_admin()
          OR (public.my_role() = 'reception'
              AND public.can_access_property(_old.property_id)
              AND public.can_access_property(_property_id))) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = _property_id AND org_id = _org) THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  IF _check_out <= _check_in THEN RAISE EXCEPTION 'invalid_dates'; END IF;

  IF NOT public.property_is_available(_property_id, _check_in, _check_out, _id) THEN
    RAISE EXCEPTION 'property_not_available';
  END IF;

  _g := _old.guest_id;

  IF nullif(trim(coalesce(_guest_name,'')),'') IS NOT NULL THEN
    IF _g IS NOT NULL AND EXISTS (SELECT 1 FROM public.guests WHERE id = _g AND org_id = _org) THEN
      UPDATE public.guests
         SET full_name = trim(_guest_name),
             email = nullif(trim(coalesce(_guest_email,'')),''),
             phone = nullif(trim(coalesce(_guest_phone,'')),'')
       WHERE id = _g AND org_id = _org;
    ELSE
      SELECT id INTO _g FROM public.guests
       WHERE org_id = _org
         AND ( (nullif(trim(coalesce(_guest_email,'')),'') IS NOT NULL AND lower(email) = lower(trim(_guest_email)))
            OR (nullif(trim(coalesce(_guest_phone,'')),'') IS NOT NULL AND phone = trim(_guest_phone))
            OR lower(full_name) = lower(trim(_guest_name)) )
       LIMIT 1;
      IF _g IS NULL THEN
        INSERT INTO public.guests (org_id, full_name, email, phone)
        VALUES (_org, trim(_guest_name), nullif(trim(coalesce(_guest_email,'')),''),
                nullif(trim(coalesce(_guest_phone,'')),''))
        RETURNING id INTO _g;
      END IF;
    END IF;
  END IF;

  UPDATE public.reservations SET
    property_id = _property_id,
    guest_id = _g,
    check_in = _check_in,
    check_out = _check_out,
    channel = coalesce(nullif(trim(coalesce(_channel,'')),''), channel),
    code = coalesce(nullif(trim(coalesce(_code,'')),''), code),
    status = coalesce(nullif(trim(coalesce(_status,'')),''), status),
    payment_status = coalesce(nullif(trim(coalesce(_payment_status,'')),''), payment_status),
    total_amount = coalesce(_total_amount, total_amount),
    guests_count = greatest(coalesce(_guests_count, guests_count), 1),
    notes = nullif(trim(coalesce(_notes,'')),'')
  WHERE id = _id AND org_id = _org
  RETURNING * INTO _row;

  RETURN _row;
END; $$;

REVOKE ALL ON FUNCTION public.update_reservation(uuid, uuid, date, date, text, text, text, text, text, text, text, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_reservation(uuid, uuid, date, date, text, text, text, text, text, text, text, numeric, integer, text) TO authenticated;