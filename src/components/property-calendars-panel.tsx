import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeletePropertyCalendar,
  usePropertyCalendars,
  useSavePropertyCalendar,
  type Property,
} from "@/lib/casaflow";
import { syncPropertyCalendar } from "@/lib/ical.functions";

const CHANNELS = ["Airbnb", "Booking", "VRBO", "Otro"];

export function PropertyCalendarsPanel({ property }: { property: Property }) {
  const { data: all = [] } = usePropertyCalendars();
  const calendars = useMemo(() => all.filter((c) => c.property_id === property.id), [all, property.id]);
  const save = useSavePropertyCalendar();
  const remove = useDeletePropertyCalendar();
  const sync = useServerFn(syncPropertyCalendar);

  const [channel, setChannel] = useState("Airbnb");
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const exportUrl =
    typeof window === "undefined"
      ? `/api/public/ical/${property.ical_token}.ics`
      : `${window.location.origin}/api/public/ical/${property.ical_token}.ics`;

  async function addCalendar() {
    if (!url.trim()) {
      toast.error("Pega el enlace iCal del canal.");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      toast.error("La URL iCal no es válida.");
      return;
    }

    try {
      await save.mutateAsync({
        property_id: property.id,
        channel,
        ical_url: url.trim(),
      });
      setUrl("");
      toast.success("Calendario guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  async function runSync(id: string) {
    setSyncing(id);
    try {
      const result = await sync({ data: { calendar_id: id } });
      toast.success(`Sincronizado: ${result.events} evento(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo sincronizar.");
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <p className="font-medium">Calendarios / iCal</p>
        <p className="text-xs text-muted-foreground">
          Pega aquí los enlaces iCal de Airbnb, Booking o VRBO para importar ocupación.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="https://.../calendar.ics" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="button" onClick={addCalendar} disabled={save.isPending}>
          <Plus className="size-4" /> Agregar
        </Button>
      </div>

      <div className="space-y-2">
        {calendars.map((c) => (
          <div key={c.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{c.channel}</p>
                <p className="truncate text-xs text-muted-foreground">{c.ical_url}</p>
                <p className="text-[11px] text-muted-foreground">
                  Estado: {c.status} · Eventos: {c.events_count}
                  {c.last_sync ? ` · Última sync: ${new Date(c.last_sync).toLocaleString("es-MX")}` : ""}
                </p>
                {c.last_error && <p className="mt-1 text-xs text-destructive">{c.last_error}</p>}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={syncing === c.id}
                  onClick={() => runSync(c.id)}
                >
                  <RefreshCw className="size-3.5" />
                  {syncing === c.id ? "Sincronizando…" : "Sincronizar"}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Eliminar calendario"
                  onClick={async () => {
                    if (!confirm(`¿Eliminar el calendario ${c.channel}?`)) return;
                    try {
                      await remove.mutateAsync(c.id);
                      toast.success("Calendario eliminado.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "No se pudo eliminar.");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {calendars.length === 0 && (
          <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            Esta propiedad todavía no tiene calendarios externos.
          </p>
        )}
      </div>

      <div className="rounded-md border p-3">
        <p className="text-sm font-medium">Enlace iCal de CasaFlow</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">{exportUrl}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => navigator.clipboard.writeText(exportUrl).then(() => toast.success("Enlace copiado."))}
        >
          <Copy className="size-3.5" /> Copiar enlace
        </Button>
      </div>
    </div>
  );
}
