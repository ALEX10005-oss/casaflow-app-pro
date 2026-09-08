import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncPropertyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calendar_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { fetchIcal, parseIcal } = await import("./ical.server");
    const { data: calendar, error: calendarError } = await context.supabase
      .from("property_calendars")
      .select("*")
      .eq("id", data.calendar_id)
      .single();
    if (calendarError || !calendar) throw new Error(calendarError?.message ?? "Calendario no encontrado.");

    try {
      const active = parseIcal(await fetchIcal(calendar.ical_url)).filter((event) => !event.cancelled);
      const now = new Date().toISOString();
      const { data: existing, error: existingError } = await context.supabase
        .from("external_calendar_events")
        .select("id,external_uid")
        .eq("calendar_id", calendar.id);
      if (existingError) throw existingError;

      const activeUids = new Set(active.map((event) => event.uid));
      const staleIds = (existing ?? []).filter((event) => !activeUids.has(event.external_uid)).map((event) => event.id);
      if (staleIds.length) {
        const { error } = await context.supabase
          .from("external_calendar_events")
          .update({ status: "cancelled", last_seen_at: now, updated_at: now })
          .in("id", staleIds);
        if (error) throw error;
      }

      for (const event of active) {
        const { error } = await context.supabase.from("external_calendar_events").upsert(
          {
            calendar_id: calendar.id,
            channel: calendar.channel,
            end_date: event.end,
            external_uid: event.uid,
            last_seen_at: now,
            org_id: calendar.org_id,
            property_id: calendar.property_id,
            start_date: event.start,
            status: "active",
            summary: event.summary,
            updated_at: now,
          },
          { onConflict: "calendar_id,external_uid" },
        );
        if (error) throw error;
      }

      const { error: updateError } = await context.supabase
        .from("property_calendars")
        .update({ active: true, events_count: active.length, last_error: null, last_sync: now, status: "connected", updated_at: now })
        .eq("id", calendar.id);
      if (updateError) throw updateError;
      return { ok: true, events: active.length, last_sync: now };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "No se pudo sincronizar.";
      await context.supabase
        .from("property_calendars")
        .update({ last_error: message, last_sync: new Date().toISOString(), status: "error", updated_at: new Date().toISOString() })
        .eq("id", calendar.id);
      throw new Error(message);
    }
  });
