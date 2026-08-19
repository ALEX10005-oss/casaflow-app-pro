
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  license_type text NOT NULL DEFAULT 'pro',
  license_status text NOT NULL DEFAULT 'active',
  max_properties int NOT NULL DEFAULT 30,
  max_users int NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  company text,
  phone text,
  email text,
  access_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "read own org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());

CREATE TYPE public.app_role AS ENUM ('owner','manager','reception','cleaning','maintenance','accounting');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

INSERT INTO public.organizations (id, name, license_type, license_status, max_properties, max_users)
VALUES ('11111111-1111-1111-1111-111111111111','Grupo Costa Vacacional','pro','active',30,15);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, org_id, first_name, last_name, company, phone, email)
  VALUES (
    NEW.id,
    '11111111-1111-1111-1111-111111111111',
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'company','Grupo Costa Vacacional'),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  address text,
  capacity int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'available',
  image_url text,
  check_in_time text NOT NULL DEFAULT '15:00',
  check_out_time text NOT NULL DEFAULT '11:00',
  wifi_name text,
  wifi_password text,
  access_code text,
  instructions text,
  nightly_rate numeric NOT NULL DEFAULT 2500,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org properties" ON public.properties FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org guests" ON public.guests FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  channel text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  status text NOT NULL,
  payment_status text NOT NULL DEFAULT 'paid',
  total_amount numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  guests_count int NOT NULL DEFAULT 2,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org reservations" ON public.reservations FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.property_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT 'blocked',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_blocks TO authenticated;
GRANT ALL ON public.property_blocks TO service_role;
ALTER TABLE public.property_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org blocks" ON public.property_blocks FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  checkout_time text,
  next_checkin_time text,
  assignee text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_tasks TO authenticated;
GRANT ALL ON public.cleaning_tasks TO service_role;
ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org cleaning" ON public.cleaning_tasks FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.maintenance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee text,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'nueva',
  blocks_guests boolean NOT NULL DEFAULT false,
  reported_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_issues TO authenticated;
GRANT ALL ON public.maintenance_issues TO service_role;
ALTER TABLE public.maintenance_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org maintenance" ON public.maintenance_issues FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  kind text NOT NULL,
  category text NOT NULL,
  channel text,
  amount numeric NOT NULL,
  occurred_on date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org transactions" ON public.transactions FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org templates" ON public.whatsapp_templates FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event text NOT NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automations TO authenticated;
GRANT ALL ON public.whatsapp_automations TO service_role;
ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org automations" ON public.whatsapp_automations FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  template_name text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'entregado',
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org messages" ON public.whatsapp_messages FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  last_sync timestamptz,
  detail text,
  per_property boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org integrations" ON public.integrations FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_access timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org team" ON public.team_members FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info',
  category text NOT NULL,
  title text NOT NULL,
  body text,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org alerts" ON public.alerts FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

INSERT INTO public.properties (org_id, code, name, location, address, capacity, status, nightly_rate, wifi_name, wifi_password, access_code, instructions)
SELECT '11111111-1111-1111-1111-111111111111',
  'P' || lpad(i::text,2,'0'),
  (ARRAY['Villa','Casa','Loft','Suite','Bungalow'])[1 + (i % 5)] || ' ' || lpad(i::text,2,'0'),
  (ARRAY['Punta Mita','Sayulita','Bucerías','Nuevo Vallarta','Puerto Vallarta','San Pancho'])[1 + (i % 6)],
  'Av. del Mar ' || (100 + i * 7) || ', Nayarit',
  2 + (i % 7),
  CASE WHEN i % 9 = 0 THEN 'maintenance' WHEN i % 3 = 0 THEN 'available' ELSE 'occupied' END,
  1800 + (i % 8) * 450,
  'CasaFlow_' || lpad(i::text,2,'0'),
  'flow' || (1000 + i * 13),
  lpad(((i * 371) % 9000 + 1000)::text, 4, '0'),
  'Estacionamiento en cochera. Alberca abierta de 8:00 a 22:00. No fiestas.'
FROM generate_series(1,26) i;

INSERT INTO public.guests (org_id, full_name, email, phone, country)
SELECT '11111111-1111-1111-1111-111111111111',
  (ARRAY['María','Jorge','Ana','Luis','Sofía','Carlos','Elena','Diego','Paula','Andrés','Lucía','Tomás'])[1 + (i % 12)]
   || ' ' || (ARRAY['Hernández','Ramírez','Torres','Guzmán','Salazar','Cordero','Beltrán','Navarro','Ibarra','Molina'])[1 + (i % 10)],
  'huesped' || i || '@correo.com',
  '+52 322 1' || lpad((100000 + i * 137)::text, 6, '0'),
  (ARRAY['México','Estados Unidos','Canadá','España'])[1 + (i % 4)]
FROM generate_series(1,70) i;

