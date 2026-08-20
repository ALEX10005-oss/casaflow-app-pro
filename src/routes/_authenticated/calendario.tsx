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
        content: "Reservas directas, ocupación importada por iCal, bloqueos y disponibilidad en una sola línea de tiempo.",
      },
      { property: "og:title", content: "Calendario PMS — CasaFlow" },
      { property: "og:description", content: "Disponibilidad de toda la cartera en una sola línea de tiempo." },
    ],
  }),
  component: Calendario,
});

const CHANNEL_COLOR: Record<string, string> = {
  Airbnb: "bg-destructive/85 text-destructive-foreground",
  Booking: "bg-primary text-primary-foreground",
  "Booking.com": "bg-primary text-primary-foreground",
  VRBO: "bg-success/85 text-success-foreground",
  directo: "bg-accent text-accent-foreground",
  Directo: "bg-accent text-accent-foreground",
};

function Calendario() {
  const [offset, setOffset] = useState(0);
  const [span, setSpan] = useState(21);
  const start = addDays(todayISO(), offset);
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(start, i)), [start, span]);

  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: external = [] } = useExternalEvents();
  const { data: guests = [] } = useGuests();
  const { data: blocks = [] } = useBlocks();
  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));

  const windowStart = days[0]!;
  const windowEnd = days[days.length - 1]!;

  return (
    <AppShell
      title="Calendario PMS"
      subtitle={`${properties.length} propiedades · reservas + iCal · ${span} noches desde ${windowStart}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setOffset(offset - 7)} aria-label="Semana anterior"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setOffset(0)}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setOffset(offset + 7)} aria-label="Semana siguiente"><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setSpan(span === 21 ? 35 : 21)}>{span === 21 ? "3 semanas" : "5 semanas"}</Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {["Airbnb", "Booking", "VRBO", "Directo"].map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHANNEL_COLOR[c])} /> {c}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-muted-foreground/40" /> Bloqueo / mantenimiento</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: 220 + span * 44 }}>
            <div className="sticky top-0 z-10 grid border-b bg-card" style={{ gridTemplateColumns: `220px repeat(${span}, 44px)` }}>
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propiedad</div>
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00`);
                const weekend = [0, 6].includes(dt.getDay());
                return (
                  <div key={d} className={cn("border-l py-1 text-center text-[10px] leading-tight", weekend && "bg-muted/60", d === todayISO() && "bg-accent/25 font-bold")}>
                    <div className="text-muted-foreground">{dt.toLocaleDateString("es-MX", { weekday: "narrow" })}</div>
                    <div>{dt.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {properties.map((p) => {
              const rows = reservations.filter((r) => r.property_id === p.id && r.check_in <= windowEnd && r.check_out > windowStart);
              const ext = external.filter((e) => e.property_id === p.id && e.start_date <= windowEnd && e.end_date > windowStart && e.status !== "cancelled");
              const bl = blocks.filter((b) => b.property_id === p.id && b.start_date <= windowEnd && b.end_date > windowStart);

              const timeline = [
                ...rows.map((r) => ({
                  id: `r-${r.id}`,
                  from: r.check_in,
                  to: r.check_out,
                  channel: r.channel,
                  label: guestById[r.guest_id ?? ""]?.full_name ?? r.code,
                  title: `${guestById[r.guest_id ?? ""]?.full_name ?? "Huésped"} · ${r.channel} · ${money(Number(r.total_amount))}`,
                  kind: "reservation" as const,
                })),
                ...ext.map((e) => ({
                  id: `e-${e.id}`,
                  from: e.start_date,
                  to: e.end_date,
                  channel: e.channel,
                  label: e.summary || e.channel,
                  title: `Importado por iCal · ${e.channel}`,
                  kind: "external" as const,
                })),
                ...bl.map((b) => ({
                  id: `b-${b.id}`,
                  from: b.start_date,
                  to: b.end_date,
                  channel: "",
                  label: "Bloqueado",
                  title: b.reason || "Bloqueo",
                  kind: "block" as const,
                })),
              ];

              return (
                <div key={p.id} className="relative grid border-b" style={{ gridTemplateColumns: `220px repeat(${span}, 44px)` }}>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.code} · {p.location}</p>
                  </div>
                  {days.map((d) => (
                    <div key={d} className={cn("h-[46px] border-l", [0, 6].includes(new Date(`${d}T00:00:00`).getDay()) && "bg-muted/40")} />
                  ))}

                  {timeline.map((item) => {
                    const s = Math.max(0, days.indexOf(item.from) === -1 ? 0 : days.indexOf(item.from));
                    const eIdx = days.indexOf(item.to);
                    const e = eIdx === -1 ? span : eIdx;
                    const width = Math.max(1, e - s);
                    return (
                      <div
                        key={item.id}
                        title={item.title}
                        className={cn(
                          "absolute top-2 flex h-[30px] items-center overflow-hidden rounded-md px-2 text-[11px] font-medium shadow-sm",
                          item.kind === "block"
                            ? "bg-muted-foreground/40 text-foreground"
                            : CHANNEL_COLOR[item.channel] ?? "bg-primary text-primary-foreground",
                          item.kind === "external" && "ring-1 ring-inset ring-foreground/20",
                        )}
                        style={{ left: 220 + s * 44 + 2, width: width * 44 - 4 }}
                      >
                        <span className="truncate">{item.label}</span>
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
