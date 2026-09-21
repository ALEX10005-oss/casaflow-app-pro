UPDATE public.organizations
SET license_status = 'suspended', updated_at = now()
WHERE id = '362f017e-6c09-495b-81f3-079077f95ffc'
  AND lower(name) = lower('Sensity Home');