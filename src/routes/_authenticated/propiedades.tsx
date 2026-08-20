import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, MapPin, Pencil, Plus, Trash2, Users, Wifi } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PropertyCalendarsPanel } from "@/components/property-calendars-panel";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PropertyForm } from "@/components/property-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, todayISO, useDeleteProperty, useProperties, useReservations, type Property } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/propiedades")({
  head: () => ({
    meta: [
      { title: "Propiedades y fichas operativas — CasaFlow" },
      {
        name: "description",
        content: "Ficha de cada unidad, accesos e integraciones iCal de Airbnb, Booking y VRBO.",
      },
      { property: "og:title", content: "Propiedades — CasaFlow" },
      { property: "og:description", content: "Fichas operativas e iCal por propiedad." },
    ],
  }),
  component: Propiedades,
});

function Propiedades() {
  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Property | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const remove = useDeleteProperty();
  const today = todayISO();

  const rows = properties.filter((p) =>
    `${p.code} ${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell title="Propiedades" subtitle={`${properties.length} unidades activas en la cartera`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-sm"
          placeholder="Buscar por código, nombre o zona"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" /> Nueva propiedad
        </Button>
      </div>

      {properties.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-display text-lg font-semibold">Aún no hay propiedades</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrega tu primera unidad para empezar a operar reservas, calendarios y finanzas.
          </p>
          <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="size-4" /> Agregar propiedad
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => {
          const current = reservations.find((r) => r.property_id === p.id && r.check_in <= today && r.check_out > today);
          const next = reservations.find((r) => r.property_id === p.id && r.check_in > today);
          return (
            <button key={p.id} onClick={() => setSelected(p)} className="text-left">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-base font-semibold">{p.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {p.location} · {p.code}
                      </p>
                    </div>
                    <StatusPill value={p.status} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="size-3" /> {p.capacity} pax</span>
                    <span>{p.check_in_time} / {p.check_out_time}</span>
                    <span className="font-medium text-foreground">{money(Number(p.nightly_rate))} / noche</span>
                  </div>
                  <div className="flex gap-2">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setEditing(p); setFormOpen(true); }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Pencil className="size-3" /> Editar
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`¿Eliminar ${p.name}?`)) return;
                        try {
                          await remove.mutateAsync(p.id);
                          toast.success("Propiedad eliminada.");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" /> Eliminar
                    </span>
                  </div>
                  <p className="rounded-md bg-muted/60 px-2 py-1.5 text-xs">
                    {current ? `Ocupada hasta ${current.check_out}` : next ? `Próxima entrada ${next.check_in}` : "Sin reservas próximas"}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <PropertyForm open={formOpen} onOpenChange={setFormOpen} property={editing} />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{selected?.name}</DialogTitle>
            <DialogDescription>{selected?.address ?? selected?.location} · {selected?.code}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Detail icon={Wifi} label="Wifi" value={`${selected.wifi_name ?? "—"} · ${selected.wifi_password ?? "—"}`} />
              <Detail icon={KeyRound} label="Código de acceso" value={selected.access_code ?? "—"} />
              <Detail icon={Users} label="Capacidad" value={`${selected.capacity ?? 0} huéspedes`} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Instrucciones de llegada</p>
                <p className="mt-1 whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">
                  {selected.instructions ?? "Sin instrucciones registradas."}
                </p>
              </div>
              <PropertyCalendarsPanel property={selected} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Wifi; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <Icon className="size-4 text-muted-foreground" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
