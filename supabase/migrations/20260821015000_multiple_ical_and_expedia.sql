-- CasaFlow: multiple iCal feeds per property + Expedia support.
-- Safe, additive migration: preserves all existing property/reservation data.

alter table public.property_calendars
  add column if not exists listing_name text;

alter table public.property_calendars
  drop constraint if exists property_calendars_property_id_channel_key;

alter table public.property_calendars
  drop constraint if exists property_calendars_channel_check;

alter table public.property_calendars
  add constraint property_calendars_channel_check
  check (channel = any (array[
    'Airbnb'::text,
    'Booking'::text,
    'VRBO'::text,
    'Expedia'::text,
    'Otro'::text
  ]));

create index if not exists idx_property_calendars_property_channel
  on public.property_calendars(property_id, channel);
