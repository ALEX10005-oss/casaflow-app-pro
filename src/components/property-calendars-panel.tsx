import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useDeletePropertyCalendar, usePropertyCalendars, type Property } from "@/lib/casaflow";
import { syncPropertyCalendar } from "@/lib/ical.functions";

const CHANNELS = ["Airbnb", "Booking", "VRBO", "Expedia", "Otro"];

export function PropertyCalendarsPanel({ property }: { property: Property }) {
  const qc = useQueryClient();
  const { data: all = [] } = usePropertyCalendars();
  const calendars = useMemo(() => all.filter((calendar) => calendar.property_id === property.id), [all, property.id]);
  const remove = useDeletePropertyCalendar();
  const sync = useServerFn(syncPropertyCalendar);
  const [channel, setChannel] = useState("Airbnb");
  const [listingName, setListingName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const exportUrl = typeof window === "undefined"
    ? `/api/public/ical/${property.ical_token}.ics`
    : `${window.location.origin}/api/public/ical/${property.ical_token}.ics`;

  async function addCalendar() {
    try {
      new URL(url.trim());
      setSaving(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sesión no válida.");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("org_id").eq("id", auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.org_id) throw new Error("Tu usuario no tiene organización asignada.");
      const { error } = await supabase.from("property_calendars").insert({
        org_id: profile.org_id,
        property_id: property.id,
        channel,
        ical_url: url.trim(),
        listing_name: listingName.trim() || null,
        active: true,
        status: "pending",
      });
      if (error) throw error;
      setUrl("");
      setListingName("");
      await qc.invalidateQueries({ queryKey: ["property_calendars"] });
      toast.success("Calendario iCal guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "El enlace iCal no es válido.");
    } finally {
      setSaving(false);
    }
  }

  async function runSync(id: string) {
    setSyncing(id);
    try {
      const result = await sync({ data: { calendar_id: id } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["property_calendars"] }),
        qc.invalidateQueries({ queryKey: ["external_calendar_events"] }),
      ]);
      toast.success(`Sincronizado: ${result.events} estancia(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo sincronizar.");
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <p className="font-medium">Calendarios externos iCal</p>
        <p className="text-xs text-muted-foreground">Agrega el enlace de cada canal. Las fechas se sincronizan automáticamente y los datos privados se completan desde el Calendario PMS.</p>
      </div>
      <div className="grid gap-2 lg:grid-cols-[130px_220px_1fr_auto]">
        <Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Nombre del anuncio (opcional)" value={listingName} onChange={(event) => setListingName(event.target.value)} />
        <Input placeholder="https://.../calendar.ics" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Button type="button" onClick={addCalendar} disabled={saving || !url.trim()}><Plus className="size-4" />{saving ? "Guardando…" : "Agregar"}</Button>
      </div>
      <div className="space-y-2">
        {calendars.map((calendar) => (
          <div key={calendar.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-medium">{calendar.channel}{calendar.listing_name ? ` · ${calendar.listing_name}` : ""}</p><p className="truncate text-xs text-muted-foreground">{calendar.ical_url}</p><p className="text-[11px] text-muted-foreground">Estado: {calendar.status} · Estancias: {calendar.events_count}{calendar.last_sync ? ` · Última sincronización: ${new Date(calendar.last_sync).toLocaleString("es-MX")}` : ""}</p>{calendar.last_error && <p className="mt-1 text-xs text-destructive">{calendar.last_error}</p>}</div>
              <div className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={syncing === calendar.id} onClick={() => runSync(calendar.id)}><RefreshCw className="size-3.5" />{syncing === calendar.id ? "Sincronizando…" : "Sincronizar"}</Button><Button type="button" size="icon" variant="ghost" aria-label="Eliminar calendario" onClick={async () => { if (!confirm(`¿Eliminar el calendario ${calendar.channel}?`)) return; await remove.mutateAsync(calendar.id); toast.success("Calendario eliminado."); }}><Trash2 className="size-4" /></Button></div>
            </div>
          </div>
        ))}
        {!calendars.length && <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">Esta propiedad todavía no tiene calendarios externos.</p>}
      </div>
      <div className="rounded-md border p-3"><p className="text-sm font-medium">Enlace iCal de CasaFlow</p><p className="mt-1 break-all text-xs text-muted-foreground">{exportUrl}</p><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(exportUrl).then(() => toast.success("Enlace copiado."))}><Copy className="size-3.5" />Copiar enlace</Button></div>
    </div>
  );
}
