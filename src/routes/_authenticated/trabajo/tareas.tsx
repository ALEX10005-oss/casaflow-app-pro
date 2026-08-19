import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { WorkerShell } from "@/components/worker-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  longDate,
  todayISO,
  useCleaningTasks,
  useMaintenance,
  useMyContext,
  useProperties,
  useReservations,
  useUpdateCleaningStatus,
  useUpdateMaintenanceStatus,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/trabajo/tareas")({
  head: () => ({
    meta: [
      { title: "Mis tareas del día — CasaFlow" },
      {
        name: "description",
        content:
          "Tareas asignadas de limpieza, mantenimiento y recepción con avance en un toque, limitadas a tus propiedades.",
      },
      { property: "og:title", content: "Mis tareas del día — CasaFlow" },
      { property: "og:description", content: "Avanza tus tareas asignadas desde el móvil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tareas,
});

function Tareas() {
  const { data: ctx } = useMyContext();
  const role = ctx?.role;
  const { data: properties = [] } = useProperties();
  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? "Propiedad";

  const { data: cleaning = [] } = useCleaningTasks();
  const { data: maintenance = [] } = useMaintenance();
  const { data: reservations = [] } = useReservations();
  const setCleaning = useUpdateCleaningStatus();
  const setMaintenance = useUpdateMaintenanceStatus();
  const today = todayISO();

  if (role === "reception") {
    const arrivals = reservations.filter((r) => r.check_in >= today).slice(0, 25);
    const departures = reservations.filter((r) => r.check_out >= today).slice(0, 25);
    return (
      <WorkerShell title="Llegadas y salidas">
        <Section title={`Llegadas (${arrivals.length})`}>
          {arrivals.map((r) => (
            <Row
              key={r.id}
              title={propName(r.property_id)}
              detail={`Entrada ${longDate(r.check_in)} · ${r.guests_count} huésped(es) · ${r.code}`}
              status={r.status}
            />
          ))}
        </Section>
        <Section title={`Salidas (${departures.length})`}>
          {departures.map((r) => (
            <Row
              key={r.id}
              title={propName(r.property_id)}
              detail={`Salida ${longDate(r.check_out)} · ${r.code}`}
              status={r.status}
            />
          ))}
        </Section>
      </WorkerShell>
    );
  }

  const isCleaning = role === "cleaning";
  const tasks = cleaning.filter((t) => t.status !== "completada");
  const issues = maintenance.filter((m) => m.status !== "resuelta");
  const empty = isCleaning ? tasks.length === 0 : issues.length === 0;

  return (
    <WorkerShell title={isCleaning ? "Limpiezas asignadas" : "Incidencias asignadas"}>
      {empty && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No tienes tareas pendientes por ahora.
          </CardContent>
        </Card>
      )}

      {isCleaning
        ? tasks.map((t) => (
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
    </WorkerShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Row({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <StatusPill value={status} />
      </CardContent>
    </Card>
  );
}
