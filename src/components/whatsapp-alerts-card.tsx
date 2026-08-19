import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  monitorDateTime,
  useSaveWhatsAppSettings,
  useWhatsAppDeliveries,
  useWhatsAppSettings,
} from "@/lib/monitor";
import {
  getWhatsAppConfigStatus,
  sendWhatsAppTest,
} from "@/lib/whatsapp-alerts.functions";
import { useQuery } from "@tanstack/react-query";

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  sent: { text: "Enviado", tone: "text-emerald-400" },
  failed: { text: "Error", tone: "text-red-400" },
  skipped: { text: "Omitido", tone: "text-neutral-400" },
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-amber-500"
      />
      {label}
    </label>
  );
}

export function WhatsAppAlertsCard() {
  const { data: settings } = useWhatsAppSettings();
  const { data: deliveries = [] } = useWhatsAppDeliveries();
  const save = useSaveWhatsAppSettings();
  const configStatus = useServerFn(getWhatsAppConfigStatus);
  const sendTest = useServerFn(sendWhatsAppTest);
  const { data: config } = useQuery({
    queryKey: ["platform", "wa-config"],
    queryFn: () => configStatus({}),
  });

  const [enabled, setEnabled] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [critical, setCritical] = useState(true);
  const [warning, setWarning] = useState(false);
  const [threshold, setThreshold] = useState(3);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.whatsapp_enabled);
    setRecipient(settings.whatsapp_recipient ?? "");
    setCritical(settings.notify_critical);
    setWarning(settings.notify_warning);
    setThreshold(settings.warning_repeat_threshold);
  }, [settings]);

  const onSave = () =>
    save.mutate(
      {
        whatsapp_enabled: enabled,
        whatsapp_recipient: recipient.trim() || null,
        notify_critical: critical,
        notify_warning: warning,
        warning_repeat_threshold: Number.isFinite(threshold) ? threshold : 3,
      },
      {
        onSuccess: () => toast.success("Configuración guardada"),
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const onTest = async () => {
    if (!recipient.trim()) {
      toast.error("Escribe un número destino en formato internacional");
      return;
    }
    setTesting(true);
    try {
      const res = await sendTest({ data: { recipient: recipient.trim() } });
      if (res.status === "sent") toast.success("Mensaje de prueba enviado");
      else toast.error(res.error ?? "No se pudo enviar el mensaje de prueba");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-base font-semibold">Alertas por WhatsApp</h2>
      <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm">
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            config?.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300",
          )}
        >
          {config?.configured
            ? "Credenciales de WhatsApp Business detectadas en el servidor."
            : "Faltan los secretos WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID. Las alertas se registran como omitidas hasta configurarlos."}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Toggle label="Activar alertas por WhatsApp" checked={enabled} onChange={setEnabled} />
            <Toggle label="Avisar incidentes críticos" checked={critical} onChange={setCritical} />
            <Toggle label="Avisar advertencias repetidas" checked={warning} onChange={setWarning} />
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Número destino (formato internacional)
              </span>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="+52 55 0000 0000"
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-amber-500"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Umbral de fallos consecutivos (advertencias)
              </span>
              <input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-amber-500"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSave}
            disabled={save.isPending}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {save.isPending ? "Guardando…" : "Guardar configuración"}
          </button>
          <button
            onClick={onTest}
            disabled={testing}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500 disabled:opacity-60"
          >
            {testing ? "Enviando…" : "Enviar alerta de prueba"}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Últimos envíos</p>
          {deliveries.length === 0 ? (
            <p className="text-xs text-neutral-600">Todavía no hay envíos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Fecha</th>
                    <th className="py-1 pr-3 font-medium">Tipo</th>
                    <th className="py-1 pr-3 font-medium">Estado</th>
                    <th className="py-1 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {deliveries.map((d) => {
                    const s = STATUS_LABEL[d.status] ?? {
                      text: d.status,
                      tone: "text-neutral-400",
                    };
                    return (
                      <tr key={d.id} className="border-t border-neutral-800">
                        <td className="py-1.5 pr-3">
                          {monitorDateTime(d.sent_at ?? d.created_at)}
                        </td>
                        <td className="py-1.5 pr-3">
                          {d.severity === "test" ? "Prueba" : (d.severity ?? "incidente")}
                        </td>
                        <td className={cn("py-1.5 pr-3 font-medium", s.tone)}>{s.text}</td>
                        <td className="py-1.5 text-neutral-500">{d.error_message ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
