import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ExternalEventDetailDialog } from "@/components/external-event-detail";
import { ReservationForm } from "@/components/reservation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  canEditReservations,
  money,
  nightsBetween,
  reservationErrorMessage,
  shortDate,
  todayISO,
  useBlocks,
  useExternalEvents,
  useGuests,
  useMyContext,
  useProperties,
  useReservations,
  type Reservation,
} from "@/lib/casaflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendario PMS — CasaFlow" }] }),
  component: Calendario,
});

const PROPERTY_WIDTH = 230;
const DAY_WIDTH = 54;
const ROW_HEIGHT = 58;
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
  const qc = useQueryClient();
  const { data: ctx } = useMyContext();
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const [anchor, setAnchor] = useState(today);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [selectedExternalId, setSelectedExternalId] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string; checkOut: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScroll = useRef(false);
  const canEdit = canEditReservations(ctx?.role);

  const year = Number(anchor.slice(0, 4));
  const rangeStart = year === currentYear ? startOfMonth(today) : `${year}-01-01`;
  const rangeEnd = `${year + 1}-01-01`;
  const totalDays = dayDiff(rangeStart, rangeEnd);
  const timelineWidth = totalDays * DAY_WIDTH;
  const fullWidth = PROPERTY_WIDTH + timelineWidth;
  const monthLabel = new Date(`${rangeStart}T12:00:00`).toLocaleDateString("es-MX", { month: "long" });
  const label = year === currentYear ? `${year} · desde ${monthLabel}` : String(year);

  const columns = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => shift(rangeStart, i)),
    [rangeStart, totalDays],
  );

  const monthGroups = useMemo(() => {
    const groups: { key: string; name: string; days: number }[] = [];
    columns.forEach((iso) => {
      const key = iso.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.days += 1;
      else groups.push({ key, name: new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { month: "long" }), days: 1 });
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
    ? reservations.find((r) => r.id === selectedReservationId) ?? null
    : null;
  const selectedGuest = selectedReservation
    ? guests.find((g) => g.id === selectedReservation.guest_id) ?? null
    : null;
  const selectedProperty = selectedReservation
    ? properties.find((p) => p.id === selectedReservation.property_id) ?? null
    : null;
  const selectedExternal = selectedExternalId
    ? external.find((e) => e.id === selectedExternalId) ?? null
    : null;
  const selectedExternalProperty = selectedExternal
    ? properties.find((p) => p.id === selectedExternal.property_id) ?? null
    : null;

  const todayIndex = today >= rangeStart && today < rangeEnd ? dayDiff(rangeStart, today) : -1;
  const todayScrollLeft = Math.max(0, (todayIndex - 5) * DAY_WIDTH);

  useEffect(() => {
    if (year !== currentYear || todayIndex < 0 || !scrollRef.current) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "auto" });
      bottomScrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [year, currentYear, todayIndex, todayScrollLeft, properties.length]);

  const syncScroll = (source: "main" | "bottom") => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    if (source === "main" && scrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
    if (source === "bottom" && scrollRef.current && bottomScrollRef.current) {
      scrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { syncingScroll.current = false; });
  };

  const goToday = () => {
    setAnchor(today);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "smooth" });
      bottomScrollRef.current?.scrollTo({ left: todayScrollLeft, behavior: "smooth" });
    });
  };

  const startResize = (event: React.PointerEvent, reservation: Reservation) => {
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const original = reservation.check_out;
    let finalCheckOut = original;
    setResizePreview({ id: reservation.id, checkOut: original });

    const onMove = (e: PointerEvent) => {
      const deltaDays = Math.round((e.clientX - startX) / DAY_WIDTH);
      const candidate = shift(original, deltaDays);
      finalCheckOut = candidate <= reservation.check_in ? shift(reservation.check_in, 1) : candidate;
      setResizePreview({ id: reservation.id, checkOut: finalCheckOut });
    };

    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizePreview(null);
      if (finalCheckOut === original) return;
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { error } = await rpc("resize_reservation_checkout", {
        _id: reservation.id,
        _check_out: finalCheckOut,
      });
      if (error) {
        toast.error(reservationErrorMessage(new Error(error.message)));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(`Reserva ajustada hasta ${shortDate(finalCheckOut)}.`);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <AppShell
      title="Calendario"
      subtitle={`${properties.length} propiedades · planning de ocupación · ${label}`}
      actions={
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setAnchor(`${year - 1}-01-01`)} aria-label="Año anterior"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(`${year + 1}-01-01`)} aria-label="Año siguiente"><ChevronRight className="size-4" /></Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-background" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#FF5A5F]" /> Airbnb</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#1D4ED8]" /> Booking</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#14B8A6]" /> VRBO</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#F97316]" /> Directo</span>
        <span className="ml-auto rounded-md border bg-muted/40 px-2 py-1 font-medium text-foreground">Haz clic en una reserva para ver y editar sus datos.</span>
      </div>

      {selectedReservation && (
        <Card className="mb-3 border-primary/30 shadow-sm">
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reserva seleccionada</p>
                <h2 className="font-display text-lg font-semibold">{selectedGuest?.full_name ?? selectedReservation.code}</h2>
                <p className="text-sm text-muted-foreground">{selectedProperty?.name ?? "Propiedad"} · {selectedReservation.channel}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button onClick={() => setEditingReservation(selectedReservation)}>
                    <Pencil className="size-4" /> Editar reserva
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label="Cerrar detalle" onClick={() => setSelectedReservationId(null)}><X className="size-4" /></Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Info label="Código" value={selectedReservation.code || "—"} />
              <Info label="Canal / origen" value={selectedReservation.channel} />
              <Info label="Check-in" value={shortDate(selectedReservation.check_in)} />
              <Info label="Check-out" value={shortDate(selectedReservation.check_out)} />
              <Info label="Noches" value={String(nightsBetween(selectedReservation.check_in, selectedReservation.check_out))} />
              <Info label="Huéspedes" value={String(selectedReservation.guests_count ?? "—")} />
              <Info label="Total" value={money(Number(selectedReservation.total_amount ?? 0))} />
              <Info label="Estado" value={selectedReservation.status} />
              <Info label="Pago" value={selectedReservation.payment_status} />
              <Info label="Propiedad" value={selectedProperty?.name ?? "—"} />
            </div>
            {!canEdit && <p className="mt-3 text-xs text-muted-foreground">Tu rol puede consultar la reserva, pero no modificarla.</p>}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardContent ref={scrollRef} onScroll={() => syncScroll("main")} className="h-[calc(100vh-235px)] min-h-[420px] overflow-auto p-0">
          <div style={{ minWidth: fullWidth }}>
            <div className="sticky top-0 z-50 border-b bg-card shadow-md">
              <div className="flex">
                <div className="sticky left-0 z-[60] shrink-0 border-r bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ width: PROPERTY_WIDTH }}>Propiedad</div>
                <div className="flex" style={{ width: timelineWidth }}>
                  {monthGroups.map((month) => (
                    <div key={month.key} className="shrink-0 border-r bg-muted/50 py-2 text-xs font-semibold uppercase tracking-wide" style={{ width: month.days * DAY_WIDTH }}>
                      <span className="px-3">{month.name} {year}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex border-t">
                <div className="sticky left-0 z-[60] shrink-0 border-r bg-card" style={{ width: PROPERTY_WIDTH }} />
                <div className="flex" style={{ width: timelineWidth }}>
                  {columns.map((iso) => {
                    const d = new Date(`${iso}T12:00:00`);
                    const weekend = [0, 6].includes(d.getDay());
                    return (
                      <div key={iso} className={cn("shrink-0 border-r py-1 text-center leading-tight", weekend ? "bg-muted/60" : "bg-card", iso === today && "bg-[#FF5A5F]/10")} style={{ width: DAY_WIDTH }}>
                        <div className="text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString("es-MX", { weekday: "narrow" })}</div>
                        <div className={cn("text-sm font-semibold", iso === today && "text-[#FF5A5F]")}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {properties.map((property, propertyIndex) => {
              const propertyReservations = reservations.filter((r) => r.property_id === property.id && r.check_in < rangeEnd && r.check_out > rangeStart && !CANCELLED.includes(r.status));
              const propertyExternal = external.filter((e) => e.property_id === property.id && e.start_date < rangeEnd && e.end_date > rangeStart && e.status !== "cancelled");
              const propertyBlocks = blocks.filter((b) => b.property_id === property.id && b.start_date < rangeEnd && b.end_date > rangeStart);
              const timeline = [
                ...propertyReservations.map((r) => ({ id: `r-${r.id}`, reservationId: r.id, externalId: null as string | null, from: r.check_in, to: resizePreview?.id === r.id ? resizePreview.checkOut : r.check_out, name: guestById[r.guest_id ?? ""]?.full_name ?? r.code, amount: Number(r.total_amount ?? 0), guestsCount: Number(r.guests_count ?? 0), channel: r.channel, kind: "reservation" as const })),
                ...propertyExternal.map((e) => ({ id: `e-${e.id}`, reservationId: null as string | null, externalId: e.id, from: e.start_date, to: e.end_date, name: e.summary || e.channel, amount: null as number | null, guestsCount: 0, channel: e.channel, kind: "external" as const })),
                ...propertyBlocks.map((b) => ({ id: `b-${b.id}`, reservationId: null as string | null, externalId: null as string | null, from: b.start_date, to: b.end_date, name: b.reason || "Bloqueado", amount: null as number | null, guestsCount: 0, channel: "", kind: "block" as const })),
              ];

              return (
                <div key={property.id} className="flex border-b">
                  <div className={cn("sticky left-0 z-30 shrink-0 border-r px-3 py-2", propertyIndex % 2 === 0 ? "bg-card" : "bg-muted/40")} style={{ width: PROPERTY_WIDTH, height: ROW_HEIGHT }}>
                    <p className="truncate text-xs font-semibold">{property.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{property.code} · {property.location}</p>
                  </div>
                  <div className="relative bg-background" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                    {columns.map((iso, index) => {
                      const weekend = [0, 6].includes(new Date(`${iso}T12:00:00`).getDay());
                      return <div key={iso} className={cn("absolute inset-y-0 border-r border-border/70", weekend ? "bg-muted/50" : "bg-card")} style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }} />;
                    })}
                    {todayIndex >= 0 && <div className="absolute inset-y-0 z-[4] w-0.5 bg-[#FF5A5F]" style={{ left: todayIndex * DAY_WIDTH }} />}

                    {timeline.map((item) => {
                      const rawStart = dayDiff(rangeStart, item.from);
                      const rawEnd = dayDiff(rangeStart, item.to);
                      if (rawEnd <= 0 || rawStart >= totalDays) return null;
                      const startIndex = clamp(rawStart, 0, totalDays);
                      const endIndex = clamp(rawEnd, 0, totalDays);
                      const widthDays = Math.max(1, endIndex - startIndex);
                      const width = Math.max(DAY_WIDTH, widthDays * DAY_WIDTH);
                      const reservation = item.reservationId ? reservations.find((r) => r.id === item.reservationId) ?? null : null;
                      const labelText = item.kind === "reservation"
                        ? `${item.name} · ${item.channel} · ${shortDate(item.from)}–${shortDate(item.to)} · ${widthDays} noches`
                        : item.name;
                      const isSelected = Boolean(item.reservationId && item.reservationId === selectedReservationId);

                      return (
                        <div
                          key={item.id}
                          role={item.reservationId || item.externalId ? "button" : undefined}
                          tabIndex={item.reservationId || item.externalId ? 0 : -1}
                          onClick={() => {
                            if (item.reservationId) setSelectedReservationId(item.reservationId);
                            else if (item.externalId) setSelectedExternalId(item.externalId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            if (item.reservationId) setSelectedReservationId(item.reservationId);
                            else if (item.externalId) setSelectedExternalId(item.externalId);
                          }}
                          className="absolute inset-y-[7px] z-[10] overflow-visible"
                          style={{ left: startIndex * DAY_WIDTH + 2, width: width - 4 }}
                          title={`${item.name} · ${shortDate(item.from)} → ${shortDate(item.to)}`}
                        >
                          <div className={cn(
                            "absolute inset-0 flex items-center overflow-hidden rounded-full px-3 pr-14 text-left text-[11px] font-semibold text-white shadow-sm ring-1 ring-black/5",
                            item.kind === "block" ? "bg-[#334155]" : CHANNEL_COLOR[item.channel] ?? "bg-[#FF5A5F]",
                            item.kind === "external" && "border-2 border-dashed border-white/70",
                            (item.reservationId || item.externalId) && "cursor-pointer hover:brightness-105",
                            isSelected && "ring-2 ring-primary ring-offset-2",
                          )}>
                            <span className="block min-w-0 flex-1 truncate">{labelText}</span>
                          </div>

                          {reservation && canEdit && (
                            <>
                              <button type="button" className="absolute right-6 top-1/2 z-30 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-background text-foreground shadow-md hover:bg-muted" title="Editar reserva" onClick={(e) => { e.stopPropagation(); setSelectedReservationId(reservation.id); setEditingReservation(reservation); }}>
                                <Pencil className="size-3.5" />
                              </button>
                              <button type="button" className="absolute -right-1 top-1/2 z-40 grid h-9 w-6 -translate-y-1/2 cursor-ew-resize place-items-center rounded-md border border-white/80 bg-foreground text-background shadow-lg hover:scale-105" title="Arrastrar para agregar o quitar noches" onPointerDown={(e) => startResize(e, reservation)}>
                                <GripVertical className="size-4" />
                              </button>
                            </>
                          )}
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

      <div className="sticky bottom-2 z-[70] mt-2 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur">
        <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground"><span>Desplazar calendario</span><span>← meses y fechas →</span></div>
        <div ref={bottomScrollRef} onScroll={() => syncScroll("bottom")} className="w-full overflow-x-scroll overflow-y-hidden"><div style={{ width: fullWidth, height: 18 }} /></div>
      </div>

      <ReservationForm
        open={Boolean(editingReservation)}
        reservation={editingReservation}
        onOpenChange={(open) => { if (!open) setEditingReservation(null); }}
      />
      <ExternalEventDetailDialog event={selectedExternal} property={selectedExternalProperty} onOpenChange={(open) => { if (!open) setSelectedExternalId(null); }} />
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium" title={value}>{value}</p>
    </div>
  );
}
