import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ical/{$token}.ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildIcal } = await import("@/lib/ical.server");

        const token = params.token?.trim();
        if (!token) return new Response("Not found", { status: 404 });

        const { data: property } = await supabaseAdmin
          .from("properties")
          .select("id,name")
          .eq("ical_token", token)
          .maybeSingle();

        if (!property) return new Response("Not found", { status: 404 });

        const [{ data: reservations }, { data: external }, { data: blocks }] = await Promise.all([
          supabaseAdmin
            .from("reservations")
            .select("id,code,check_in,check_out,status")
            .eq("property_id", property.id)
            .neq("status", "cancelada"),
          supabaseAdmin
            .from("external_calendar_events")
            .select("id,external_uid,start_date,end_date,channel,status")
            .eq("property_id", property.id)
            .neq("status", "cancelled"),
          supabaseAdmin
            .from("property_blocks")
            .select("id,start_date,end_date,reason")
            .eq("property_id", property.id),
        ]);

        const items = [
          ...(reservations ?? []).map((r) => ({
            uid: `reservation-${r.id}`,
            start: r.check_in,
            end: r.check_out,
            summary: "Reservado · CasaFlow",
          })),
          ...(external ?? []).map((e) => ({
            uid: `external-${e.id}`,
            start: e.start_date,
            end: e.end_date,
            summary: `Ocupado · ${e.channel}`,
          })),
          ...(blocks ?? []).map((b) => ({
            uid: `block-${b.id}`,
            start: b.start_date,
            end: b.end_date,
            summary: `Bloqueado · ${b.reason}`,
          })),
        ];

        const body = buildIcal(property.name, items);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `inline; filename="casaflow-${property.id}.ics"`,
            "Cache-Control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});
