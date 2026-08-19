import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, Wrench } from "lucide-react";
import { WorkerShell } from "@/components/worker-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  longDate,
  todayISO,
  useCleaningTasks,
  useMaintenance,
  useMyContext,
  useProperties,
  useReservations,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/trabajo/")({
  head: () => ({
    meta: [
      { title: "Inicio de trabajo — CasaFlow" },
      {
        name: "description",
        content:
          "Resumen del día para el personal de limpieza, mantenimiento y recepción: tareas, incidencias y movimientos de sus propiedades asignadas.",
      },
      { property: "og:title", content: "Inicio de trabajo — CasaFlow" },
      { property: "og:description", content: "Tu día de trabajo en una sola pantalla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { data: ctx } = useMyContext();
  const role = ctx?.role;
  const today = todayISO();
  const { data: properties = [] } = useProperties();
  const { data: cleaning = [] } = useCleaningTasks();
  const { data: maintenance = [] } = useMaintenance();
  const { data: reservations = [] } = useReservations();

  const pendingCleaning = cleaning.filter((t) => t.status !== "completada");
  const openIssues = maintenance.filter((m) => m.status !== "resuelta");
  const arrivals = reservations.filter((r) => r.check_in === today);
  const departures = reservations.filter((r) => r.check_out === today);

  return (
    <WorkerShell title={`Hola${ctx?.org_name ? "" : ""}`} subtitle={longDate(today)}>
      <div className="grid grid-cols-2 gap-3">
        {role === "reception" ? (
          <>
            <Stat label="Llegadas hoy" value={arrivals.length} />
            <Stat label="Salidas hoy" value={departures.length} />
          </>
        ) : role === "maintenance" ? (
          <>
            <Stat label="Incidencias abiertas" value={openIssues.length} />
            <Stat label="Propiedades asignadas" value={properties.length} />
          </>
        ) : (
          <>
            <Stat label="Limpiezas pendientes" value={pendingCleaning.length} />
            <Stat label="Propiedades asignadas" value={properties.length} />
          </>
        )}
      </div>

      <Shortcut to="/trabajo/tareas" icon={ClipboardList} label="Ver mis tareas" />
      <Shortcut to="/trabajo/calendario" icon={CalendarDays} label="Calendario de trabajo" />
      {(role === "cleaning" || role === "maintenance") && (
        <Shortcut to="/trabajo/incidencias" icon={Wrench} label="Incidencias" />
      )}

      <Card>
        <CardContent className="space-y-1 py-4 text-sm">
          <p className="font-medium">Propiedades asignadas</p>
          {properties.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Todavía no tienes propiedades asignadas. Tu administrador debe asignártelas.
            </p>
          )}
          {properties.map((p) => (
            <p key={p.id} className="text-xs text-muted-foreground">
              {p.code} · {p.name}
            </p>
          ))}
        </CardContent>
      </Card>
    </WorkerShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Shortcut({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof ClipboardList;
  label: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
