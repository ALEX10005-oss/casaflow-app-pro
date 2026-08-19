import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAutomations, useGuests, useMessages, useProperties, useTemplates } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp y automatizaciones — CasaFlow" },
      {
        name: "description",
        content: "Plantillas y automatizaciones de mensajes al huésped: confirmación, instrucciones de llegada y salida.",
      },
      { property: "og:title", content: "WhatsApp — CasaFlow" },
      { property: "og:description", content: "Comunicación automatizada con huéspedes por evento de reserva." },
    ],
  }),
  component: Whatsapp,
});

const TRIGGERS: Record<string, string> = {
  reserva_confirmada: "Al confirmarse la reserva",
  pre_checkin: "24 h antes de la entrada",
  dia_checkin: "El día de la entrada",
  pre_checkout: "La noche antes de la salida",
  post_checkout: "Después de la salida",
};

function Whatsapp() {
  const qc = useQueryClient();
  const { data: templates = [] } = useTemplates();
  const { data: automations = [] } = useAutomations();
  const { data: messages = [] } = useMessages();
  const { data: guests = [] } = useGuests();
  const { data: properties = [] } = useProperties();
  const guestById = Object.fromEntries(guests.map((g) => [g.id, g]));
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const tplById = Object.fromEntries(templates.map((t) => [t.id, t]));

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("whatsapp_automations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp_automations"] });
      toast.success("Automatización actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="WhatsApp" subtitle="Mensajes automáticos al huésped en cada etapa de la estancia">
      <Tabs defaultValue="auto">
        <TabsList>
          <TabsTrigger value="auto">Automatizaciones</TabsTrigger>
          <TabsTrigger value="tpl">Plantillas</TabsTrigger>
          <TabsTrigger value="log">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="space-y-2 pt-4">
          {automations.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGERS[a.trigger_event] ?? a.trigger_event}
                    {a.template_id && ` · plantilla: ${tplById[a.template_id]?.name ?? "—"}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={a.active ? "text-success" : "text-muted-foreground"}>
                    {a.active ? "Activa" : "Pausada"}
                  </span>
                  <Switch checked={a.active} onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="tpl" className="grid gap-3 pt-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="log" className="space-y-2 pt-4">
          {messages.slice(0, 40).map((m) => (
            <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {guestById[m.guest_id ?? ""]?.full_name ?? "Huésped"} ·{" "}
                  <span className="text-muted-foreground">{m.property_id ? propById[m.property_id]?.name : ""}</span>
                </p>
                <p className="text-xs text-muted-foreground">{m.body}</p>
              </div>
              <div className="text-right">
                <StatusPill value={m.status} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(m.sent_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
