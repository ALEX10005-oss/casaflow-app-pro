import { emailConfig, generateIdempotencyKey, isValidEmail } from "./email-alerts.server";

export const ROLE_NAME: Record<string, string> = {
  manager: "Administrador",
  reception: "Recepción",
  cleaning: "Limpieza",
  maintenance: "Mantenimiento",
  accounting: "Contabilidad",
  owner: "Propietario",
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Valida el origen recibido del cliente antes de construir un enlace de invitación. */
export function safeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildInviteHtml(args: {
  orgName: string;
  role: string;
  link: string;
  message?: string | null;
}) {
  const role = ROLE_NAME[args.role] ?? args.role;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#737373">CasaFlow</p>
    <h1 style="margin:0 0 12px;font-size:20px">${escape(args.orgName)} te invitó a su equipo</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Tu acceso será con el rol <strong>${escape(role)}</strong>. Abre el enlace, crea tu contraseña y entra directo a tus tareas.</p>
    ${args.message ? `<p style="margin:0 0 16px;padding:12px;background:#f5f5f4;border-radius:8px;font-size:14px">${escape(args.message)}</p>` : ""}
    <p style="margin:0 0 20px"><a href="${args.link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Aceptar invitación</a></p>
    <p style="margin:0;font-size:12px;color:#737373">El enlace es de un solo uso y caduca en 7 días. Si no esperabas esta invitación, ignora este correo.</p>
  </div></body></html>`;
}

export function buildInviteText(args: { orgName: string; role: string; link: string }) {
  return [
    `${args.orgName} te invitó a su equipo en CasaFlow.`,
    `Rol asignado: ${ROLE_NAME[args.role] ?? args.role}`,
    `Aceptar invitación: ${args.link}`,
    "El enlace es de un solo uso y caduca en 7 días.",
  ].join("\n");
}

export async function sendInvitationEmail(args: {
  recipient: string;
  orgName: string;
  role: string;
  link: string;
  message?: string | null;
  idempotencyKey: string;
}) {
  const { apiKey, senderDomain, configured } = emailConfig();
  if (!configured) return { status: "skipped" as const, error: "config_missing" };
  if (!isValidEmail(args.recipient)) return { status: "skipped" as const, error: "invalid_recipient" };

  const key = args.idempotencyKey?.trim() || generateIdempotencyKey("invite");
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const res = await sendLovableEmail(
      {
        to: args.recipient.trim(),
        from: `CasaFlow <invitaciones@${senderDomain}>`,
        sender_domain: senderDomain!,
        subject: `${args.orgName} te invitó a su equipo en CasaFlow`,
        html: buildInviteHtml(args),
        text: buildInviteText(args),
        purpose: "transactional",
        idempotency_key: key,
      },
      { apiKey: apiKey!, idempotencyKey: key },
    );
    if (!res.success) return { status: "failed" as const, error: (res.status ?? "send_failed").slice(0, 200) };
    return { status: "sent" as const };
  } catch (e) {
    return { status: "failed" as const, error: (e instanceof Error ? e.message : "email_error").slice(0, 200) };
  }
}
