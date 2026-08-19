import { createFileRoute } from "@tanstack/react-router";
import { WorkerShell } from "@/components/worker-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import {
  addDays,
  longDate,
  todayISO,
  useCleaningTasks,
  useMaintenance,
  useMyContext,
  useProperties,
  useReservations,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/trabajo/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario de trabajo — CasaFlow" },
      {
        name: "description",
        content:
          "Próximos 14 días de trabajo filtrados por rol y propiedades asignadas: limpiezas, incidencias y movimientos de huéspedes.",
      },
      { property: "og:title", content: "Calendario de trabajo — CasaFlow" },
      { property: "og:description", content: "Tu agenda de los próximos 14 días." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarioTrabajo,
});

type Item = { date: string; title: string; detail: string; status: string };

function CalendarioTrabajo() {
  const { data: ctx } = useMyContext();
  const role = ctx?.role;
  const { data: properties = [] } = useProperties();
  const { data: cleaning = [] } = useCleaningTasks();
  const { data: maintenance = [] } = useMaintenance();
  const { data: reservations = [] } = useReservations();

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? "Propiedad";
  const today = todayISO();
  const horizon = addDays(today, 14);
  const items: Item[] = [];

  if (role === "cleaning") {
    for (const t of cleaning) {
      if (t.scheduled_date >= today && t.scheduled_date <= horizon)
        items.push({
          date: t.scheduled_date,
          title: propName(t.property_id),
          detail: `Limpieza${t.checkout_time ? ` · salida ${t.checkout_time}` : ""}`,
          status: t.status,
        });
    }
  }
  if (role === "maintenance") {
    for (const m of maintenance) {
      if (m.status !== "resuelta")
        items.push({
          date: m.reported_on,
          title: m.title,
          detail: propName(m.property_id),
          status: m.status,
        });
    }
  }
  if (role === "reception") {
    for (const r of reservations) {
      if (r.check_in >= today && r.check_in <= horizon)
        items.push({
          date: r.check_in,
          title: `Llegada · ${propName(r.property_id)}`,
          detail: `${r.guests_count} huésped(es) · ${r.code}`,
          status: r.status,
        });
      if (r.check_out >= today && r.check_out <= horizon)
        items.push({
          date: r.check_out,
          title: `Salida · ${propName(r.property_id)}`,
          detail: r.code,
          status: r.status,
        });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(items.map((i) => i.date))];

  return (
    <WorkerShell title="Calendario de trabajo" subtitle="Próximos 14 días de tus propiedades">
      {days.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay actividad programada en tus propiedades asignadas.
          </CardContent>
        </Card>
      )}
      {days.map((d) => (
        <div key={d} className="space-y-2">
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {longDate(d)}
          </p>
          {items
            .filter((i) => i.date === d)
            .map((i, idx) => (
              <Card key={`${d}-${idx}`}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.detail}</p>
                  </div>
                  <StatusPill value={i.status} />
                </CardContent>
              </Card>
            ))}
        </div>
      ))}
    </WorkerShell>
  );
}
