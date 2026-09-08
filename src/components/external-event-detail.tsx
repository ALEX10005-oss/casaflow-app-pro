import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { money, nightsBetween, shortDate, type ExternalCalendarEvent, type Property } from "@/lib/casaflow";

const CHANNELS = ["Airbnb", "Booking", "VRBO", "Expedia", "Directa", "Otro"];

export function ExternalEventDetailDialog({ event, property, canEdit = false, onOpenChange }: { event: ExternalCalendarEvent | null; property: Property | null; canEdit?: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_phone: "", guests_count: "1", total_amount: "0", payment_status: "pendiente", channel: "Airbnb", notes: "" });

  useEffect(() => {
    if (!event) return;
    setEditing(false);
    setForm({ guest_name: event.guest_name ?? "", guest_email: event.guest_email ?? "", guest_phone: event.guest_phone ?? "", guests_count: String(event.guests_count ?? 1), total_amount: String(event.total_amount ?? 0), payment_status: event.payment_status ?? "pendiente", channel: event.channel, notes: event.notes ?? "" });
  }, [event]);

  async function save() {
    if (!event) return;
    if (!form.guest_name.trim()) return toast.error("Escribe el nombre del huésped.");
    setSaving(true);
    try {
      const { error } = await supabase.from("external_calendar_events").update({
        guest_name: form.guest_name.trim(), guest_email: form.guest_email.trim() || null, guest_phone: form.guest_phone.trim() || null,
        guests_count: Math.max(1, Number(form.guests_count) || 1), total_amount: Math.max(0, Number(form.total_amount) || 0),
        payment_status: form.payment_status, channel: form.channel, notes: form.notes.trim() || null,
      }).eq("id", event.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["external_calendar_events"] });
      setEditing(false);
      toast.success("Datos de la estancia guardados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los datos.");
    } finally { setSaving(false); }
  }

  return <Dialog open={Boolean(event)} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">{event && <>
    <DialogHeader><DialogTitle>{event.guest_name || event.summary || `Estancia de ${event.channel}`}</DialogTitle><DialogDescription>{property?.name ?? "Propiedad"} · sincronizada mediante iCal</DialogDescription></DialogHeader>
    {editing ? <div className="grid gap-4 sm:grid-cols-2">
      <Control label="Nombre del huésped"><Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} /></Control>
      <Control label="Canal"><Select value={form.channel} onValueChange={(channel) => setForm({ ...form, channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></Control>
      <Control label="Teléfono"><Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} /></Control>
      <Control label="Correo"><Input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} /></Control>
      <Control label="Número de huéspedes"><Input type="number" min="1" value={form.guests_count} onChange={(e) => setForm({ ...form, guests_count: e.target.value })} /></Control>
      <Control label="Importe pagado"><Input type="number" min="0" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /></Control>
      <Control label="Estado del pago"><Select value={form.payment_status} onValueChange={(payment_status) => setForm({ ...form, payment_status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="pagado">Pagado</SelectItem><SelectItem value="reembolsado">Reembolsado</SelectItem></SelectContent></Select></Control>
      <div className="sm:col-span-2"><Control label="Notas"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Control></div>
      <div className="flex gap-2 sm:col-span-2"><Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar datos"}</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button></div>
    </div> : <>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Propiedad" value={property?.name ?? "—"} /><Field label="Canal / origen" value={event.channel} /><Field label="Huésped" value={event.guest_name || "Pendiente de completar"} /><Field label="Importe" value={money(Number(event.total_amount ?? 0))} /><Field label="Entrada" value={shortDate(event.start_date)} /><Field label="Salida" value={shortDate(event.end_date)} /><Field label="Noches" value={String(nightsBetween(event.start_date, event.end_date))} /><Field label="Personas" value={String(event.guests_count ?? 1)} /><Field label="Teléfono" value={event.guest_phone || "—"} /><Field label="Correo" value={event.guest_email || "—"} /><Field label="Pago" value={event.payment_status ?? "pendiente"} /><Field label="Sincronización" value={event.status} /></div>
      {event.notes && <Field label="Notas" value={event.notes} />}
      <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">iCal mantiene fechas y disponibilidad. Los datos agregados aquí permanecen en CasaFlow aunque el canal vuelva a sincronizar.</p>
      {canEdit && <Button onClick={() => setEditing(true)}>Completar o editar datos</Button>}
    </>}
  </>}</DialogContent></Dialog>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Field({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words font-medium">{value}</p></div>; }
