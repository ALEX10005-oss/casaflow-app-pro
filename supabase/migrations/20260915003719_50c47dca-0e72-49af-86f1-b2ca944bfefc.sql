CREATE OR REPLACE FUNCTION public.property_is_available(
  _property_id uuid,
  _check_in date,
  _check_out date,
  _exclude_reservation uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.property_id = _property_id
        AND (_exclude_reservation IS NULL OR r.id <> _exclude_reservation)
        AND r.status NOT IN ('cancelada','cancelled','no_show')
        AND r.check_in < _check_out AND r.check_out > _check_in
    )
    OR EXISTS (
      SELECT 1 FROM public.external_calendar_events e
      WHERE e.property_id = _property_id AND e.status = 'active'
        AND e.start_date < _check_out AND e.end_date > _check_in
        AND NOT EXISTS (
          SELECT 1 FROM public.reservations mr
          WHERE _exclude_reservation IS NOT NULL
            AND mr.id = _exclude_reservation
            AND mr.property_id = e.property_id
            AND mr.check_in = e.start_date
            AND lower(btrim(mr.channel)) = lower(btrim(e.channel))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.property_blocks b
      WHERE b.property_id = _property_id
        AND b.start_date < _check_out AND b.end_date > _check_in
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.update_external_event_details(
  _id uuid,
  _guest_name text,
  _guest_email text,
  _guest_phone text,
  _guests_count integer,
  _total_amount numeric,
  _payment_status text,
  _channel text,
  _notes text
) RETURNS public.external_calendar_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _event public.external_calendar_events;
BEGIN
  SELECT * INTO _event FROM public.external_calendar_events WHERE id = _id;
  IF _event.id IS NULL THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF _event.org_id <> public.current_org_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT public.can_access_property(_event.property_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.my_role() NOT IN ('owner','manager','reception') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.external_calendar_events SET
    guest_name = nullif(btrim(coalesce(_guest_name,'')), ''),
    guest_email = nullif(btrim(coalesce(_guest_email,'')), ''),
    guest_phone = nullif(btrim(coalesce(_guest_phone,'')), ''),
    guests_count = greatest(1, coalesce(_guests_count, 1)),
    total_amount = greatest(0, coalesce(_total_amount, 0)),
    payment_status = coalesce(nullif(btrim(coalesce(_payment_status,'')), ''), payment_status),
    channel = coalesce(nullif(btrim(coalesce(_channel,'')), ''), channel),
    notes = nullif(btrim(coalesce(_notes,'')), ''),
    updated_at = now()
  WHERE id = _id
  RETURNING * INTO _event;

  RETURN _event;
END;
$$;

REVOKE ALL ON FUNCTION public.update_external_event_details(uuid, text, text, text, integer, numeric, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_external_event_details(uuid, text, text, text, integer, numeric, text, text, text) TO authenticated;