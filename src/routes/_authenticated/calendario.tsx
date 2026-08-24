import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ReservationForm } from "@/components/reservation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canEditReservations,
  useMyContext,
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
    meta: [{ title: "Calendario PMS — CasaFlow" }],
  }),
  component: Calendario,
});

const PROPERTY_WIDTH = 230;
const ROW_HEIGHT = 58;

type ViewMode = "dia" | "semana" | "mes" | "anio";

const DAY_WIDTH: Record<ViewMode, number> = {
  dia: 260,
  semana: 96,
  mes: 38,
  anio: 24,
};

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-destructive/85 text-destructive-foreground",
  Booking: "bg-primary text-primary-foreground",
  "Booking.com": "bg-primary text-primary-foreground",
  VRBO: "bg-success/85 text-success-foreground",
  Expedia: "bg-warning text-warning-foreground",
  directo: "bg-accent text-accent-foreground",
  Directo: "bg-accent text-accent-foreground",
};

const CANCELLED = ["cancelada", "cancelled", "no_show"];

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

function startOfWeek(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return shift(iso, -dow);
}

function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function addMonths(iso: string, n: number) {
  const d = new Date(`${startOfMonth(iso)}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function Calendario() {
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const [view, setView] = useState<ViewMode>("anio");
  const [anchor, setAnchor] = useState(today);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { data: myCtx } = useMyContext();

  const { rangeStart, rangeEnd, label } = useMemo(() => {
    if (view === "dia") {
      return {
        rangeStart: anchor,
        rangeEnd: shift(anchor, 1),
        label: new Date(`${anchor}T12:00:00`).toLocaleDateString("es-MX", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      };
    }

    if (view === "semana") {
      const s = startOfWeek(anchor);
      return { rangeStart: s, rangeEnd: shift(s, 7), label: `${shortDate(s)} → ${shortDate(shift(s, 6))}` };
    }

    if (view === "mes") {
      const s = startOfMonth(anchor);
      return {
        rangeStart: s,
        rangeEnd: addMonths(s, 1),
        label: new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
      };
    }

    const year = Number(anchor.slice(0, 4));
    const s = year === currentYear ? startOfMonth(today) : `${year}-01-01`;
    const monthName = new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { month: "long" });
    return {
      rangeStart: s,
      rangeEnd: `${year + 1}-01-01`,
      label: year === currentYear ? `${year} · desde ${monthName}` : String(year),
    };
  }, [view, anchor, currentYear, today]);

  const dayWidth = DAY_WIDTH[view];
  const totalDays = dayDiff(rangeStart, rangeEnd);
  const timelineWidth = totalDays * dayWidth;

  const columns = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => shift(rangeStart, i)),
    [rangeStart, totalDays],
  );

  const monthGroups = useMemo(() => {
    const groups: { key: string; name: string; startIndex: number; days: number }[] = [];
    columns.forEach((iso, index) => {
      const key = iso.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
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

  const goto = (dir: -1 | 1) => {
    if (view === "dia") setAnchor(shift(anchor, dir));
    else if (view === "semana") setAnchor(shift(anchor, dir * 7));
    else if (view === "mes") setAnchor(addMonths(anchor, dir));
    else setAnchor(`${Number(anchor.slice(0, 4)) + dir}-01-01`);
  };

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
  const todayIndex = today >= rangeStart && today < rangeEnd ? dayDiff(rangeStart, today) : -1;

  return (
    <AppShell
      title="Calendario"
      subtitle={`${properties.length} propiedades · ${label}`}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            {([
              ["dia", "Día"],
              ["semana", "Semana"],
              ["mes", "Mes"],
              ["anio", "Año"],
            ] as [ViewMode, string][]).map(([value, text]) => (
              <Button
                key={value}
                size="sm"
                variant={view === value ? "default" : "ghost"}
                className="h-8 px-3 text-xs"
                onClick={() => setView(value)}
              >
                {text}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => goto(-1)} aria-label="Periodo anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(today)}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => goto(1)} aria-label="Periodo siguiente">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs">
        {["Airbnb", "Booking", "VRBO", "Expedia", "Directo"].map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHANNEL_COLOR[c])} /> {c}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted-foreground/40" /> Bloqueo / mantenimiento
        </span>
        <span className="ml-auto text-muted-foreground">Selecciona una reserva para ver su detalle.</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
            <div className="sticky top-0 z-20 border-b bg-card shadow-sm">
              <div className="flex">
                <div
                  className="sticky left-0 z-30 shrink-0 border-r bg-card px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ width: PROPERTY_WIDTH }}
                >
                  Propiedad
                </div>
                <div className="flex" style={{ width: timelineWidth }}>
                  {monthGroups.map((m) => (
                    <div
                      key={m.key}
                      className="shrink-0 border-r bg-muted/20 px-2 py-3 text-center text-sm font-semibold capitalize"
                      style={{ width: m.days * dayWidth }}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex border-t">
                <div className="sticky left-0 z-30 shrink-0 border-r bg-card" style={{ width: PROPERTY_WIDTH }} />
                <div className="flex" style={{ width: timelineWidth }}>
                  {columns.map((iso) => {
                    const d = new Date(`${iso}T12:00:00`);
                    const weekend = [0, 6].includes(d.getDay());
                    return (
                      <div
                        key={iso}
                        className={cn(
                          "shrink-0 border-r py-1.5 text-center leading-tight",
                          weekend && "bg-muted/40",
                          iso === today && "bg-primary/10 font-semibold text-primary",
                        )}
                        style={{ width: dayWidth }}
                        title={d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                      >
                        <div className="text-[9px] uppercase text-muted-foreground">
                          {d.toLocaleDateString("es-MX", { weekday: "narrow" })}
                        </div>
                        <div className="text-[11px] font-medium">{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {properties.map((p) => {
              const rows = reservations.filter(
                (r) =>
                  r.property_id === p.id &&
                  r.check_in < rangeEnd &&
                  r.check_out > rangeStart &&
                  !CANCELLED.includes(r.status),
              );
              const ext = external.filter(
                (e) =>
                  e.property_id === p.id &&
                  e.start_date < rangeEnd &&
                  e.end_date > rangeStart &&
                  e.status !== "cancelled",
              );
              const bl = blocks.filter(
                (b) => b.property_id === p.id && b.start_date < rangeEnd && b.end_date > rangeStart,
              );

              const timeline = [
                ...rows.map((r) => {
                  const guestName = guestById[r.guest_id ?? ""]?.full_name ?? r.code;
                  return {
                    id: `r-${r.id}`,
                    reservationId: r.id,
                    from: r.check_in,
                    to: r.check_out,
                    channel: r.channel,
                    name: guestName,
                    pax: r.guests_count ?? null,
                    dates: `${shortDate(r.check_in)} → ${shortDate(r.check_out)}`,
                    title: `${guestName} · ${r.channel} · ${shortDate(r.check_in)} → ${shortDate(r.check_out)} · ${r.guests_count ?? 0} huésped(es) · ${money(Number(r.total_amount))}`,
                    kind: "reservation" as const,
                  };
                }),
                ...ext.map((e) => ({
                  id: `e-${e.id}`,
                  reservationId: null,
                  from: e.start_date,
                  to: e.end_date,
                  channel: e.channel,
                  name: e.summary || e.channel,
                  pax: null,
                  dates: `${shortDate(e.start_date)} → ${shortDate(e.end_date)}`,
                  title: `Importado por iCal · ${e.channel}`,
                  kind: "external" as const,
                })),
                ...bl.map((b) => ({
                  id: `b-${b.id}`,
                  reservationId: null,
                  from: b.start_date,
                  to: b.end_date,
                  channel: "",
                  name: b.reason || "Bloqueado",
                  pax: null,
                  dates: `${shortDate(b.start_date)} → ${shortDate(b.end_date)}`,
                  title: b.reason || "Bloqueo / mantenimiento",
                  kind: "block" as const,
                })),
              ];

              return (
                <div key={p.id} className="flex border-b bg-card">
                  <div
                    className="sticky left-0 z-10 shrink-0 border-r bg-card px-4 py-2.5"
                    style={{ width: PROPERTY_WIDTH }}
                  >
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.code} · {p.location}
                    </p>
                  </div>

                  <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                    {columns.map((iso, index) => {
                      const d = new Date(`${iso}T12:00:00`);
                      const weekend = [0, 6].includes(d.getDay());
                      return (
                        <div
                          key={iso}
                          className={cn("absolute inset-y-0 border-r border-border/50", weekend && "bg-muted/20")}
                          style={{ left: index * dayWidth, width: dayWidth }}
                        />
                      );
                    })}

                    {monthGroups.slice(1).map((m) => (
                      <div
                        key={`month-${m.key}`}
                        className="absolute inset-y-0 z-[1] border-l-2 border-border"
                        style={{ left: m.startIndex * dayWidth }}
                      />
                    ))}

                    {todayIndex >= 0 && (
                      <div
                        className="absolute inset-y-0 z-[2] w-0.5 bg-primary"
                        style={{ left: todayIndex * dayWidth }}
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
                      const barWidth = Math.max(dayWidth - 3, widthDays * dayWidth - 5);
                      const compact = barWidth < 130;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          title={item.title}
                          onClick={() => item.reservationId && setSelectedReservationId(item.reservationId)}
                          className={cn(
                            "absolute top-[8px] z-[3] flex flex-col justify-center overflow-hidden rounded-md px-2.5 text-left shadow-sm transition",
                            item.kind === "block"
                              ? "bg-muted-foreground/40 text-foreground"
                              : CHANNEL_COLOR[item.channel] ?? "bg-primary text-primary-foreground",
                            item.kind === "external" && "ring-1 ring-inset ring-foreground/30",
                            item.kind === "reservation" &&
                              "cursor-pointer hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          style={{ left: startIndex * dayWidth + 2, width: barWidth, height: ROW_HEIGHT - 16 }}
                        >
                          <span className="flex items-center gap-1 truncate text-[11px] font-semibold">
                            <span className="truncate">{item.name}</span>
                            {item.pax ? (
                              <span className="flex shrink-0 items-center gap-0.5 opacity-90">
                                <Users className="size-3" />
                                {item.pax}
                              </span>
                            ) : null}
                          </span>
                          {!compact && <span className="truncate text-[10px] opacity-85">{item.dates}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {properties.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No hay propiedades disponibles para tu usuario.
              </div>
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
              <div className="flex items-center gap-2">
                {canEditReservations(myCtx?.role) && (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" /> Editar reserva
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedReservationId(null)}>
                  Cerrar
                </Button>
              </div>
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
