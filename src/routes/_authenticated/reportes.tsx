import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  money,
  nightsBetween,
  useProperties,
  useReservations,
  useTransactions,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes de ocupación y desempeño — CasaFlow" },
      {
        name: "description",
        content:
          "Ocupación mensual, tarifa promedio por noche, mezcla de canales y ranking de propiedades.",
      },
      { property: "og:title", content: "Reportes — CasaFlow" },
      { property: "og:description", content: "Indicadores de desempeño de la cartera vacacional." },
    ],
  }),
  component: Reportes,
});

function Reportes() {
  const { data: reservations = [] } = useReservations();
  const { data: properties = [] } = useProperties();
  const { data: transactions = [] } = useTransactions();
  const [propertyId, setPropertyId] = useState("");
  const [location, setLocation] = useState("");
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const locations = useMemo(
    () =>
      Array.from(new Set(properties.map((property) => property.location).filter(Boolean))).sort(),
    [properties],
  );
  const channelsList = useMemo(
    () => Array.from(new Set(reservations.map((reservation) => reservation.channel))).sort(),
    [reservations],
  );
  const allowedPropertyIds = new Set(
    properties
      .filter((property) => !location || property.location === location)
      .map((property) => property.id),
  );
  const filtered = reservations.filter(
    (reservation) =>
      !["cancelada", "cancelled"].includes(reservation.status) &&
      (!propertyId || reservation.property_id === propertyId) &&
      (!location || allowedPropertyIds.has(reservation.property_id)) &&
      (!channel || reservation.channel === channel) &&
      (!from || reservation.check_out >= from) &&
      (!to || reservation.check_in <= to),
  );

  const nights = filtered.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0);
  const gross = filtered.reduce((s, r) => s + Number(r.total_amount), 0);
  const adr = nights ? gross / nights : 0;

  const months = Array.from(new Set(filtered.map((r) => r.check_in.slice(0, 7)))).sort();
  const monthly = months.map((m) => {
    const rs = filtered.filter((r) => r.check_in.startsWith(m));
    const n = rs.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0);
    const capacity = properties.length * 30;
    return {
      m,
      nights: n,
      revenue: rs.reduce((s, r) => s + Number(r.total_amount), 0),
      occ: capacity ? Math.min(100, Math.round((n / capacity) * 100)) : 0,
    };
  });

  const channels = filtered.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
    const c = (acc[r.channel] ??= { count: 0, revenue: 0 });
    c.count += 1;
    c.revenue += Number(r.total_amount);
    return acc;
  }, {});
  const maxRevenue = Math.max(...Object.values(channels).map((c) => c.revenue), 1);

  const ranking = properties
    .map((p) => {
      const rs = filtered.filter((r) => r.property_id === p.id);
      return {
        p,
        revenue: rs.reduce((s, r) => s + Number(r.total_amount), 0),
        nights: rs.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const relevantTransactions = transactions.filter(
    (transaction) =>
      (!propertyId || transaction.property_id === propertyId) &&
      (!from || transaction.occurred_on >= from) &&
      (!to || transaction.occurred_on <= to),
  );
  const expenses = relevantTransactions
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const profit = gross - expenses;
  const averageStay = filtered.length ? nights / filtered.length : 0;

  return (
    <AppShell title="Reportes" subtitle="Desempeño histórico y proyectado de la cartera">
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-xs font-medium">
            Desde
            <input
              className="h-9 rounded-md border bg-background px-2"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Hasta
            <input
              className="h-9 rounded-md border bg-background px-2"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Alojamiento
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
            >
              <option value="">Todos</option>
              {properties
                .filter((property) => !location || property.location === location)
                .map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Grupo / ubicación
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPropertyId("");
              }}
            >
              <option value="">Todos</option>
              {locations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Canal
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="">Todos</option>
              {channelsList.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Noches vendidas" value={String(nights)} />
        <Kpi label="Tarifa promedio (ADR)" value={money(adr)} />
        <Kpi label="Ingreso bruto" value={money(gross)} />
        <Kpi label="Gasto acumulado" value={money(expenses)} />
        <Kpi label="Utilidad estimada" value={money(profit)} />
        <Kpi label="Reservaciones" value={String(filtered.length)} />
        <Kpi label="Estancia promedio" value={`${averageStay.toFixed(1)} noches`} />
        <Kpi
          label="Propiedades incluidas"
          value={String(propertyId ? 1 : allowedPropertyIds.size)}
        />
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ocupación e ingresos por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            {monthly.map((r) => (
              <div key={r.m} className="flex min-w-[64px] flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-medium">{r.occ}%</span>
                <div className="flex h-40 w-full items-end rounded-md bg-muted">
                  <div className="w-full rounded-md bg-primary" style={{ height: `${r.occ}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {r.m.slice(5)}/{r.m.slice(2, 4)}
                </span>
                <span className="text-[10px] text-muted-foreground">{money(r.revenue)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mezcla de canales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(channels).map(([name, c]) => (
              <div key={name}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground">
                    {c.count} reservas · {money(c.revenue)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${(c.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de propiedades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {ranking.slice(0, 10).map((r, i) => (
              <div
                key={r.p.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  {r.p.name}
                </span>
                <span className="text-right">
                  <span className="font-medium">{money(r.revenue)}</span>
                  <span className="block text-[11px] text-muted-foreground">{r.nights} noches</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
