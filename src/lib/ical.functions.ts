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

    if (calendarError || !calendar) {
      throw new Error(calendarError?.message ?? "calendar_not_found");
    }

    try {
      const body = await fetchIcal(calendar.ical_url);
      const parsed = parseIcal(body);
      const now = new Date().toISOString();
      const active = parsed.filter((e) => !e.cancelled);

      const { data: existing, error: existingError } = await context.supabase
        .from("external_calendar_events")
        .select("id,external_uid")
        .eq("calendar_id", calendar.id);
      if (existingError) throw existingError;

      const activeUids = new Set(active.map((e) => e.uid));
      const staleIds = (existing ?? [])
        .filter((e) => !activeUids.has(e.external_uid))
        .map((e) => e.id);

      if (staleIds.length > 0) {
        const { error } = await context.supabase
          .from("external_calendar_events")
          .delete()
          .in("id", staleIds);
        if (error) throw error;
      }

      if (active.length > 0) {
        const rows = active.map((e) => ({
          calendar_id: calendar.id,
          channel: calendar.channel,
          end_date: e.end,
          external_uid: e.uid,
          last_seen_at: now,
          org_id: calendar.org_id,
          property_id: calendar.property_id,
          start_date: e.start,
          status: "active",
          summary: e.summary,
          updated_at: now,
        }));

        const { error } = await context.supabase
          .from("external_calendar_events")
          .upsert(rows, { onConflict: "calendar_id,external_uid" });
        if (error) throw error;
      }

      const { error: updateError } = await context.supabase
        .from("property_calendars")
        .update({
          events_count: active.length,
          last_error: null,
          last_sync: now,
          status: "connected",
          updated_at: now,
        })
        .eq("id", calendar.id);
      if (updateError) throw updateError;

      return { ok: true, events: active.length, last_sync: now };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "sync_failed";
      await context.supabase
        .from("property_calendars")
        .update({
          last_error: message,
          last_sync: new Date().toISOString(),
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", calendar.id);
      throw new Error(message);
    }
  });
