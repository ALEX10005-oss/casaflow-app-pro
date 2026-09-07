-- Corte de CasaFlow a importación CSV a partir del 2026-09-07.
-- Se conserva el histórico iCal previo al corte; no se borran filas existentes.

-- Los calendarios iCal quedan desactivados para futuras sincronizaciones.
UPDATE public.property_calendars
SET active = false,
    status = 'disabled_csv_only',
    updated_at = now()
WHERE active = true OR status <> 'disabled_csv_only';

-- Los usuarios autenticados solo ven eventos iCal que ya terminaron a más tardar
-- en la fecha de corte. Los eventos actuales/futuros permanecen almacenados,
-- pero dejan de intervenir en la operación visible.
DROP POLICY IF EXISTS "members read external events" ON public.external_calendar_events;
CREATE POLICY "members read external events" ON public.external_calendar_events
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.can_access_property(property_id)
    AND end_date <= DATE '2026-09-07'
  );

-- Desde el corte, la disponibilidad se determina únicamente por reservas
-- consolidadas de CasaFlow y bloqueos operativos. iCal deja de bloquear fechas.
CREATE OR REPLACE FUNCTION public.property_is_available(
  _property_id uuid,
  _check_in date,
  _check_out date,
  _exclude_reservation uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT (
    EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.property_id = _property_id
        AND (_exclude_reservation IS NULL OR r.id <> _exclude_reservation)
        AND r.status NOT IN ('cancelada','cancelled','no_show')
        AND r.check_in < _check_out
        AND r.check_out > _check_in
    )
    OR EXISTS (
      SELECT 1
      FROM public.property_blocks b
      WHERE b.property_id = _property_id
        AND b.start_date < _check_out
        AND b.end_date > _check_in
    )
  )
$$;
