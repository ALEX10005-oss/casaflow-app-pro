import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
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
      { title: "Calendario PMS multipropiedad — CasaFlow" },
      {
        name: "description",
        content:
          "Planning PMS con propiedades en filas y días en columnas: reservas, eventos iCal y bloqueos por día, semana, mes y año.",
      },
      { property: "og:title", content: "Calendario PMS multipropiedad — CasaFlow" },
      {
        property: "og:description",
        content: "Disponibilidad de toda la cartera en formato planning por día, semana, mes y año.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calendario,
});

const PROPERTY_WIDTH = 220;
const ROW_HEIGHT = 52;

type ViewMode = "dia" | "semana" | "mes" | "anio";

const DAY_WIDTH: Record<ViewMode, number> = {
  dia: 260,
  semana: 96,
  mes: 34,
  anio: 7,
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
  const [view, setView] = useState<ViewMode>("mes");
  const [anchor, setAnchor] = useState(today);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

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
    // Año actual: ocultar por defecto los meses anteriores al mes en curso.
    const s = year === currentYear ? startOfMonth(today) : `${year}-01-01`;
    return {
      rangeStart: s,
      rangeEnd: `${year + 1}-01-01`,
      label: year === currentYear ? `${year} · desde ${new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { month: "long" })}` : String(year),
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
      if (last && last.key === key) last.days += 1;
      else
        groups.push({
          key,
          name: new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { month: "long" }),
          startIndex: index,
          days: 1,
        });
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

  const visibleReservations = reservations
    .filter((r) => r.check_in < rangeEnd && r.check_out > rangeStart && !CANCELLED.includes(r.status))
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  const selectedReservation = selectedReservationId
    ? reservations.find((r) => r.id === selectedReservationId) ?? null
    : null;
  const selectedGuest = selectedReservation?.guest_id ? guestById[selectedReservation.guest_id] : null;
  const selectedProperty = selectedReservation ? propById[selectedReservation.property_id] : null;

  const todayIndex = today >= rangeStart && today < rangeEnd ? dayDiff(rangeStart, today) : -1;

  return (
    <AppShell
      title="Calendario"
      subtitle={`${properties.length} propiedades · planning PMS · ${label}`}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(
              [
                ["dia", "Día"],
                ["semana", "Semana"],
                ["mes", "Mes"],
                ["anio", "Año"],
              ] as [ViewMode, string][]
            ).map(([value, text]) => (
              <Button
                key={value}
                size="sm"
                variant={view === value ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
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
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        {["Airbnb", "Booking", "VRBO", "Expedia", "Directo"].map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHANNEL_COLOR[c])} /> {c}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted-foreground/40" /> Bloqueo / mantenimiento
        </span>
        <span className="text-muted-foreground">Toca una reserva para ver el detalle completo.</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: PROPERTY_WIDTH + timelineWidth }}>
            <div className="sticky top-0 z-20 border-b bg-card">
              <div className="flex">
                <div
                  className="sticky left-0 z-30 shrink-0 border-r bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ width: PROPERTY_WIDTH }}
                >
                  Propiedad
                </div>
                <div className="flex" style={{ width: timelineWidth }}>
                  {monthGroups.map((m) => (
                    <div
                      key={m.key}
                      className="shrink-0 truncate border-r px-2 py-2 text-center text-xs font-semibold capitalize"
                      style={{ width: m.days * dayWidth }}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              </div>

              {view !== "anio" && (
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
                            "shrink-0 border-r py-1 text-center text-[10px] leading-tight",
                            weekend && "bg-muted/40",
                            iso === today && "bg-primary/10 font-semibold text-primary",
                          )}
                          style={{ width: dayWidth }}
                        >
                          <div className="capitalize text-muted-foreground">
                            {d.toLocaleDateString("es-MX", { weekday: "narrow" })}
                          </div>
                          <div>{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    title: `${guestName} · ${r.channel} · Entrada ${shortDate(r.check_in)} · Salida ${shortDate(r.check_out)} · ${r.guests_count ?? 0} huésped(es) · ${money(Number(r.total_amount))}`,
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
                  title: `Importado por iCal · ${e.channel} · ${e.start_date} a ${e.end_date}`,
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
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.code} · {p.location}
                    </p>
                  </div>

                  <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                    {view === "anio"
                      ? monthGroups.slice(1).map((m) => (
                          <div
                            key={m.key}
                            className="absolute inset-y-0 border-l"
                            style={{ left: m.startIndex * dayWidth }}
                          />
                        ))
                      : columns.map((iso, index) => {
                          const d = new Date(`${iso}T12:00:00`);
                          const weekend = [0, 6].includes(d.getDay());
                          return (
                            <div
                              key={iso}
                              className={cn("absolute inset-y-0 border-r border-border/60", weekend && "bg-muted/30")}
                              style={{ left: index * dayWidth, width: dayWidth }}
                            />
                          );
                        })}

                    {todayIndex >= 0 && (
                      <div
                        className="absolute inset-y-0 z-[1] w-0.5 bg-primary/70"
                        style={{ left: todayIndex * dayWidth }}
                        title="Hoy"
                      />
                    )}

                    {timeline.map((item) => {
                      const startIndex = clamp(dayDiff(rangeStart, item.from), 0, totalDays);
                      const endIndex = clamp(dayDiff(rangeStart, item.to), 0, totalDays);
                      const widthDays = Math.max(1, endIndex - startIndex);
                      if (endIndex <= 0 || startIndex >= totalDays) return null;
                      const barWidth = Math.max(dayWidth - 2, widthDays * dayWidth - 4);
                      const compact = barWidth < 110;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          title={item.title}
                          onClick={() => item.reservationId && setSelectedReservationId(item.reservationId)}
                          className={cn(
                            "absolute top-[8px] z-[2] flex flex-col justify-center overflow-hidden rounded-md px-2 text-left shadow-sm transition",
                            item.kind === "block"
                              ? "bg-muted-foreground/40 text-foreground"
                              : CHANNEL_COLOR[item.channel] ?? "bg-primary text-primary-foreground",
                            item.kind === "external" && "ring-1 ring-inset ring-foreground/30",
                            item.kind === "reservation" &&
                              "cursor-pointer hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring",
                          )}
                          style={{ left: startIndex * dayWidth + 2, width: barWidth, height: ROW_HEIGHT - 16 }}
                        >
                          <span className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight">
                            <span className="truncate">{item.name}</span>
                            {item.pax ? (
                              <span className="flex shrink-0 items-center gap-0.5 opacity-90">
                                <Users className="size-3" />
                                {item.pax}
                              </span>
                            ) : null}
                          </span>
                          {!compact && (
                            <span className="truncate text-[10px] leading-tight opacity-85">{item.dates}</span>
                          )}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detalle de reserva
                </p>
                <h2 className="text-lg font-semibold">{selectedGuest?.full_name ?? "Huésped"}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProperty?.name ?? "Propiedad"} · {selectedReservation.channel}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReservationId(null)}>
                Cerrar
              </Button>
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
                <p className="font-semibold">
                  {nightsBetween(selectedReservation.check_in, selectedReservation.check_out)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="font-semibold capitalize">{selectedReservation.status}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p>
                <span className="text-muted-foreground">Correo:</span> {selectedGuest?.email ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Teléfono:</span> {selectedGuest?.phone ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Código:</span> {selectedReservation.code}
              </p>
              <p>
                <span className="text-muted-foreground">Huéspedes:</span> {selectedReservation.guests_count ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Total:</span>{" "}
                {money(Number(selectedReservation.total_amount))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="overflow-x-auto p-0">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold capitalize">Entradas y salidas · {label}</h2>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Sin reservas en este periodo.
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
