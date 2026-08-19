import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret");
        if (!secret || !provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchPendingAlerts } = await import("@/lib/whatsapp-alerts.server");

        try {
          const result = await dispatchPendingAlerts(supabaseAdmin);
          return Response.json(result);
        } catch (e) {
          console.error("whatsapp-alerts dispatch failed", e);
          return new Response("dispatch_failed", { status: 500 });
        }
      },
    },
  },
});
