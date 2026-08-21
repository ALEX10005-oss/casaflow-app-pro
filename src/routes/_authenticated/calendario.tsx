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
      { title: "Planning de ocupación — CasaFlow" },
      {
        name: "description",
        content: "Planning mensual multipropiedad con entradas, salidas, reservas y bloqueos.",
      },
    ],
  }),
  component: Calendario,
});

const DAY_WIDTH = 58;
const PROPERTY_WIDTH = 210;

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-destructive/85 text-destructive-foreground",
  airbnb: "bg-destructive/85 text-destructive-foreground",
  Booking: "bg-primary text-primary-foreground",
  "Booking.com": "bg-primary text-primary-foreground",
  booking: "bg-primary text-primary-foreground",
  VRBO: "bg-success/85 text-success-foreground",
  vrbo: "bg-success/85 text-success-foreground",
  Expedia: "bg-warning text-warning-foreground",
  expedia: "bg-warning text-warning-foreground",
  directo: "bg-accent text-accent-foreground",
  Directo: "bg-accent text-accent-foreground",
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayDiff(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function Calendario() {
  const now = new Date(`${todayISO()}T12:00:00`);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = isoDate(year, month, 1);
  const monthEnd = month === 11 ? `${year + 1}-01-01` : isoDate(year, month + 1, 1);
  const timelineWidth = daysInMonth * DAY_WIDTH;

  const monthLabel = cursor.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const iso = isoDate(year, month, day);
        const d = new Date(`${iso}T12:00:00`);
        return {
          day,
          iso,
          weekday: d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", ""),
          weekend: d.getDay() === 0 || d.getDay() === 6,
          today: iso === todayISO(),
        };
      }),
    [daysInMonth, month, year],
  );

  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: external = [] } = useExternalEvents();
  const { data: guests = [] } = useGuests();
  const { data: blocks = [] } = useBlocks();

  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));

  const selectedReservation = selectedReservationId
    ? reservations.find((r) => r.id === selectedReservationId) ?? null
    : null;
  const selectedGuest = selectedReservation?.guest_id ? guestById[selectedReservation.guest_id] : null;
  const selectedProperty = selectedReservation ? propById[selectedReservation.property_id] : null;

  const changeMonth = (delta: number) => {
    setCursor((value) => new Date(value.getFullYear(), value.getMonth() + delta, 1));
    setSelectedReservationId(null);
  };

  return (
    <AppShell
      title="Planning de ocupación"
      subtitle="Propiedades por fila · días por columna · reservas visibles de un vistazo"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="min-w-36 capitalize" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>
            {monthLabel}
          </Button>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        {["Airbnb", "Booking", "VRBO", "Expedia", "Directo"].map((channel) => (
          <span key={channel} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHANNEL_COLOR[channel])} /> {channel}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted-foreground/40" /> Bloqueo
        </span>
        <span className="text-muted-foreground">Toca una reserva para abrir su detalle.</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
            <div className="sticky top-0 z-30 flex border-b bg-card shadow-sm">
              <div
                className="sticky left-0 z-40 shrink-0 border-r bg-card px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: PROPERTY_WIDTH }}
              >
                Propiedad
              </div>
              <div className="flex" style={{ width: timelineWidth }}>
                {days.map((d) => (
                  <div
                    key={d.iso}
                    className={cn(
                      "shrink-0 border-r px-1 py-2 text-center",
                      d.weekend && "bg-muted/35",
                      d.today && "bg-primary/10",
                    )}
                    style={{ width: DAY_WIDTH }}
                  >
                    <div className="text-[10px] uppercase text-muted-foreground">{d.weekday}</div>
                    <div className={cn("text-sm font-semibold", d.today && "text-primary")}>{d.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {properties.map((property) => {
              const propertyReservations = reservations.filter(
                (r) =>
                  r.property_id === property.id &&
                  r.check_in < monthEnd &&
                  r.check_out > monthStart &&
                  !["cancelada", "cancelled", "no_show"].includes(r.status),
              );
              const propertyExternal = external.filter(
                (e) => e.property_id === property.id && e.start_date < monthEnd && e.end_date > monthStart && e.status !== "cancelled",
              );
              const propertyBlocks = blocks.filter(
                (b) => b.property_id === property.id && b.start_date < monthEnd && b.end_date > monthStart,
              );

              const items = [
                ...propertyReservations.map((r) => ({
                  id: `r-${r.id}`,
                  reservationId: r.id,
                  from: r.check_in,
                  to: r.check_out,
                  channel: r.channel,
                  label: guestById[r.guest_id ?? ""]?.full_name ?? r.code,
                  secondary: `${r.guests_count ?? 0} huésp.`,
                  kind: "reservation" as const,
                })),
                ...propertyExternal.map((e) => ({
                  id: `e-${e.id}`,
                  reservationId: null,
                  from: e.start_date,
                  to: e.end_date,
                  channel: e.channel,
                  label: e.summary || e.channel,
                  secondary: "iCal",
                  kind: "external" as const,
                })),
                ...propertyBlocks.map((b) => ({
                  id: `b-${b.id}`,
                  reservationId: null,
                  from: b.start_date,
                  to: b.end_date,
                  channel: "",
                  label: b.reason || "Bloqueado",
                  secondary: "Bloqueo",
                  kind: "block" as const,
                })),
              ];

              return (
                <div key={property.id} className="flex border-b">
                  <div
                    className="sticky left-0 z-20 flex h-[64px] shrink-0 items-center border-r bg-card px-3"
                    style={{ width: PROPERTY_WIDTH }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{property.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{property.code} · {property.location}</p>
                    </div>
                  </div>

                  <div className="relative h-[64px]" style={{ width: timelineWidth }}>
                    {days.map((d, index) => (
                      <div
                        key={d.iso}
                        className={cn(
                          "absolute inset-y-0 border-r",
                          d.weekend && "bg-muted/25",
                          d.today && "bg-primary/5",
                        )}
                        style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                      />
                    ))}

                    {items.map((item) => {
                      const visibleFrom = item.from < monthStart ? monthStart : item.from;
                      const visibleTo = item.to > monthEnd ? monthEnd : item.to;
                      const startIndex = dayDiff(monthStart, visibleFrom);
                      const widthDays = Math.max(1, dayDiff(visibleFrom, visibleTo));
                      if (startIndex >= daysInMonth || startIndex + widthDays <= 0) return null;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.reservationId && setSelectedReservationId(item.reservationId)}
                          title={`${item.label} · ${shortDate(item.from)} → ${shortDate(item.to)}`}
                          className={cn(
                            "absolute top-[10px] z-10 h-[44px] overflow-hidden rounded-md px-2 text-left shadow-sm",
                            item.kind === "block"
                              ? "bg-muted-foreground/40 text-foreground"
                              : CHANNEL_COLOR[item.channel] ?? "bg-primary text-primary-foreground",
                            item.kind === "external" && "ring-2 ring-inset ring-foreground/20",
                            item.kind === "reservation" && "cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          style={{
                            left: startIndex * DAY_WIDTH + 2,
                            width: Math.max(DAY_WIDTH - 4, widthDays * DAY_WIDTH - 4),
                          }}
                        >
                          <span className="block truncate text-xs font-semibold">{item.label}</span>
                          <span className="block truncate text-[10px] opacity-90">
                            {shortDate(item.from)} → {shortDate(item.to)} · {item.secondary}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {properties.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No hay propiedades para mostrar.</div>
            )}
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
                <p className="text-sm text-muted-foreground">
                  {selectedProperty?.name ?? "Propiedad"} · {selectedReservation.channel}
                </p>
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
    </AppShell>
  );
}
