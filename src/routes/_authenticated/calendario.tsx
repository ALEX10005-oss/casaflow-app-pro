import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExternalEventDetailDialog } from "@/components/external-event-detail";
import { ReservationDetailDialog } from "@/components/reservation-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  money,
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
  head: () => ({ meta: [{ title: "Calendario PMS — CasaFlow" }] }),
  component: Calendario,
});

const PROPERTY_WIDTH = 230;
const DAY_WIDTH = 54;
const ROW_HEIGHT = 44;
const CANCELLED = ["cancelada", "cancelled", "no_show"];

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-[#FF5A5F]",
  Booking: "bg-[#1D4ED8]",
  "Booking.com": "bg-[#1D4ED8]",
  VRBO: "bg-[#14B8A6]",
  Vrbo: "bg-[#14B8A6]",
  Expedia: "bg-[#7C3AED]",
  directo: "bg-[#F97316]",
  Directo: "bg-[#F97316]",
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
  const [selectedExternalId, setSelectedExternalId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  const selectedReservation = selectedReservationId
    ? reservations.find((reservation) => reservation.id === selectedReservationId) ?? null
    : null;
  const selectedExternal = selectedExternalId
    ? external.find((event) => event.id === selectedExternalId) ?? null
    : null;
  const selectedExternalProperty = selectedExternal
    ? properties.find((property) => property.id === selectedExternal.property_id) ?? null
    : null;
  const todayIndex = today >= rangeStart && today < rangeEnd ? dayDiff(rangeStart, today) : -1;
  const todayScrollLeft = Math.max(0, (todayIndex - 5) * DAY_WIDTH);

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
      subtitle={`${properties.length} propiedades · planning de ocupación · ${label}`}
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
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-background" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#FF5A5F]" /> Airbnb</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#1D4ED8]" /> Booking</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#14B8A6]" /> VRBO</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#F97316]" /> Directo</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#334155]" /> Bloqueo / mantenimiento</span>
        <span className="ml-auto text-muted-foreground">Abre cerca de hoy; desliza para recorrer el resto del año.</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent ref={scrollRef} className="overflow-x-auto p-0">
          <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
            <div className="sticky top-0 z-30 border-b bg-card shadow-sm">
              <div className="flex">
                <div
                  className="sticky left-0 z-40 shrink-0 border-r bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ width: PROPERTY_WIDTH }}
                >
                  Propiedad
                </div>
                <div className="flex" style={{ width: timelineWidth }}>
                  {monthGroups.map((month) => (
                    <div
                      key={month.key}
                      className="relative shrink-0 border-r bg-muted/50 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                      style={{ width: month.days * DAY_WIDTH }}
                    >
                      <span
                        className="inline-block whitespace-nowrap px-3"
                        style={{ position: "sticky", left: PROPERTY_WIDTH + 10 }}
                      >
                        {month.name} {year}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex border-t">
                <div className="sticky left-0 z-40 shrink-0 border-r bg-card" style={{ width: PROPERTY_WIDTH }} />
                <div className="flex" style={{ width: timelineWidth }}>
                  {columns.map((iso) => {
                    const d = new Date(`${iso}T12:00:00`);
                    const isWeekend = [0, 6].includes(d.getDay());
                    return (
                      <div
                        key={iso}
                        className={cn(
                          "shrink-0 border-r py-1 text-center leading-tight",
                          isWeekend ? "bg-muted/60" : "bg-card",
                          iso === today && "bg-[#FF5A5F]/10",
                        )}
                        style={{ width: DAY_WIDTH }}
                      >
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">
                          {d.toLocaleDateString("es-MX", { weekday: "narrow" })}
                        </div>
                        <div className={cn("text-sm font-semibold", iso === today && "text-[#FF5A5F]")}>{d.getDate()}</div>
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
                  externalId: null,
                  from: reservation.check_in,
                  to: reservation.check_out,
                  name: guestById[reservation.guest_id ?? ""]?.full_name ?? reservation.code,
                  amount: Number(reservation.total_amount ?? 0),
                  guestsCount: Number(reservation.guests_count ?? 0),
                  channel: reservation.channel,
                  kind: "reservation" as const,
                })),
                ...propertyExternal.map((event) => ({
                  id: `e-${event.id}`,
                  reservationId: null,
                  externalId: event.id,
                  from: event.start_date,
                  to: event.end_date,
                  name: event.summary || event.channel,
                  amount: null,
                  guestsCount: 0,
                  channel: event.channel,
                  kind: "external" as const,
                })),
                ...propertyBlocks.map((block) => ({
                  id: `b-${block.id}`,
                  reservationId: null,
                  externalId: null,
                  from: block.start_date,
                  to: block.end_date,
                  name: block.reason || "Bloqueado",
                  amount: null,
                  guestsCount: 0,
                  channel: "",
                  kind: "block" as const,
                })),
              ];

              return (
                <div key={property.id} className="flex border-b">
                  <div
                    className={cn(
                      "sticky left-0 z-20 shrink-0 border-r px-3 py-1.5",
                      propertyIndex % 2 === 0 ? "bg-card" : "bg-muted/40",
                    )}
                    style={{ width: PROPERTY_WIDTH, height: ROW_HEIGHT }}
                  >
                    <p className="truncate text-xs font-semibold text-foreground">{property.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{property.code} · {property.location}</p>
                  </div>

                  <div className="relative bg-background" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                    {columns.map((iso, index) => {
                      const d = new Date(`${iso}T12:00:00`);
                      const isWeekend = [0, 6].includes(d.getDay());
                      return (
                        <div
                          key={iso}
                          className={cn(
                            "absolute inset-y-0 border-r border-border/70",
                            isWeekend ? "bg-muted/50" : "bg-card",
                          )}
                          style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                        />
                      );
                    })}

                    {monthGroups.slice(1).map((month) => (
                      <div
                        key={`month-${month.key}`}
                        className="absolute inset-y-0 z-[2] border-l border-border"
                        style={{ left: month.startIndex * DAY_WIDTH }}
                      />
                    ))}

                    {todayIndex >= 0 && (
                      <div
                        className="absolute inset-y-0 z-[4] w-0.5 bg-[#FF5A5F]"
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
                      const width = Math.max(DAY_WIDTH, widthDays * DAY_WIDTH);
                      const label = [
                        item.name,
                        item.amount ? money(item.amount) : null,
                        widthDays >= 3 && item.guestsCount ? `${item.guestsCount} hu.` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const interactive = Boolean(item.reservationId || item.externalId);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.reservationId) setSelectedReservationId(item.reservationId);
                            else if (item.externalId) setSelectedExternalId(item.externalId);
                          }}
                          title={`${item.name}${item.amount ? ` · ${money(item.amount)}` : ""} · ${shortDate(item.from)} → ${shortDate(item.to)}`}
                          className={cn(
                            "absolute inset-y-[5px] z-[5] flex items-center overflow-hidden rounded-full px-3 text-left text-[11px] font-semibold leading-tight text-white shadow-sm ring-1 ring-black/5",
                            item.kind === "block" ? "bg-[#334155]" : CHANNEL_COLOR[item.channel] ?? "bg-[#FF5A5F]",
                            item.kind === "external" && "border-2 border-dashed border-white/70",
                            interactive && "cursor-pointer hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          style={{ left: startIndex * DAY_WIDTH + 2, width: width - 4 }}
                        >
                          <span className="block truncate">{label}</span>
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

      <ReservationDetailDialog
        reservation={selectedReservation}
        onOpenChange={(open) => {
          if (!open) setSelectedReservationId(null);
        }}
      />
      <ExternalEventDetailDialog
        event={selectedExternal}
        property={selectedExternalProperty}
        onOpenChange={(open) => {
          if (!open) setSelectedExternalId(null);
        }}
      />
    </AppShell>
  );
}
