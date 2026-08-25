import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ReservationForm } from "@/components/reservation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canEditReservations,
  money,
  nightsBetween,
  shortDate,
  todayISO,
  useBlocks,
  useExternalEvents,
  useGuests,
  useMyContext,
  useProperties,
  useReservations,
} from "@/lib/casaflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendario PMS — CasaFlow" }] }),
  component: Calendario,
});

const PROPERTY_WIDTH = 240;
const DAY_WIDTH = 52;
const ROW_HEIGHT = 48;
const CANCELLED = ["cancelada", "cancelled", "no_show"];

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-rose-500 text-white border-rose-600",
  Booking: "bg-blue-600 text-white border-blue-700",
  "Booking.com": "bg-blue-600 text-white border-blue-700",
  VRBO: "bg-cyan-600 text-white border-cyan-700",
  Vrbo: "bg-cyan-600 text-white border-cyan-700",
  Expedia: "bg-violet-600 text-white border-violet-700",
  directo: "bg-amber-400 text-slate-950 border-amber-500",
  Directo: "bg-amber-400 text-slate-950 border-amber-500",
};

function dayDiff(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Calendario() {
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const [anchor, setAnchor] = useState(today);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { data: myCtx } = useMyContext();

  const year = Number(anchor.slice(0, 4));
  const rangeStart = year === currentYear ? startOfMonth(today) : `${year}-01-01`;
  const rangeEnd = `${year + 1}-01-01`;
  const totalDays = dayDiff(rangeStart, rangeEnd);
  const timelineWidth = totalDays * DAY_WIDTH;
  const monthLabel = new Date(`${rangeStart}T12:00:00`).toLocaleDateString("es-MX", { month: "long" });
  const label = year === currentYear ? `${year} · desde ${monthLabel}` : String(year);

  const columns = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => shift(rangeStart, i)),
    [rangeStart, totalDays],
  );

  const monthGroups = useMemo(() => {
    const groups: { key: string; name: string; startIndex: number; days: number }[] = [];
    columns.forEach((iso, index) => {
      const key = iso.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last?.key === key) {
        last.days += 1;
      } else {
        groups.push({
          key,
          name: new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { month: "long" }),
          startIndex: index,
          days: 1,
        });
      }
    });
    return groups;
  }, [columns]);

  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: external = [] } = useExternalEvents();
  const { data: guests = [] } = useGuests();
  const { data: blocks = [] } = useBlocks();

  const guestById = Object.fromEntries(guests.map((guest) => [guest.id, guest]));
  const propertyById = Object.fromEntries(properties.map((property) => [property.id, property]));

  const selectedReservation = selectedReservationId
    ? reservations.find((reservation) => reservation.id === selectedReservationId) ?? null
    : null;
  const selectedGuest = selectedReservation?.guest_id ? guestById[selectedReservation.guest_id] : null;
  const selectedProperty = selectedReservation ? propertyById[selectedReservation.property_id] : null;
  const todayIndex = today >= rangeStart && today < rangeEnd ? dayDiff(rangeStart, today) : -1;
  const todayScrollLeft = Math.max(0, (todayIndex - 4) * DAY_WIDTH);

  useEffect(() => {
    if (year !== currentYear || todayIndex < 0 || !scrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [year, currentYear, todayIndex, todayScrollLeft, properties.length]);

  const goToday = () => {
    setAnchor(today);
    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "smooth" });
    });
  };

  return (
    <AppShell
      title="Calendario"
      subtitle={`${properties.length} propiedades · calendario de ocupación · ${label}`}
      actions={
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setAnchor(`${year - 1}-01-01`)} aria-label="Año anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(`${year + 1}-01-01`)} aria-label="Año siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-xs shadow-sm">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-rose-500" /> Airbnb</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-blue-600" /> Booking</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-cyan-600" /> VRBO</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-amber-400" /> Directo</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-slate-500" /> Bloqueo</span>
        <span className="ml-auto text-muted-foreground">Los días libres permanecen neutros para que las reservas destaquen.</span>
      </div>

      <Card className="overflow-hidden border bg-background shadow-sm">
        <CardContent ref={scrollRef} className="overflow-x-auto p-0">
          <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
            <div className="sticky top-0 z-30 border-b bg-background shadow-sm">
              <div className="flex">
                <div
                  className="sticky left-0 z-40 shrink-0 border-r bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ width: PROPERTY_WIDTH }}
                >
                  Propiedad
                </div>
                <div className="flex" style={{ width: timelineWidth }}>
                  {monthGroups.map((month) => (
                    <div
                      key={month.key}
                      className="relative shrink-0 border-r bg-muted/25 py-3 text-sm font-semibold capitalize text-foreground"
                      style={{ width: month.days * DAY_WIDTH }}
                    >
                      <span className="inline-block whitespace-nowrap px-3" style={{ position: "sticky", left: PROPERTY_WIDTH + 12 }}>
                        {month.name} {year}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex border-t bg-background">
                <div className="sticky left-0 z-40 shrink-0 border-r bg-background" style={{ width: PROPERTY_WIDTH }} />
                <div className="flex" style={{ width: timelineWidth }}>
                  {columns.map((iso) => {
                    const d = new Date(`${iso}T12:00:00`);
                    const isWeekend = [0, 6].includes(d.getDay());
                    return (
                      <div
                        key={iso}
                        className={cn(
                          "shrink-0 border-r py-2 text-center leading-tight",
                          isWeekend ? "bg-muted/35" : "bg-background",
                          iso === today && "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-300",
                        )}
                        style={{ width: DAY_WIDTH }}
                      >
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">
                          {d.toLocaleDateString("es-MX", { weekday: "narrow" })}
                        </div>
                        <div className="mt-0.5 text-sm font-semibold">{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {properties.map((property, propertyIndex) => {
              const propertyReservations = reservations.filter(
                (reservation) =>
                  reservation.property_id === property.id &&
                  reservation.check_in < rangeEnd &&
                  reservation.check_out > rangeStart &&
                  !CANCELLED.includes(reservation.status),
              );
              const propertyExternal = external.filter(
                (event) =>
                  event.property_id === property.id &&
                  event.start_date < rangeEnd &&
                  event.end_date > rangeStart &&
                  event.status !== "cancelled",
              );
              const propertyBlocks = blocks.filter(
                (block) => block.property_id === property.id && block.start_date < rangeEnd && block.end_date > rangeStart,
              );

              const timeline = [
                ...propertyReservations.map((reservation) => ({
                  id: `r-${reservation.id}`,
                  reservationId: reservation.id,
                  from: reservation.check_in,
                  to: reservation.check_out,
                  name: guestById[reservation.guest_id ?? ""]?.full_name ?? reservation.code,
                  channel: reservation.channel,
                  kind: "reservation" as const,
                })),
                ...propertyExternal.map((event) => ({
                  id: `e-${event.id}`,
                  reservationId: null,
                  from: event.start_date,
                  to: event.end_date,
                  name: event.summary || event.channel,
                  channel: event.channel,
                  kind: "external" as const,
                })),
                ...propertyBlocks.map((block) => ({
                  id: `b-${block.id}`,
                  reservationId: null,
                  from: block.start_date,
                  to: block.end_date,
                  name: block.reason || "Bloqueado",
                  channel: "",
                  kind: "block" as const,
                })),
              ];

              return (
                <div key={property.id} className="flex border-b bg-background">
                  <div
                    className={cn(
                      "sticky left-0 z-20 shrink-0 border-r px-4 py-2.5",
                      propertyIndex % 2 === 0 ? "bg-background" : "bg-muted/15",
                    )}
                    style={{ width: PROPERTY_WIDTH, height: ROW_HEIGHT }}
                  >
                    <p className="truncate text-sm font-semibold text-foreground">{property.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{property.code} · {property.location}</p>
                  </div>

                  <div className="relative bg-background" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                    {columns.map((iso, index) => {
                      const d = new Date(`${iso}T12:00:00`);
                      const isWeekend = [0, 6].includes(d.getDay());
                      return (
                        <div
                          key={iso}
                          className={cn(
                            "absolute inset-y-0 border-r",
                            isWeekend ? "bg-muted/20" : "bg-background",
                          )}
                          style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                        />
                      );
                    })}

                    {monthGroups.slice(1).map((month) => (
                      <div
                        key={`month-${month.key}`}
                        className="absolute inset-y-0 z-[2] border-l-2 border-border"
                        style={{ left: month.startIndex * DAY_WIDTH }}
                      />
                    ))}

                    {todayIndex >= 0 && (
                      <div
                        className="absolute inset-y-0 z-[4] w-0.5 bg-rose-400"
                        style={{ left: todayIndex * DAY_WIDTH }}
                        title="Hoy"
                      />
                    )}

                    {timeline.map((item) => {
                      const rawStart = dayDiff(rangeStart, item.from);
                      const rawEnd = dayDiff(rangeStart, item.to);
                      if (rawEnd <= 0 || rawStart >= totalDays) return null;
                      const startIndex = clamp(rawStart, 0, totalDays);
                      const endIndex = clamp(rawEnd, 0, totalDays);
                      const widthDays = Math.max(1, endIndex - startIndex);
                      const width = Math.max(DAY_WIDTH, widthDays * DAY_WIDTH - 6);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.reservationId && setSelectedReservationId(item.reservationId)}
                          title={`${item.name} · ${shortDate(item.from)} → ${shortDate(item.to)}`}
                          className={cn(
                            "absolute top-1.5 z-[5] flex h-[36px] items-center overflow-hidden rounded-xl border px-3 text-left text-xs font-semibold shadow-sm transition",
                            item.kind === "block"
                              ? "border-slate-600 bg-slate-500 text-white"
                              : CHANNEL_COLOR[item.channel] ?? "border-rose-600 bg-rose-500 text-white",
                            item.kind === "external" && "border-dashed opacity-90",
                            item.reservationId && "cursor-pointer hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          style={{ left: startIndex * DAY_WIDTH + 3, width }}
                        >
                          <span className="block truncate">{item.name}</span>
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
                <p className="text-sm text-muted-foreground">
                  {selectedProperty?.name ?? "Propiedad"} · {selectedReservation.channel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canEditReservations(myCtx?.role) && (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" /> Editar reserva
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedReservationId(null)}>Cerrar</Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Entrada</p><p className="font-semibold">{shortDate(selectedReservation.check_in)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Salida</p><p className="font-semibold">{shortDate(selectedReservation.check_out)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Noches</p><p className="font-semibold">{nightsBetween(selectedReservation.check_in, selectedReservation.check_out)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{money(Number(selectedReservation.total_amount))}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <ReservationForm
        open={editing && Boolean(selectedReservation)}
        onOpenChange={setEditing}
        reservation={selectedReservation}
      />
    </AppShell>
  );
}
