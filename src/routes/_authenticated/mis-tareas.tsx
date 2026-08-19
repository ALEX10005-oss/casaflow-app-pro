import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Wrench, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ROLE_LABEL,
  longDate,
  todayISO,
  useCleaningTasks,
  useMaintenance,
  useMyRole,
  useProfile,
  useProperties,
  useUpdateCleaningStatus,
  useUpdateMaintenanceStatus,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/mis-tareas")({
  head: () => ({
    meta: [
      { title: "Mis tareas del día — CasaFlow" },
      {
        name: "description",
        content:
          "Vista móvil para personal de limpieza y mantenimiento: tareas del día, prioridad y avance en un toque.",
      },
      { property: "og:title", content: "Mis tareas del día — CasaFlow" },
      { property: "og:description", content: "Tareas asignadas de limpieza y mantenimiento." },
    ],
  }),
  component: MisTareas,
});

function MisTareas() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: role } = useMyRole();
  const { data: profile } = useProfile();
  const { data: properties = [] } = useProperties();
  const { data: cleaning = [] } = useCleaningTasks();
  const { data: maintenance = [] } = useMaintenance();
  const setCleaning = useUpdateCleaningStatus();
  const setMaintenance = useUpdateMaintenanceStatus();

  const me = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? "Propiedad";
  const mine = (assignee: string | null) =>
    !assignee || !me || assignee.toLowerCase().includes(me.toLowerCase().split(" ")[0] ?? "@@");

  const today = todayISO();
  const cleaningTasks = cleaning
    .filter((t) => mine(t.assignee) && t.status !== "completada" && t.scheduled_date <= today)
    .concat(cleaning.filter((t) => mine(t.assignee) && t.scheduled_date > today));
  const issues = maintenance.filter((m) => mine(m.assignee) && m.status !== "resuelta");

  const isCleaning = role === "cleaning";
  const list = isCleaning ? cleaningTasks : issues;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg bg-background pb-16">
      <header className="sticky top-0 z-20 border-b bg-card/95 px-4 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold">Hola, {profile?.first_name ?? "equipo"}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[role ?? ""] ?? "Operación"} · {longDate(today)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="space-y-3 px-4 py-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {isCleaning ? <Sparkles className="size-4" /> : <Wrench className="size-4" />}
          {isCleaning ? "Limpiezas asignadas" : "Incidencias asignadas"}
          <span className="text-muted-foreground">({list.length})</span>
        </div>

        {list.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No tienes tareas pendientes por ahora.
            </CardContent>
          </Card>
        )}

        {isCleaning
          ? cleaningTasks.map((t) => (
              <Card key={t.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{propName(t.property_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {longDate(t.scheduled_date)}
                        {t.checkout_time ? ` · salida ${t.checkout_time}` : ""}
                        {t.next_checkin_time ? ` · entrada ${t.next_checkin_time}` : ""}
                      </p>
                    </div>
                    <StatusPill value={t.priority} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={t.status === "en_proceso"}
                      onClick={() =>
                        setCleaning.mutate(
                          { id: t.id, status: "en_proceso" },
                          { onSuccess: () => toast.success("Tarea iniciada") },
                        )
                      }
                    >
                      Iniciar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setCleaning.mutate(
                          { id: t.id, status: "completada" },
                          { onSuccess: () => toast.success("Limpieza completada") },
                        )
                      }
                    >
                      Completar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          : issues.map((m) => (
              <Card key={m.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {propName(m.property_id)} · reportado {longDate(m.reported_on)}
                      </p>
                      {m.description && <p className="mt-1 text-xs">{m.description}</p>}
                    </div>
                    <StatusPill value={m.priority} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={m.status === "en_proceso"}
                      onClick={() =>
                        setMaintenance.mutate(
                          { id: m.id, status: "en_proceso" },
                          { onSuccess: () => toast.success("Incidencia en proceso") },
                        )
                      }
                    >
                      En proceso
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setMaintenance.mutate(
                          { id: m.id, status: "resuelta" },
                          { onSuccess: () => toast.success("Incidencia resuelta") },
                        )
                      }
                    >
                      Resolver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
      </main>
    </div>
  );
}