WITH p AS (SELECT id, code, nightly_rate, (row_number() OVER (ORDER BY code))::int rn FROM public.properties),
g AS (SELECT id, (row_number() OVER (ORDER BY full_name, id))::int rn FROM public.guests),
combos AS (
  SELECT p.id AS pid, p.nightly_rate, p.rn, k,
         (current_date + (((p.rn * 5 + k * 13) % 46) - 12))::date AS ci,
         (2 + ((p.rn + k) % 5))::int AS nights,
         ((p.rn - 1) * 3 + k + 1)::int AS seq
  FROM p CROSS JOIN generate_series(0,2) k
)
INSERT INTO public.reservations (org_id, code, property_id, guest_id, channel, check_in, check_out, status, payment_status, total_amount, commission, guests_count)
SELECT '11111111-1111-1111-1111-111111111111',
  'CF-' || lpad(c.seq::text, 4, '0'),
  c.pid,
  (SELECT id FROM g WHERE g.rn = 1 + (c.seq % 70)),
  (ARRAY['Airbnb','Booking','VRBO','Web Directa'])[1 + (c.seq % 4)],
  c.ci,
  (c.ci + c.nights)::date,
  CASE WHEN (c.ci + c.nights) < current_date THEN 'completada'
       WHEN c.ci <= current_date THEN 'en_curso'
       ELSE 'confirmada' END,
  CASE WHEN c.seq % 11 = 0 THEN 'pendiente' ELSE 'pagado' END,
  c.nightly_rate * c.nights,
  round(c.nightly_rate * c.nights * (CASE WHEN c.seq % 4 = 3 THEN 0 ELSE 0.15 END)),
  1 + (c.seq % 6)
FROM combos c;

INSERT INTO public.cleaning_tasks (org_id, property_id, reservation_id, scheduled_date, checkout_time, next_checkin_time, assignee, priority, status)
SELECT r.org_id, r.property_id, r.id, r.check_out, '11:00', '15:00',
  (ARRAY['Rosa Medina','Carmen Ruiz','Alicia Pérez','Julia Sandoval'])[1 + (row_number() OVER (ORDER BY r.check_out) % 4)],
  CASE WHEN row_number() OVER (ORDER BY r.check_out) % 7 = 0 THEN 'alta' ELSE 'normal' END,
  CASE
    WHEN r.check_out < current_date THEN 'completada'
    WHEN r.check_out = current_date THEN (ARRAY['pendiente','asignada','en_proceso','incidencia'])[1 + (row_number() OVER (ORDER BY r.check_out) % 4)]
    ELSE 'pendiente' END
FROM public.reservations r;

INSERT INTO public.maintenance_issues (org_id, property_id, title, description, assignee, priority, status, blocks_guests, reported_on)
SELECT '11111111-1111-1111-1111-111111111111', p.id,
  (ARRAY['Fuga en regadera principal','Aire acondicionado no enfría','Bomba de alberca sin presión','Cerradura digital sin batería','Persiana atorada en sala','Calentador de agua intermitente'])[1 + (p.rn % 6)],
  'Reportado por el equipo de limpieza tras el checkout.',
  (ARRAY['Marco Delgado','Iván Ríos','Sergio Peña'])[1 + (p.rn % 3)],
  (ARRAY['alta','media','baja'])[1 + (p.rn % 3)],
  (ARRAY['nueva','asignada','en_proceso','resuelta'])[1 + (p.rn % 4)],
  (p.rn % 5 = 0),
  (current_date - (p.rn % 9))::date
FROM (SELECT id, (row_number() OVER (ORDER BY code))::int rn FROM public.properties) p
WHERE p.rn % 2 = 0;

INSERT INTO public.transactions (org_id, property_id, reservation_id, kind, category, channel, amount, occurred_on, description)
SELECT r.org_id, r.property_id, r.id, 'income', 'Hospedaje', r.channel, r.total_amount - r.commission, r.check_in, 'Ingreso neto reserva ' || r.code
FROM public.reservations r;

INSERT INTO public.transactions (org_id, property_id, reservation_id, kind, category, channel, amount, occurred_on, description)
SELECT r.org_id, r.property_id, r.id, 'expense', 'Comisión canal', r.channel, r.commission, r.check_in, 'Comisión ' || r.channel
FROM public.reservations r WHERE r.commission > 0;

INSERT INTO public.transactions (org_id, property_id, kind, category, amount, occurred_on, description)
SELECT c.org_id, c.property_id, 'expense', 'Limpieza', 650, c.scheduled_date, 'Servicio de limpieza'
FROM public.cleaning_tasks c;

INSERT INTO public.transactions (org_id, property_id, kind, category, amount, occurred_on, description)
SELECT m.org_id, m.property_id, 'expense', 'Mantenimiento', 900 + (random()*1500)::int, m.reported_on, m.title
FROM public.maintenance_issues m;

