import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BedDouble, Brush, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  money,
  shortDate,
  todayISO,
  useAlerts,
  useCleaningTasks,
  useMaintenance,
  useProperties,
  useReservations,
  useTransactions,
  useGuests,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel del día — CasaFlow" },
      {
        name: "description",
        content:
          "Entradas, salidas, limpiezas y alertas críticas del día para toda la cartera de propiedades vacacionales.",
      },
      { property: "og:title", content: "Panel del día — CasaFlow" },
      { property: "og:description", content: "Estado operativo en vivo de tus propiedades." },
    ],
  }),
  component: Panel,
});

function Panel() {
  const today = todayISO();
  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: guests = [] } = useGuests();
  const { data: cleaning = [] } = useCleaningTasks();
  const { data: maintenance = [] } = useMaintenance();
  const { data: alerts = [] } = useAlerts();
  const { data: transactions = [] } = useTransactions();

  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));

  const checkIns = reservations.filter((r) => r.check_in === today);
  const checkOuts = reservations.filter((r) => r.check_out === today);
  const inHouse = reservations.filter((r) => r.check_in <= today && r.check_out > today);
  const cleaningToday = cleaning.filter((c) => c.scheduled_date === today);
  const openIssues = maintenance.filter((m) => m.status !== "resuelta");
  const blocking = openIssues.filter((m) => m.blocks_guests);

  const month = today.slice(0, 7);
  const monthTx = transactions.filter((t) => t.occurred_on.startsWith(month));
  const income = monthTx.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const occupancy = properties.length ? Math.round((inHouse.length / properties.length) * 100) : 0;
  const pendingPayments = reservations.filter((r) => r.payment_status === "pendiente");

  return (
    <AppShell
      title="Panel del día"
      subtitle={new Date().toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ocupación hoy" value={`${occupancy}%`} detail={`${inHouse.length} de ${properties.length} propiedades`} icon={BedDouble} />
        <Metric label="Entradas / salidas" value={`${checkIns.length} / ${checkOuts.length}`} detail="Movimientos programados hoy" icon={ArrowUpRight} />
        <Metric label="Limpiezas del día" value={`${cleaningToday.filter((c) => c.status !== "completada").length}`} detail={`${cleaningToday.length} programadas en total`} icon={Brush} />
        <Metric label="Mantenimiento abierto" value={`${openIssues.length}`} detail={`${blocking.length} bloquean recepción de huéspedes`} icon={Wrench} tone={blocking.length ? "danger" : "normal"} />
      </div>

      {alerts.filter((a) => !a.is_read).length > 0 && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" /> Requiere decisión hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts
              .filter((a) => !a.is_read)
              .slice(0, 4)
              .map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill value={a.severity} />
                  <span className="font-medium">{a.title}</span>
                  <span className="text-muted-foreground">{a.body}</span>
                </div>
              ))}
            <Link to="/alertas" className="inline-block pt-1 text-xs font-semibold text-primary underline-offset-4 hover:underline">
              Ver todas las alertas
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MovementList
          title="Entradas de hoy"
          empty="Sin entradas programadas."
          rows={checkIns.map((r) => ({
            id: r.id,
            main: propById[r.property_id]?.name ?? "Propiedad",
            sub: `${guestById[r.guest_id ?? ""]?.full_name ?? "Huésped"} · ${r.guests_count} pax · ${propById[r.property_id]?.check_in_time ?? "15:00"}`,
            status: r.status,
          }))}
        />
        <MovementList
          title="Salidas de hoy"
          empty="Sin salidas programadas."
          rows={checkOuts.map((r) => ({
            id: r.id,
            main: propById[r.property_id]?.name ?? "Propiedad",
            sub: `${guestById[r.guest_id ?? ""]?.full_name ?? "Huésped"} · salida ${propById[r.property_id]?.check_out_time ?? "11:00"}`,
            status: r.status,
          }))}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Limpiezas críticas (salida y entrada el mismo día)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cleaningToday.filter((c) => c.priority === "urgente" || c.next_checkin_time).length === 0 && (
              <p className="text-sm text-muted-foreground">Ninguna limpieza con ventana ajustada hoy.</p>
            )}
            {cleaningToday
              .filter((c) => c.priority === "urgente" || c.next_checkin_time)
              .slice(0, 6)
              .map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{propById[c.property_id]?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Salida {c.checkout_time ?? "—"} → entrada {c.next_checkin_time ?? "—"} · {c.assignee ?? "sin asignar"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={c.priority} />
                    <StatusPill value={c.status} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mes en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Ingresos" value={money(income)} tone="success" />
            <Row label="Egresos" value={money(expense)} tone="danger" />
            <Row label="Resultado neto" value={money(income - expense)} strong />
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">Cobros pendientes</p>
              <p className="font-display text-lg font-semibold">
                {pendingPayments.length} reservas ·{" "}
                {money(pendingPayments.reduce((s, r) => s + Number(r.total_amount), 0))}
              </p>
              <Link to="/finanzas" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                Revisar en finanzas
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Próximas 7 noches</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Propiedad</th>
                <th className="pb-2">Huésped</th>
                <th className="pb-2">Estancia</th>
                <th className="pb-2">Canal</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {reservations
                .filter((r) => r.check_in > today)
                .slice(0, 8)
                .map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 font-medium">{propById[r.property_id]?.name}</td>
                    <td className="py-2">{guestById[r.guest_id ?? ""]?.full_name ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {shortDate(r.check_in)} → {shortDate(r.check_out)}
                    </td>
                    <td className="py-2">{r.channel}</td>
                    <td className="py-2 text-right">{money(Number(r.total_amount))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BedDouble;
  tone?: "normal" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span
          className={
            tone === "danger"
              ? "grid size-9 place-items-center rounded-md bg-destructive/10 text-destructive"
              : "grid size-9 place-items-center rounded-md bg-primary/10 text-primary"
          }
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: "success" | "danger"; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-display text-base font-semibold"
            : tone === "success"
              ? "font-medium text-success"
              : tone === "danger"
                ? "font-medium text-destructive"
                : "font-medium"
        }
      >
        {tone === "danger" && <ArrowDownRight className="mr-1 inline size-3" />}
        {value}
      </span>
    </div>
  );
}

function MovementList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; main: string; sub: string; status: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{r.main}</p>
              <p className="text-xs text-muted-foreground">{r.sub}</p>
            </div>
            <StatusPill value={r.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
