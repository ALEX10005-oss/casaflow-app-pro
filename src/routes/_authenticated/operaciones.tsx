import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { longDate, todayISO, useCleaningTasks, useMaintenance, useProperties } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/operaciones")({
  head: () => ({
    meta: [
      { title: "Limpieza y mantenimiento — CasaFlow" },
      {
        name: "description",
        content: "Coordina limpiezas por ventana de salida y entrada, y da seguimiento a incidencias de mantenimiento.",
      },
      { property: "og:title", content: "Operaciones — CasaFlow" },
      { property: "og:description", content: "Limpiezas del día e incidencias abiertas por propiedad." },
    ],
  }),
  component: Operaciones,
});

function Operaciones() {
  const qc = useQueryClient();
  const { data: cleaning = [] } = useCleaningTasks();
  const { data: issues = [] } = useMaintenance();
  const { data: properties = [] } = useProperties();
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const today = todayISO();

  const updateCleaning = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("cleaning_tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaning_tasks"] });
      toast.success("Limpieza actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateIssue = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("maintenance_issues").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_issues"] });
      toast.success("Incidencia actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = cleaning.reduce<Record<string, typeof cleaning>>((acc, t) => {
    (acc[t.scheduled_date] ??= []).push(t);
    return acc;
  }, {});

  return (
    <AppShell title="Operaciones" subtitle="Ejecución diaria de limpieza y mantenimiento">
      <Tabs defaultValue="limpieza">
        <TabsList>
          <TabsTrigger value="limpieza">Limpieza ({cleaning.filter((c) => c.status !== "completada").length})</TabsTrigger>
          <TabsTrigger value="mantenimiento">Mantenimiento ({issues.filter((i) => i.status !== "resuelta").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="limpieza" className="space-y-4 pt-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, tasks]) => (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {longDate(date)} {date === today && <span className="text-accent-foreground">· hoy</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{propById[t.property_id]?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Salida {t.checkout_time ?? "—"} → entrada {t.next_checkin_time ?? "sin entrada"} ·{" "}
                          {t.assignee ?? "sin asignar"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill value={t.priority} />
                        <StatusPill value={t.status} />
                        {t.status !== "completada" && (
                          <Button
                            size="sm"
                            variant={t.status === "pendiente" ? "outline" : "default"}
                            onClick={() =>
                              updateCleaning.mutate({
                                id: t.id,
                                status: t.status === "pendiente" ? "en_proceso" : "completada",
                              })
                            }
                          >
                            {t.status === "pendiente" ? "Iniciar" : "Completar"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="mantenimiento" className="space-y-2 pt-4">
          {issues.map((i) => (
            <Card key={i.id} className={i.blocks_guests && i.status !== "resuelta" ? "border-destructive/40" : ""}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{i.title}</p>
                    <StatusPill value={i.priority} />
                    {i.blocks_guests && <StatusPill value="incidencia" className="normal-case" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {propById[i.property_id]?.name} · reportada {i.reported_on} · {i.assignee ?? "sin asignar"}
                  </p>
                  {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={i.status} />
                  {i.status !== "resuelta" && (
                    <Button
                      size="sm"
                      variant={i.status === "nueva" ? "outline" : "default"}
                      onClick={() =>
                        updateIssue.mutate({ id: i.id, status: i.status === "nueva" ? "en_proceso" : "resuelta" })
                      }
                    >
                      {i.status === "nueva" ? "Tomar" : "Resolver"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
