import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  money,
  nightsBetween,
  shortDate,
  todayISO,
  useBlocks,
  useExternalEvents,
  useGuests,
  useProperties,
  useReservations,
} from "@/lib/casaflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario anual PMS — CasaFlow" },
      {
        name: "description",
        content: "Disponibilidad anual multipropiedad con reservas, iCal, bloqueos y mantenimiento.",
      },
      { property: "og:title", content: "Calendario anual PMS — CasaFlow" },
      { property: "og:description", content: "Disponibilidad de toda la cartera durante el año." },
    ],
  }),
  component: Calendario,
});

const DAY_WIDTH = 18;
const PROPERTY_WIDTH = 220;

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-destructive/85 text-destructive-foreground",
  Booking: "bg-primary text-primary-foreground",
  "Booking.com": "bg-primary text-primary-foreground",
  VRBO: "bg-success/85 text-success-foreground",
  Expedia: "bg-warning text-warning-foreground",
  directo: "bg-accent text-accent-foreground",
  Directo: "bg-accent text-accent-foreground",
};

function dayDiff(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function Calendario() {
  const currentYear = Number(todayISO().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const daysInYear = dayDiff(yearStart, yearEnd);
  const timelineWidth = daysInYear * DAY_WIDTH;

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => {
        const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const next = month === 11
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 2).padStart(2, "0")}-01`;
        return {
          name: new Date(`${start}T12:00:00`).toLocaleDateString("es-MX", { month: "long" }),
          startIndex: dayDiff(yearStart, start),
          days: dayDiff(start, next),
        };
      }),
    [year, yearStart],
  );

  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: external = [] } = useExternalEvents();
  const { data: guests = [] } = useGuests();
  const { data: blocks = [] } = useBlocks();
  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));

  const visibleReservations = reservations
    .filter(
      (r) => r.check_in < yearEnd && r.check_out > yearStart && !["cancelada", "cancelled", "no_show"].includes(r.status),
    )
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  const selectedReservation = selectedReservationId
    ? reservations.find((r) => r.id === selectedReservationId) ?? null
    : null;
  const selectedGuest = selectedReservation?.guest_id
    ? guestById[selectedReservation.guest_id]
    : null;
  const selectedProperty = selectedReservation
    ? propById[selectedReservation.property_id]
    : null;

  const todayIndex = year === currentYear ? dayDiff(yearStart, todayISO()) : -1;

  return (
    <AppShell
      title="Calendario anual"
      subtitle={`${properties.length} propiedades · reservas + iCal · disponibilidad ${year}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear(year - 1)} aria-label="Año anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setYear(currentYear)}>{year}</Button>
          <Button variant="outline" size="icon" onClick={() => setYear(year + 1)} aria-label="Año siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {["Airbnb", "Booking", "VRBO", "Expedia", "Directo"].map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHANNEL_COLOR[c])} /> {c}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted-foreground/40" /> Bloqueo / mantenimiento
        </span>
        <span className="text-muted-foreground">Toca una reserva para ver entrada, salida y datos completos.</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
            <div className="sticky top-0 z-20 flex border-b bg-card">
              <div
                className="sticky left-0 z-30 shrink-0 border-r bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: PROPERTY_WIDTH }}
              >
                Propiedad
              </div>
              <div className="relative flex" style={{ width: timelineWidth }}>
                {months.map((m) => (
                  <div
                    key={m.name}
                    className="shrink-0 border-r px-2 py-2 text-center text-xs font-semibold capitalize"
                    style={{ width: m.days * DAY_WIDTH }}
                  >
                    {m.name}
                  </div>
                ))}
              </div>
            </div>

            {properties.map((p) => {
              const rows = reservations.filter(
                (r) => r.property_id === p.id && r.check_in < yearEnd && r.check_out > yearStart && !["cancelada", "cancelled", "no_show"].includes(r.status),
              );
              const ext = external.filter(
                (e) => e.property_id === p.id && e.start_date < yearEnd && e.end_date > yearStart && e.status !== "cancelled",
              );
              const bl = blocks.filter(
                (b) => b.property_id === p.id && b.start_date < yearEnd && b.end_date > yearStart,
              );

              const timeline = [
                ...rows.map((r) => ({
                  id: `r-${r.id}`,
                  reservationId: r.id,
                  from: r.check_in,
                  to: r.check_out,
                  channel: r.channel,
                  label: `${guestById[r.guest_id ?? ""]?.full_name ?? r.code} · ${shortDate(r.check_in)} → ${shortDate(r.check_out)}`,
                  title: `${guestById[r.guest_id ?? ""]?.full_name ?? "Huésped"} · ${r.channel} · Entrada ${shortDate(r.check_in)} · Salida ${shortDate(r.check_out)} · ${money(Number(r.total_amount))}`,
                  kind: "reservation" as const,
                })),
                ...ext.map((e) => ({
                  id: `e-${e.id}`,
                  reservationId: null,
                  from: e.start_date,
                  to: e.end_date,
                  channel: e.channel,
                  label: `${e.summary || e.channel} · ${shortDate(e.start_date)} → ${shortDate(e.end_date)}`,
                  title: `Importado por iCal · ${e.channel} · ${e.start_date} a ${e.end_date}`,
                  kind: "external" as const,
                })),
                ...bl.map((b) => ({
                  id: `b-${b.id}`,
                  reservationId: null,
                  from: b.start_date,
                  to: b.end_date,
                  channel: "",
                  label: `Bloqueado · ${shortDate(b.start_date)} → ${shortDate(b.end_date)}`,
                  title: `${b.reason || "Bloqueo"} · ${b.start_date} a ${b.end_date}`,
                  kind: "block" as const,
                })),
              ];

              return (
                <div key={p.id} className="flex border-b">
                  <div
                    className="sticky left-0 z-10 shrink-0 border-r bg-card px-3 py-2"
                    style={{ width: PROPERTY_WIDTH }}
                  >
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.code} · {p.location}</p>
                  </div>

                  <div className="relative h-[48px]" style={{ width: timelineWidth }}>
                    {months.slice(1).map((m) => (
                      <div
                        key={m.name}
                        className="absolute inset-y-0 border-l"
                        style={{ left: m.startIndex * DAY_WIDTH }}
                      />
                    ))}

                    {todayIndex >= 0 && todayIndex < daysInYear && (
                      <div
                        className="absolute inset-y-0 z-[1] w-px bg-primary/60"
                        style={{ left: todayIndex * DAY_WIDTH }}
                        title="Hoy"
                      />
                    )}

                    {timeline.map((item) => {
                      const startIndex = clamp(dayDiff(yearStart, item.from), 0, daysInYear);
                      const endIndex = clamp(dayDiff(yearStart, item.to), 0, daysInYear);
                      const widthDays = Math.max(1, endIndex - startIndex);
                      if (endIndex <= 0 || startIndex >= daysInYear) return null;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          title={item.title}
                          onClick={() => item.reservationId && setSelectedReservationId(item.reservationId)}
                          className={cn(
                            "absolute top-[9px] z-[2] flex h-[30px] items-center overflow-hidden rounded-md px-2 text-left text-[11px] font-medium shadow-sm",
                            item.kind === "block"
                              ? "bg-muted-foreground/40 text-foreground"
                              : CHANNEL_COLOR[item.channel] ?? "bg-primary text-primary-foreground",
                            item.kind === "external" && "ring-1 ring-inset ring-foreground/30",
                            item.kind === "reservation" && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          style={{
                            left: startIndex * DAY_WIDTH + 1,
                            width: Math.max(DAY_WIDTH - 2, widthDays * DAY_WIDTH - 2),
                          }}
                        >
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedReservation && (
        <Card className="mt-4 border-primary/20">
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalle de reserva</p>
                <h2 className="text-lg font-semibold">{selectedGuest?.full_name ?? "Huésped"}</h2>
                <p className="text-sm text-muted-foreground">{selectedProperty?.name ?? "Propiedad"} · {selectedReservation.channel}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReservationId(null)}>Cerrar</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Entrada</p>
                <p className="font-semibold">{shortDate(selectedReservation.check_in)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Salida</p>
                <p className="font-semibold">{shortDate(selectedReservation.check_out)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Noches</p>
                <p className="font-semibold">{nightsBetween(selectedReservation.check_in, selectedReservation.check_out)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="font-semibold capitalize">{selectedReservation.status}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="text-muted-foreground">Correo:</span> {selectedGuest?.email ?? "—"}</p>
              <p><span className="text-muted-foreground">Teléfono:</span> {selectedGuest?.phone ?? "—"}</p>
              <p><span className="text-muted-foreground">Código:</span> {selectedReservation.code}</p>
              <p><span className="text-muted-foreground">Total:</span> {money(Number(selectedReservation.total_amount))}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="overflow-x-auto p-0">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Entradas y salidas {year}</h2>
            <p className="text-xs text-muted-foreground">Vista rápida con las fechas exactas de cada estancia.</p>
          </div>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Huésped</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibleReservations.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b hover:bg-muted/30"
                  onClick={() => setSelectedReservationId(r.id)}
                >
                  <td className="px-4 py-3 font-medium">{propById[r.property_id]?.name ?? "—"}</td>
                  <td className="px-4 py-3">{guestById[r.guest_id ?? ""]?.full_name ?? "Huésped"}</td>
                  <td className="px-4 py-3 font-medium">{shortDate(r.check_in)}</td>
                  <td className="px-4 py-3 font-medium">{shortDate(r.check_out)}</td>
                  <td className="px-4 py-3">{r.channel}</td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                </tr>
              ))}
              {visibleReservations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin reservas para este año.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
