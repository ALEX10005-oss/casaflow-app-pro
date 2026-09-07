import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, nightsBetween, useProperties, useReservations, useTransactions } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({ meta: [{ title: "Reportes — CasaFlow" }] }),
  component: Reportes,
});

function Reportes() {
  const { data: reservations = [] } = useReservations();
  const { data: properties = [] } = useProperties();
  const { data: transactions = [] } = useTransactions();
  const [propertyId, setPropertyId] = useState("all");
  const [group, setGroup] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const groups = useMemo(
    () => [...new Set(properties.map((p) => p.location?.trim()).filter(Boolean) as string[])].sort(),
    [properties],
  );
  const allowedPropertyIds = useMemo(() => {
    return new Set(
      properties
        .filter((p) => (group === "all" || p.location === group) && (propertyId === "all" || p.id === propertyId))
        .map((p) => p.id),
    );
  }, [properties, group, propertyId]);

  const filtered = reservations.filter((r) => {
    if (!allowedPropertyIds.has(r.property_id)) return false;
    if (from && r.check_out <= from) return false;
    if (to && r.check_in > to) return false;
    return true;
  });

  const nights = filtered.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0);
  const gross = filtered.reduce((s, r) => s + Number(r.total_amount), 0);
  const adr = nights ? gross / nights : 0;
  const airbnb = filtered.filter((r) => r.channel.toLowerCase() === "airbnb");
  const airbnbRevenue = airbnb.reduce((s, r) => s + Number(r.total_amount), 0);

  const months = Array.from(new Set(filtered.map((r) => r.check_in.slice(0, 7)))).sort();
  const monthly = months.map((m) => {
    const rs = filtered.filter((r) => r.check_in.startsWith(m));
    const n = rs.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0);
    const selectedProperties = Math.max(1, allowedPropertyIds.size);
    const capacity = selectedProperties * 30;
    return { m, nights: n, revenue: rs.reduce((s, r) => s + Number(r.total_amount), 0), occ: capacity ? Math.min(100, Math.round((n / capacity) * 100)) : 0 };
  });

  const channels = filtered.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
    const c = (acc[r.channel] ??= { count: 0, revenue: 0 });
    c.count += 1;
    c.revenue += Number(r.total_amount);
    return acc;
  }, {});
  const maxRevenue = Math.max(...Object.values(channels).map((c) => c.revenue), 1);

  const ranking = properties
    .filter((p) => allowedPropertyIds.has(p.id))
    .map((p) => {
      const rs = filtered.filter((r) => r.property_id === p.id);
      return { p, revenue: rs.reduce((s, r) => s + Number(r.total_amount), 0), nights: rs.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0) };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const expenses = transactions.filter((t) => {
    if (t.kind !== "expense") return false;
    if (from && t.occurred_on < from) return false;
    if (to && t.occurred_on > to) return false;
    return true;
  }).reduce((s, t) => s + Number(t.amount), 0);

  return (
    <AppShell title="Reportes" subtitle="Filtra por alojamiento, fecha y grupo; las reservas Airbnb importadas por CSV están incluidas">
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Field label="Alojamiento">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="all">Todos</option>
              {properties.filter((p) => group === "all" || p.location === group).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Grupo">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={group} onChange={(e) => { setGroup(e.target.value); setPropertyId("all"); }}>
              <option value="all">Todos los grupos</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Reservas" value={String(filtered.length)} />
        <Kpi label="Noches vendidas" value={String(nights)} />
        <Kpi label="Tarifa promedio (ADR)" value={money(adr)} />
        <Kpi label="Ingreso bruto" value={money(gross)} />
        <Kpi label="Airbnb" value={`${airbnb.length} · ${money(airbnbRevenue)}`} />
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Ocupación e ingresos por mes</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            {monthly.map((r) => (
              <div key={r.m} className="flex min-w-[72px] flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-medium">{r.occ}%</span>
                <div className="flex h-40 w-full items-end rounded-md bg-muted"><div className="w-full rounded-md bg-primary" style={{ height: `${r.occ}%` }} /></div>
                <span className="text-[11px] text-muted-foreground">{r.m}</span>
                <span className="text-[10px] text-muted-foreground">{money(r.revenue)}</span>
              </div>
            ))}
            {monthly.length === 0 && <p className="py-8 text-sm text-muted-foreground">No hay reservas para estos filtros.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Canales</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(channels).map(([name, c]) => (
              <div key={name}>
                <div className="flex justify-between text-sm"><span className="font-medium">{name}</span><span className="text-muted-foreground">{c.count} reservas · {money(c.revenue)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-accent" style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Alojamientos</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {ranking.map((r, i) => (
              <div key={r.p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{i + 1}. {r.p.name}<span className="block text-[11px] text-muted-foreground">Grupo: {r.p.location || "Sin grupo"}</span></span>
                <span className="text-right"><span className="font-medium">{money(r.revenue)}</span><span className="block text-[11px] text-muted-foreground">{r.nights} noches</span></span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">Gasto acumulado en el rango seleccionado: {money(expenses)}. El campo Grupo usa actualmente la ubicación registrada de cada alojamiento.</p>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="font-display text-2xl font-semibold">{value}</p></CardContent></Card>; }
