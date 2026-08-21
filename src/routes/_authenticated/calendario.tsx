import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  money,
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
        <span className="text-muted-foreground">Los eventos iCal se muestran con borde interior.</span>
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
                  from: r.check_in,
                  to: r.check_out,
                  channel: r.channel,
                  label: guestById[r.guest_id ?? ""]?.full_name ?? r.code,
                  title: `${guestById[r.guest_id ?? ""]?.full_name ?? "Huésped"} · ${r.channel} · ${r.check_in} a ${r.check_out} · ${money(Number(r.total_amount))}`,
                  kind: "reservation" as const,
                })),
                ...ext.map((e) => ({
                  id: `e-${e.id}`,
                  from: e.start_date,
                  to: e.end_date,
                  channel: e.channel,
                  label: e.summary || e.channel,
                  title: `Importado por iCal · ${e.channel} · ${e.start_date} a ${e.end_date}`,
                  kind: "external" as const,
                })),
                ...bl.map((b) => ({
                  id: `b-${b.id}`,
                  from: b.start_date,
                  to: b.end_date,
                  channel: "",
                  label: "Bloqueado",
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
                        <div
                          key={item.id}
                          title={item.title}
                          className={cn(
                            "absolute top-[9px] z-[2] flex h-[30px] items-center overflow-hidden rounded-md px-2 text-[11px] font-medium shadow-sm",
                            item.kind === "block"
                              ? "bg-muted-foreground/40 text-foreground"
                              : CHANNEL_COLOR[item.channel] ?? "bg-primary text-primary-foreground",
                            item.kind === "external" && "ring-1 ring-inset ring-foreground/30",
                          )}
                          style={{
                            left: startIndex * DAY_WIDTH + 1,
                            width: Math.max(DAY_WIDTH - 2, widthDays * DAY_WIDTH - 2),
                          }}
                        >
                          <span className="truncate">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
