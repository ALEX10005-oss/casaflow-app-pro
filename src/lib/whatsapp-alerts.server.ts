import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppSendResult = {
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | undefined;
  error?: string | undefined;
};

export type PendingAlert = {
  incident_id: string;
  platform_admin_user_id: string;
  recipient: string;
  severity: string;
  title: string;
  description: string | null;
  recommended_action: string | null;
  detected_at: string;
  org_name: string;
};

const GRAPH_VERSION = "v21.0";

export function whatsappConfig() {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  return {
    token,
    phoneNumberId,
    configured: Boolean(token && phoneNumberId),
  };
}

function sanitize(message: string) {
  const { token } = whatsappConfig();
  let out = message.replace(/EAA[A-Za-z0-9_-]{10,}/g, "[token]");
  if (token) out = out.split(token).join("[token]");
  return out.slice(0, 300);
}

export function normalizeRecipient(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

export function buildAlertMessage(a: PendingAlert) {
  const when = new Date(a.detected_at).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
  const head = a.severity === "critical" ? "CasaFlow ALERTA CRÍTICA" : "CasaFlow ADVERTENCIA";
  return [
    head,
    `Empresa: ${a.org_name}`,
    `Problema: ${a.title}`,
    `Detectado: ${when}`,
    `Acción: ${a.recommended_action ?? "Revisar el panel maestro"}`,
    "Revisa: /control/sistema",
  ].join("\n");
}

/** Envía un mensaje de texto por WhatsApp Business Cloud API. Nunca expone el token. */
export async function sendWhatsAppText(
  recipient: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const { token, phoneNumberId, configured } = whatsappConfig();
  if (!configured) {
    return { status: "skipped", error: "config_missing" };
  }
  const to = normalizeRecipient(recipient);
  if (to.length < 8) return { status: "skipped", error: "invalid_recipient" };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      return {
        status: "failed",
        error: sanitize(json.error?.message ?? `HTTP ${res.status}`),
      };
    }
    return { status: "sent", providerMessageId: json.messages?.[0]?.id };
  } catch (e) {
    return { status: "failed", error: sanitize(e instanceof Error ? e.message : "network_error") };
  }
}

/** Procesa la cola de alertas pendientes y registra cada intento. */
export async function dispatchPendingAlerts(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("platform_pending_whatsapp_alerts" as never);
  if (error) throw new Error(error.message);
  const pending = (data ?? []) as unknown as PendingAlert[];
  const config = whatsappConfig();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const alert of pending) {
    const result = config.configured
      ? await sendWhatsAppText(alert.recipient, buildAlertMessage(alert))
      : ({ status: "skipped", error: "config_missing" } as WhatsAppSendResult);

    if (result.status === "sent") sent += 1;
    else if (result.status === "failed") failed += 1;
    else skipped += 1;

    await admin.rpc("platform_record_whatsapp_delivery" as never, {
      _platform_admin_user_id: alert.platform_admin_user_id,
      _incident_id: alert.incident_id,
      _severity: alert.severity,
      _recipient: alert.recipient,
      _status: result.status,
      _provider_message_id: result.providerMessageId ?? null,
      _error_message: result.error ?? null,
    } as never);
  }

  return { pending: pending.length, sent, failed, skipped, configured: config.configured };
}
