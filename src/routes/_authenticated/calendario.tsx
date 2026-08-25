import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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

const PROPERTY_WIDTH = 220;
const DAY_WIDTH = 48;
const ROW_HEIGHT = 44;
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
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000,
  );
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
      if (last?.key === key) last.days += 1;
      else {
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

  const todayIndex = today >= rangeStart && today < rangeEnd ? dayDiff(rangeStart, today) : -1;
  const todayScrollLeft = Math.max(0, (todayIndex - 5) * DAY_WIDTH);

  useEffect(() => {
    if (year !== currentYear || todayIndex < 0 || !scrollRef.current) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [year, currentYear, todayIndex, todayScrollLeft, properties.length]);

  const goToday = () => {
    setAnchor(today);
    requestAnimationFrame(() => {
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
          <Button variant="outline" size="sm" onClick={goToday}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(`${year + 1}-01-01`)} aria-label="Año siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" /> Airbnb</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-600" /> Booking</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-cyan-600" /> VRBO</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-400" /> Directo</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-500" /> Bloqueo</span>
        <span className="ml-auto text-muted-foreground">Toca una reserva para ver todos los datos del huésped.</span>
      </div>

      <Card className="border bg-background shadow-sm">
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-[calc(100vh-190px)] overflow-auto">
            <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
              <div className="sticky top-0 z-30 bg-background shadow-sm">
                <div className="flex h-9 border-b">
                  <div
                    className="sticky left-0 z-40 flex shrink-0 items-center border-r bg-background px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ width: PROPERTY_WIDTH }}
                  >Propiedad</div>
                  <div className="flex" style={{ width: timelineWidth }}>
                    {monthGroups.map((month) => (
                      <div
                        key={month.key}
                        className="relative flex shrink-0 items-center border-r bg-muted/20 text-sm font-semibold capitalize"
                        style={{ width: month.days * DAY_WIDTH }}
                      >
                        <span className="sticky whitespace-nowrap px-3" style={{ left: PROPERTY_WIDTH + 10 }}>
                          {month.name} {year}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex h-11 border-b bg-background">
                  <div className="sticky left-0 z-40 shrink-0 border-r bg-background" style={{ width: PROPERTY_WIDTH }} />
                  <div className="flex" style={{ width: timelineWidth }}>
                    {columns.map((iso) => {
                      const d = new Date(`${iso}T12:00:00`);
                      const weekend = [0, 6].includes(d.getDay());
                      return (
                        <div
                          key={iso}
                          className={cn(
                            "flex shrink-0 flex-col items-center justify-center border-r leading-tight",
                            weekend ? "bg-muted/30" : "bg-background",
                            iso === today && "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-300",
                          )}
                          style={{ width: DAY_WIDTH }}
                        >
                          <div className="text-[9px] font-medium uppercase text-muted-foreground">
                            {d.toLocaleDateString("es-MX", { weekday: "narrow" })}
                          </div>
                          <div className="text-[13px] font-semibold">{d.getDate()}</div>
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
                  (block) =>
                    block.property_id === property.id && block.start_date < rangeEnd && block.end_date > rangeStart,
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
                    total: Number(reservation.total_amount),
                  })),
                  ...propertyExternal.map((event) => ({
                    id: `e-${event.id}`,
                    reservationId: null,
                    from: event.start_date,
                    to: event.end_date,
                    name: event.summary || event.channel,
                    channel: event.channel,
                    kind: "external" as const,
                    total: null,
                  })),
                  ...propertyBlocks.map((block) => ({
                    id: `b-${block.id}`,
                    reservationId: null,
                    from: block.start_date,
                    to: block.end_date,
                    name: block.reason || "Bloqueado",
                    channel: "",
                    kind: "block" as const,
                    total: null,
                  })),
                ];

                return (
                  <div key={property.id} className="flex border-b bg-background">
                    <div
                      className={cn(
                        "sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r px-3",
                        propertyIndex % 2 === 0 ? "bg-background" : "bg-muted/10",
                      )}
                      style={{ width: PROPERTY_WIDTH, height: ROW_HEIGHT }}
                    >
                      <p className="truncate text-[13px] font-semibold">{property.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{property.code} · {property.location}</p>
                    </div>

                    <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                      {columns.map((iso, index) => {
                        const d = new Date(`${iso}T12:00:00`);
                        return (
                          <div
                            key={iso}
                            className={cn("absolute inset-y-0 border-r", [0, 6].includes(d.getDay()) ? "bg-muted/15" : "bg-background")}
                            style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                          />
                        );
                      })}

                      {monthGroups.slice(1).map((month) => (
                        <div
                          key={month.key}
                          className="absolute inset-y-0 z-[2] border-l-2 border-border"
                          style={{ left: month.startIndex * DAY_WIDTH }}
                        />
                      ))}

                      {todayIndex >= 0 && (
                        <div className="absolute inset-y-0 z-[4] w-0.5 bg-rose-400" style={{ left: todayIndex * DAY_WIDTH }} />
                      )}

                      {timeline.map((item) => {
                        const rawStart = dayDiff(rangeStart, item.from);
                        const rawEnd = dayDiff(rangeStart, item.to);
                        if (rawEnd <= 0 || rawStart >= totalDays) return null;
                        const startIndex = clamp(rawStart, 0, totalDays);
                        const endIndex = clamp(rawEnd, 0, totalDays);
                        const width = Math.max(DAY_WIDTH, Math.max(1, endIndex - startIndex) * DAY_WIDTH - 6);
                        const visibleLabel = item.reservationId
                          ? `${item.name} · ${money(Number(item.total))}`
                          : item.name;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => item.reservationId && setSelectedReservationId(item.reservationId)}
                            title={`${visibleLabel} · ${item.channel || "Bloqueo"} · ${shortDate(item.from)} → ${shortDate(item.to)}`}
                            className={cn(
                              "absolute top-1.5 z-[5] flex h-8 items-center overflow-hidden rounded-lg border px-2.5 text-left text-[11px] font-semibold shadow-sm transition",
                              item.kind === "block"
                                ? "border-slate-600 bg-slate-500 text-white"
                                : CHANNEL_COLOR[item.channel] ?? "border-rose-600 bg-rose-500 text-white",
                              item.kind === "external" && "border-dashed opacity-90",
                              item.reservationId && "cursor-pointer hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-ring",
                            )}
                            style={{ left: startIndex * DAY_WIDTH + 3, width }}
                          >
                            <span className="block truncate">{visibleLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <ReservationDetailDialog
        reservation={selectedReservation}
        onOpenChange={(open) => {
          if (!open) setSelectedReservationId(null);
        }}
      />
    </AppShell>
  );
}
