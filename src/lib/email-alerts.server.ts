import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailSendResult = {
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

/** Configuración del envío por correo (infraestructura de email de Lovable). */
export function emailConfig() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const senderDomain = process.env["EMAIL_SENDER_DOMAIN"];
  return {
    apiKey,
    senderDomain,
    configured: Boolean(apiKey && senderDomain),
  };
}

function sanitize(message: string) {
  const { apiKey } = emailConfig();
  let out = message;
  if (apiKey) out = out.split(apiKey).join("[secret]");
  return out.slice(0, 300);
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

export function buildAlertSubject(a: Pick<PendingAlert, "severity" | "title" | "org_name">) {
  const head = a.severity === "critical" ? "ALERTA CRÍTICA" : "Advertencia";
  return `CasaFlow · ${head} · ${a.org_name} · ${a.title}`;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildAlertHtml(a: PendingAlert) {
  const head = a.severity === "critical" ? "ALERTA CRÍTICA" : "ADVERTENCIA";
  const color = a.severity === "critical" ? "#dc2626" : "#d97706";
  const rows: Array<[string, string]> = [
    ["Empresa afectada", a.org_name],
    ["Problema", a.title],
    ["Fecha y hora", formatWhen(a.detected_at)],
    ["Descripción", a.description ?? "Sin descripción adicional"],
    ["Acción recomendada", a.recommended_action ?? "Revisar el panel maestro"],
  ];
  return `<!doctype html><html lang="es"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#737373">CasaFlow · Monitoreo de plataforma</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:${color}">${head}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;color:#737373;width:38%;vertical-align:top">${k}</td><td style="padding:8px 0;vertical-align:top">${escape(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#525252">Revisa el detalle en <strong>/control/sistema</strong> del panel maestro.</p>
  </div></body></html>`;
}

export function buildAlertText(a: PendingAlert) {
  const head = a.severity === "critical" ? "CasaFlow ALERTA CRÍTICA" : "CasaFlow ADVERTENCIA";
  return [
    head,
    `Empresa: ${a.org_name}`,
    `Problema: ${a.title}`,
    `Detectado: ${formatWhen(a.detected_at)}`,
    `Descripción: ${a.description ?? "Sin descripción adicional"}`,
    `Acción: ${a.recommended_action ?? "Revisar el panel maestro"}`,
    "Revisa: /control/sistema",
  ].join("\n");
}

export function isValidEmail(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/** Envía un correo por la infraestructura de email de Lovable. Nunca expone secretos. */
export async function sendAlertEmail(
  recipient: string,
  subject: string,
  html: string,
  text: string,
  idempotencyKey?: string,
): Promise<EmailSendResult> {
  const { apiKey, senderDomain, configured } = emailConfig();
  if (!configured) return { status: "skipped", error: "config_missing" };
  if (!isValidEmail(recipient)) return { status: "skipped", error: "invalid_recipient" };

  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const res = await sendLovableEmail(
      {
        to: recipient.trim(),
        from: `CasaFlow Monitor <alertas@${senderDomain}>`,
        sender_domain: senderDomain!,
        subject,
        html,
        text,
        purpose: "transactional",
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
      { apiKey: apiKey!, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
    if (!res.success) return { status: "failed", error: sanitize(res.status ?? "send_failed") };
    return { status: "sent", providerMessageId: res.message_id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "email_error";
    return { status: "failed", error: sanitize(msg) };
  }
}

/** Procesa la cola de alertas pendientes y registra cada intento. */
export async function dispatchPendingAlerts(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("platform_pending_email_alerts" as never);
  if (error) throw new Error(error.message);
  const pending = (data ?? []) as unknown as PendingAlert[];
  const config = emailConfig();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const alert of pending) {
    const result = config.configured
      ? await sendAlertEmail(
          alert.recipient,
          buildAlertSubject(alert),
          buildAlertHtml(alert),
          buildAlertText(alert),
          `incident-${alert.incident_id}-${alert.severity}`,
        )
      : ({ status: "skipped", error: "config_missing" } as EmailSendResult);

    if (result.status === "sent") sent += 1;
    else if (result.status === "failed") failed += 1;
    else skipped += 1;

    await admin.rpc("platform_record_email_delivery" as never, {
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
