import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAlerts, useProperties } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas operativas — CasaFlow" },
      {
        name: "description",
        content: "Centro de alertas críticas: dobles reservas, pagos vencidos, fallas de sincronización e incidencias urgentes.",
      },
      { property: "og:title", content: "Alertas — CasaFlow" },
      { property: "og:description", content: "Todo lo que requiere decisión inmediata, en un solo lugar." },
    ],
  }),
  component: Alertas,
});

function Alertas() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useAlerts();
  const { data: properties = [] } = useProperties();
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alerta marcada como atendida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = alerts.filter((a) => !a.is_read);
  const done = alerts.filter((a) => a.is_read);

  return (
    <AppShell title="Alertas" subtitle={`${pending.length} sin atender`}>
      <div className="space-y-2">
        {pending.map((a) => (
          <Card key={a.id} className={a.severity === "critical" ? "border-destructive/40" : ""}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={a.severity} />
                  <p className="font-medium">{a.title}</p>
                </div>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.category} · {a.property_id ? propById[a.property_id]?.name : "Toda la cartera"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => markRead.mutate(a.id)}>
                Marcar atendida
              </Button>
            </CardContent>
          </Card>
        ))}
        {pending.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Sin alertas pendientes. Operación en verde.
            </CardContent>
          </Card>
        )}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historial
          </h2>
          <div className="space-y-1.5">
            {done.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm opacity-70">
                <StatusPill value={a.severity} />
                <span className="font-medium">{a.title}</span>
                <span className="truncate text-muted-foreground">{a.body}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
