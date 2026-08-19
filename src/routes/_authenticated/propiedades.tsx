import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, MapPin, Users, Wifi } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, todayISO, useProperties, useReservations, type Property } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/propiedades")({
  head: () => ({
    meta: [
      { title: "Propiedades y fichas operativas — CasaFlow" },
      {
        name: "description",
        content: "Ficha completa de cada unidad: capacidad, horarios, claves de acceso, wifi e instrucciones de entrada.",
      },
      { property: "og:title", content: "Propiedades — CasaFlow" },
      { property: "og:description", content: "Fichas operativas de todas las unidades administradas." },
    ],
  }),
  component: Propiedades,
});

function Propiedades() {
  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Property | null>(null);
  const today = todayISO();

  const rows = properties.filter((p) =>
    `${p.code} ${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell title="Propiedades" subtitle={`${properties.length} unidades activas en la cartera`}>
      <Input
        className="mb-4 max-w-sm"
        placeholder="Buscar por código, nombre o zona"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => {
          const current = reservations.find(
            (r) => r.property_id === p.id && r.check_in <= today && r.check_out > today,
          );
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
                    <span className="flex items-center gap-1">
                      <Users className="size-3" /> {p.capacity} pax
                    </span>
                    <span>
                      {p.check_in_time} / {p.check_out_time}
                    </span>
                    <span className="font-medium text-foreground">{money(Number(p.nightly_rate))} / noche</span>
                  </div>
                  <p className="rounded-md bg-muted/60 px-2 py-1.5 text-xs">
                    {current
                      ? `Ocupada hasta ${current.check_out}`
                      : next
                        ? `Próxima entrada ${next.check_in}`
                        : "Sin reservas próximas"}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.address ?? selected?.location} · {selected?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Detail icon={Wifi} label="Wifi" value={`${selected?.wifi_name ?? "—"} · ${selected?.wifi_password ?? "—"}`} />
            <Detail icon={KeyRound} label="Código de acceso" value={selected?.access_code ?? "—"} />
            <Detail icon={Users} label="Capacidad" value={`${selected?.capacity ?? 0} huéspedes`} />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Instrucciones de llegada</p>
              <p className="mt-1 whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">
                {selected?.instructions ?? "Sin instrucciones registradas."}
              </p>
            </div>
          </div>
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
