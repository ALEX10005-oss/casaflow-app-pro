-- Importación CSV segura de reservas externas.
-- Reglas: solo INSERT; nunca UPDATE/DELETE de datos existentes.
-- Duplicados por código o por propiedad+canal+fechas se omiten sin modificar nada.

CREATE OR REPLACE FUNCTION public.import_external_reservation(
  _code text,
  _property_id uuid,
  _guest_name text,
  _guest_email text DEFAULT NULL,
  _guest_phone text DEFAULT NULL,
  _check_in date DEFAULT NULL,
  _check_out date DEFAULT NULL,
  _guests_count integer DEFAULT 1,
  _total_amount numeric DEFAULT 0,
  _channel text DEFAULT NULL,
  _status text DEFAULT 'confirmada',
  _payment_status text DEFAULT 'pendiente',
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid := public.current_org_id();
  _guest_id uuid;
  _reservation_id uuid;
  _clean_code text := nullif(trim(coalesce(_code, '')), '');
  _clean_channel text := nullif(trim(coalesce(_channel, '')), '');
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _clean_code IS NULL THEN
    RAISE EXCEPTION 'code_required';
  END IF;

  IF _clean_channel IS NULL THEN
    RAISE EXCEPTION 'channel_required';
  END IF;

  IF nullif(trim(coalesce(_guest_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'guest_required';
  END IF;

  IF _check_in IS NULL OR _check_out IS NULL OR _check_out <= _check_in THEN
    RAISE EXCEPTION 'invalid_dates';
  END IF;

  IF coalesce(_guests_count, 0) < 1 THEN
    RAISE EXCEPTION 'invalid_guests_count';
  END IF;

  IF coalesce(_total_amount, 0) < 0 THEN
    RAISE EXCEPTION 'invalid_total_amount';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.properties
    WHERE id = _property_id
      AND org_id = _org
  ) THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  -- Nunca sobrescribir: si ya existe el código externo, se omite.
  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE org_id = _org
      AND lower(trim(code)) = lower(_clean_code)
  ) THEN
    RETURN jsonb_build_object('status', 'duplicate', 'reason', 'code');
  END IF;

  -- Segunda barrera de duplicados para la misma estancia/canal.
  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE org_id = _org
      AND property_id = _property_id
      AND lower(trim(channel)) = lower(_clean_channel)
      AND check_in = _check_in
      AND check_out = _check_out
      AND status NOT IN ('cancelada', 'cancelled', 'no_show')
  ) THEN
    RETURN jsonb_build_object('status', 'duplicate', 'reason', 'stay');
  END IF;

  -- Reutiliza huésped existente sin modificarlo.
  SELECT id
  INTO _guest_id
  FROM public.guests
  WHERE org_id = _org
    AND (
      (nullif(trim(coalesce(_guest_email, '')), '') IS NOT NULL
        AND lower(email) = lower(trim(_guest_email)))
      OR (nullif(trim(coalesce(_guest_phone, '')), '') IS NOT NULL
        AND phone = trim(_guest_phone))
      OR lower(full_name) = lower(trim(_guest_name))
    )
  ORDER BY created_at
  LIMIT 1;

  -- Solo crea un huésped si no existe; nunca actualiza uno existente.
  IF _guest_id IS NULL THEN
    INSERT INTO public.guests (org_id, full_name, email, phone)
    VALUES (
      _org,
      trim(_guest_name),
      nullif(trim(coalesce(_guest_email, '')), ''),
      nullif(trim(coalesce(_guest_phone, '')), '')
    )
    RETURNING id INTO _guest_id;
  END IF;

  INSERT INTO public.reservations (
    org_id,
    code,
    property_id,
    guest_id,
    channel,
    check_in,
    check_out,
    status,
    payment_status,
    total_amount,
    commission,
    guests_count,
    notes
  ) VALUES (
    _org,
    _clean_code,
    _property_id,
    _guest_id,
    _clean_channel,
    _check_in,
    _check_out,
    coalesce(nullif(trim(coalesce(_status, '')), ''), 'confirmada'),
    coalesce(nullif(trim(coalesce(_payment_status, '')), ''), 'pendiente'),
    coalesce(_total_amount, 0),
    0,
    greatest(coalesce(_guests_count, 1), 1),
    nullif(trim(coalesce(_notes, '')), '')
  )
  RETURNING id INTO _reservation_id;

  RETURN jsonb_build_object('status', 'imported', 'reservation_id', _reservation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.import_external_reservation(text, uuid, text, text, text, date, date, integer, numeric, text, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_external_reservation(text, uuid, text, text, text, date, date, integer, numeric, text, text, text, text)
TO authenticated;
