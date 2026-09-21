UPDATE public.organizations
SET license_status = 'active',
    updated_at = now()
WHERE LOWER(name) = 'sensity home'
  AND license_status = 'suspended';

-- Confirmar la fila afectada y conteos básicos de datos relacionados
SELECT
  o.id,
  o.name,
  o.license_status,
  (SELECT COUNT(*) FROM public.properties WHERE org_id = o.id) AS properties,
  (SELECT COUNT(*) FROM public.reservations WHERE org_id = o.id) AS reservations,
  (SELECT COUNT(*) FROM public.profiles WHERE org_id = o.id) AS profiles,
  (SELECT COUNT(*) FROM public.property_calendars WHERE org_id = o.id) AS calendars,
  (SELECT COUNT(*) FROM public.transactions WHERE org_id = o.id) AS transactions
FROM public.organizations o
WHERE LOWER(o.name) = 'sensity home';