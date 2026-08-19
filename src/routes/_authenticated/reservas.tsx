import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, nightsBetween, shortDate, useGuests, useProperties, useReservations } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas consolidadas — CasaFlow" },
      {
        name: "description",
        content: "Consulta y filtra todas las reservas importadas desde Airbnb, Booking, VRBO y canal directo.",
      },
      { property: "og:title", content: "Reservas — CasaFlow" },
      { property: "og:description", content: "Todas las reservas de tus canales en una sola tabla, solo lectura." },
    ],
  }),
  component: Reservas,
});

function Reservas() {
  const { data: reservations = [] } = useReservations();
  const { data: properties = [] } = useProperties();
  const { data: guests = [] } = useGuests();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [property, setProperty] = useState("all");

  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));

  const rows = reservations.filter((r) => {
    const guest = guestById[r.guest_id ?? ""]?.full_name ?? "";
    const text = `${r.code} ${guest} ${propById[r.property_id]?.name ?? ""}`.toLowerCase();
    return (
      (channel === "all" || r.channel === channel) &&
      (status === "all" || r.status === status) &&
      (property === "all" || r.property_id === property) &&
      text.includes(q.toLowerCase())
    );
  });

  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const commission = rows.reduce((s, r) => s + Number(r.commission), 0);

  return (
    <AppShell
      title="Reservas"
      subtitle="Origen externo: las reservas se sincronizan desde los canales, no se crean manualmente."
    >
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Código, huésped o propiedad" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Picker value={channel} onChange={setChannel} placeholder="Canal" options={["Airbnb", "Booking", "VRBO", "Web Directa"]} />
          <Picker value={status} onChange={setStatus} placeholder="Estado" options={["confirmada", "en_curso", "completada"]} />
          <Select value={property} onValueChange={setProperty}>
            <SelectTrigger>
              <SelectValue placeholder="Propiedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las propiedades</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Reservas filtradas" value={String(rows.length)} />
        <Stat label="Valor bruto" value={money(total)} />
        <Stat label="Comisión de canales" value={money(commission)} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Huésped</th>
                <th className="px-4 py-3">Estancia</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3 font-medium">{propById[r.property_id]?.name}</td>
                  <td className="px-4 py-3">{guestById[r.guest_id ?? ""]?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shortDate(r.check_in)} → {shortDate(r.check_out)} · {nightsBetween(r.check_in, r.check_out)} n
                  </td>
                  <td className="px-4 py-3">{r.channel}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{money(Number(r.total_amount))}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No hay reservas con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Picker({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos · {placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o.replace("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
