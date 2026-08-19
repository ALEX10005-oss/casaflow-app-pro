import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  addDays,
  money,
  todayISO,
  useBlocks,
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
        content: "Vista tipo Gantt de reservas, bloqueos y disponibilidad de todas las propiedades en una sola pantalla.",
      },
      { property: "og:title", content: "Calendario PMS — CasaFlow" },
      { property: "og:description", content: "Disponibilidad y reservas de toda la cartera en una sola línea de tiempo." },
    ],
  }),
  component: Calendario,
});

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-destructive/85 text-destructive-foreground",
  Booking: "bg-primary text-primary-foreground",
  VRBO: "bg-success/85 text-success-foreground",
  "Web Directa": "bg-accent text-accent-foreground",
};

function Calendario() {
  const [offset, setOffset] = useState(0);
  const [span, setSpan] = useState(21);
  const start = addDays(todayISO(), offset);
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(start, i)), [start, span]);

  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: guests = [] } = useGuests();
  const { data: blocks = [] } = useBlocks();
  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));

  const windowStart = days[0];
  const windowEnd = days[days.length - 1];

  return (
    <AppShell
      title="Calendario PMS"
      subtitle={`${properties.length} propiedades · ${span} noches desde ${windowStart}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setOffset(offset - 7)} aria-label="Semana anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOffset(0)}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setOffset(offset + 7)} aria-label="Semana siguiente">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSpan(span === 21 ? 35 : 21)}>
            {span === 21 ? "3 semanas" : "5 semanas"}
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {Object.keys(CHANNEL_COLOR).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHANNEL_COLOR[c])} /> {c}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted-foreground/40" /> Bloqueo / mantenimiento
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: 220 + span * 44 }}>
            <div
              className="sticky top-0 z-10 grid border-b bg-card"
              style={{ gridTemplateColumns: `220px repeat(${span}, 44px)` }}
            >
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Propiedad
              </div>
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00`);
                const weekend = [0, 6].includes(dt.getDay());
                return (
                  <div
                    key={d}
                    className={cn(
                      "border-l py-1 text-center text-[10px] leading-tight",
                      weekend && "bg-muted/60",
                      d === todayISO() && "bg-accent/25 font-bold",
                    )}
                  >
                    <div className="text-muted-foreground">
                      {dt.toLocaleDateString("es-MX", { weekday: "narrow" })}
                    </div>
                    <div>{dt.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {properties.map((p) => {
              const rows = reservations.filter(
                (r) => r.property_id === p.id && r.check_in <= windowEnd && r.check_out > windowStart,
              );
              const bl = blocks.filter(
                (b) => b.property_id === p.id && b.start_date <= windowEnd && b.end_date > windowStart,
              );
              return (
                <div
                  key={p.id}
                  className="relative grid border-b"
                  style={{ gridTemplateColumns: `220px repeat(${span}, 44px)` }}
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.code} · {p.location}
                    </p>
                  </div>
                  {days.map((d) => (
                    <div
                      key={d}
                      className={cn(
                        "h-[46px] border-l",
                        [0, 6].includes(new Date(`${d}T00:00:00`).getDay()) && "bg-muted/40",
                      )}
                    />
                  ))}

                  {[...rows, ...bl].map((item) => {
                    const isRes = "check_in" in item;
                    const from = isRes ? (item as { check_in: string }).check_in : (item as { start_date: string }).start_date;
                    const to = isRes ? (item as { check_out: string }).check_out : (item as { end_date: string }).end_date;
                    const s = Math.max(0, days.indexOf(from) === -1 ? 0 : days.indexOf(from));
                    const eIdx = days.indexOf(to);
                    const e = eIdx === -1 ? span : eIdx;
                    const width = Math.max(1, e - s);
                    const res = isRes ? (item as (typeof reservations)[number]) : null;
                    return (
                      <div
                        key={item.id}
                        title={
                          res
                            ? `${guestById[res.guest_id ?? ""]?.full_name ?? "Huésped"} · ${res.channel} · ${money(Number(res.total_amount))}`
                            : "Bloqueo"
                        }
                        className={cn(
                          "absolute top-2 flex h-[30px] items-center overflow-hidden rounded-md px-2 text-[11px] font-medium shadow-sm",
                          res ? CHANNEL_COLOR[res.channel] ?? "bg-primary text-primary-foreground" : "bg-muted-foreground/40 text-foreground",
                        )}
                        style={{ left: 220 + s * 44 + 2, width: width * 44 - 4 }}
                      >
                        <span className="truncate">
                          {res ? guestById[res.guest_id ?? ""]?.full_name ?? res.code : "Bloqueado"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