INSERT INTO public.whatsapp_templates (id, org_id, name, body) VALUES
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Pre check-in estándar','Hola {{guest_name}}, tu llegada a {{property_name}} es el {{check_in}}. Dirección: {{address}}. Código de acceso: {{access_code}}.'),
 ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Bienvenida','Bienvenido a {{property_name}}. WiFi: {{wifi_name}} / {{wifi_password}}. Cualquier detalle, respóndenos por aquí.'),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Recordatorio de salida','Hola {{guest_name}}, recuerda que el check-out de {{property_name}} es el {{check_out}} a las 11:00.'),
 ('22222222-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Post estancia','Gracias por hospedarte en {{property_name}}, {{guest_name}}. ¿Nos dejas tu opinión?');

INSERT INTO public.whatsapp_automations (org_id, name, trigger_event, template_id, active) VALUES
 ('11111111-1111-1111-1111-111111111111','Pre check-in','24 horas antes del check-in','22222222-0000-0000-0000-000000000001',true),
 ('11111111-1111-1111-1111-111111111111','Bienvenida','Al momento del check-in','22222222-0000-0000-0000-000000000002',true),
 ('11111111-1111-1111-1111-111111111111','Recordatorio de salida','12 horas antes del check-out','22222222-0000-0000-0000-000000000003',true),
 ('11111111-1111-1111-1111-111111111111','Post estancia','6 horas después del check-out','22222222-0000-0000-0000-000000000004',false);

INSERT INTO public.whatsapp_messages (org_id, guest_id, property_id, reservation_id, template_name, body, status, sent_at)
SELECT r.org_id, r.guest_id, r.property_id, r.id, 'Pre check-in estándar',
  'Hola, tu llegada es el ' || r.check_in || '. Código de acceso enviado.',
  CASE WHEN row_number() OVER (ORDER BY r.check_in) % 13 = 0 THEN 'fallido' ELSE 'entregado' END,
  (r.check_in - 1)::timestamptz + interval '10 hours'
FROM public.reservations r WHERE r.check_in >= current_date - 20;

INSERT INTO public.integrations (org_id, provider, status, last_sync, detail, per_property) VALUES
 ('11111111-1111-1111-1111-111111111111','Airbnb','connected', now() - interval '12 minutes','26 calendarios iCal sincronizados', true),
 ('11111111-1111-1111-1111-111111111111','Booking','connected', now() - interval '35 minutes','24 calendarios iCal sincronizados', true),
 ('11111111-1111-1111-1111-111111111111','VRBO','error', now() - interval '9 hours','Error de autenticación en 2 propiedades', true),
 ('11111111-1111-1111-1111-111111111111','Web','syncing', now() - interval '2 minutes','Motor de reservas directo', false),
 ('11111111-1111-1111-1111-111111111111','WhatsApp','connected', now() - interval '4 minutes','Número verificado +52 322 145 8890', false);

INSERT INTO public.team_members (org_id, name, email, role, status, last_access) VALUES
 ('11111111-1111-1111-1111-111111111111','Laura Estrada','laura@grupocosta.mx','manager','active', now() - interval '35 minutes'),
 ('11111111-1111-1111-1111-111111111111','Rosa Medina','rosa@grupocosta.mx','cleaning','active', now() - interval '2 hours'),
 ('11111111-1111-1111-1111-111111111111','Carmen Ruiz','carmen@grupocosta.mx','cleaning','active', now() - interval '5 hours'),
 ('11111111-1111-1111-1111-111111111111','Marco Delgado','marco@grupocosta.mx','maintenance','active', now() - interval '1 day'),
 ('11111111-1111-1111-1111-111111111111','Iván Ríos','ivan@grupocosta.mx','maintenance','inactive', now() - interval '9 days'),
 ('11111111-1111-1111-1111-111111111111','Daniela Solís','daniela@grupocosta.mx','reception','active', now() - interval '20 minutes'),
 ('11111111-1111-1111-1111-111111111111','Héctor Vela','hector@grupocosta.mx','accounting','active', now() - interval '3 days');

INSERT INTO public.alerts (org_id, severity, category, title, body, property_id, is_read)
SELECT '11111111-1111-1111-1111-111111111111', s.sev, s.cat, s.title, s.body,
  (SELECT id FROM public.properties ORDER BY code OFFSET s.off LIMIT 1), s.rd
FROM (VALUES
 ('critical','reserva','Conflicto de reserva','Dos reservas se traslapan en la misma propiedad.',3,false),
 ('critical','mantenimiento','Mantenimiento urgente','Bomba de alberca sin presión; impide recibir huéspedes.',8,false),
 ('warning','calendario','Error de sincronización iCal','VRBO no respondió en las últimas 9 horas.',14,false),
 ('warning','whatsapp','Mensaje de WhatsApp fallido','No se entregó el pre check-in a un huésped.',5,false),
 ('warning','limpieza','Limpieza atrasada','Checkout a las 11:00 sin limpieza iniciada.',19,true),
 ('info','reserva','Nueva reserva','Reserva directa recibida desde la web.',1,true)
) AS s(sev,cat,title,body,off,rd);
