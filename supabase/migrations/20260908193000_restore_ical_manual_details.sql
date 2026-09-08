-- Reactiva iCal como fuente de disponibilidad y conserva datos operativos
-- capturados manualmente aunque el canal vuelva a sincronizar fechas.
ALTER TABLE public.external_calendar_events
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS guests_count integer NOT NULL DEFAULT 1 CHECK (guests_count > 0),
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.property_calendars
SET active = true,
    status = CASE WHEN status = 'disabled_csv_only' THEN 'pending' ELSE status END,
    last_error = NULL,
    updated_at = now()
WHERE status = 'disabled_csv_only';

ALTER TABLE public.property_calendars DROP CONSTRAINT IF EXISTS property_calendars_status_check;
ALTER TABLE public.property_calendars
  ADD CONSTRAINT property_calendars_status_check
  CHECK (status IN ('pending','connected','error','disabled'));

COMMENT ON COLUMN public.external_calendar_events.guest_name IS
  'Dato manual conservado durante las sincronizaciones iCal.';

DROP POLICY IF EXISTS "members read external events" ON public.external_calendar_events;
CREATE POLICY "members read external events" ON public.external_calendar_events
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_access_property(property_id));

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
    )
    OR EXISTS (
      SELECT 1 FROM public.property_blocks b
      WHERE b.property_id = _property_id
        AND b.start_date < _check_out AND b.end_date > _check_in
    )
  )
$$;
