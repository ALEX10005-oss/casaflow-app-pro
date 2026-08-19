import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, shortDate, todayISO, useProperties, useReservations, useTransactions } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({
    meta: [
      { title: "Finanzas y rentabilidad — CasaFlow" },
      {
        name: "description",
        content: "Ingresos, comisiones de canal, gastos operativos y resultado neto por propiedad y por mes.",
      },
      { property: "og:title", content: "Finanzas — CasaFlow" },
      { property: "og:description", content: "Resultado neto y cobros pendientes de tu operación vacacional." },
    ],
  }),
  component: Finanzas,
});

function Finanzas() {
  const { data: transactions = [] } = useTransactions();
  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const months = Array.from(new Set(transactions.map((t) => t.occurred_on.slice(0, 7)))).sort().reverse();
  const [month, setMonth] = useState(months[0] ?? todayISO().slice(0, 7));

  const rows = transactions.filter((t) => t.occurred_on.startsWith(month));
  const income = rows.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = rows.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const commissions = rows
    .filter((t) => t.category.toLowerCase().includes("comision"))
    .reduce((s, t) => s + Number(t.amount), 0);

  const byProperty = properties
    .map((p) => {
      const pr = rows.filter((t) => t.property_id === p.id);
      const inc = pr.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
      const exp = pr.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { p, inc, exp, net: inc - exp };
    })
    .sort((a, b) => b.net - a.net);

  const pending = reservations.filter((r) => r.payment_status === "pendiente");

  return (
    <AppShell
      title="Finanzas"
      subtitle="Ingresos, comisiones y gastos consolidados"
      actions={
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ingresos" value={money(income)} />
        <Kpi label="Comisiones de canal" value={money(commissions)} />
        <Kpi label="Gastos operativos" value={money(expense)} />
        <Kpi label="Resultado neto" value={money(income - expense)} highlight />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rentabilidad por propiedad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byProperty.slice(0, 10).map(({ p, inc, exp, net }) => {
              const max = Math.max(...byProperty.map((b) => Math.abs(b.net)), 1);
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className={net >= 0 ? "text-success" : "text-destructive"}>{money(net)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className={net >= 0 ? "h-2 rounded-full bg-success" : "h-2 rounded-full bg-destructive"}
                      style={{ width: `${(Math.abs(net) / max) * 100}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Ingresos {money(inc)} · gastos {money(exp)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cobros pendientes ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Todo cobrado.</p>}
            {pending.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{propById[r.property_id]?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.code} · {shortDate(r.check_in)} · {r.channel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{money(Number(r.total_amount))}</p>
                  <StatusPill value={r.payment_status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimientos del periodo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground">{shortDate(t.occurred_on)}</td>
                  <td className="px-4 py-2.5">{t.description ?? t.category}</td>
                  <td className="px-4 py-2.5">{t.property_id ? propById[t.property_id]?.name : "General"}</td>
                  <td className="px-4 py-2.5 capitalize">{t.category}</td>
                  <td
                    className={
                      t.kind === "income"
                        ? "px-4 py-2.5 text-right font-medium text-success"
                        : "px-4 py-2.5 text-right font-medium text-destructive"
                    }
                  >
                    {t.kind === "income" ? "+" : "−"}
                    {money(Number(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-accent/50 bg-accent/10" : ""}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
