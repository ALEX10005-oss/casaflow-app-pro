import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getEmailConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin" as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { emailConfig } = await import("./email-alerts.server");
    const { configured, senderDomain } = emailConfig();
    return { configured, senderDomain: senderDomain ?? null };
  });

export const sendEmailAlertTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin" as never);
    if (!isAdmin) throw new Error("Forbidden");

    const mod = await import("./email-alerts.server");
    const record = (status: string, error: string | null, providerId: string | null) =>
      context.supabase.rpc("platform_record_email_delivery" as never, {
        _platform_admin_user_id: context.userId,
        _incident_id: null,
        _severity: "test",
        _recipient: data.recipient,
        _status: status,
        _provider_message_id: providerId,
        _error_message: error,
      } as never);

    if (!mod.emailConfig().configured) {
      await record("skipped", "config_missing", null);
      return {
        status: "skipped" as const,
        error:
          "Falta configurar el dominio de correo del proyecto para poder enviar alertas por email.",
      };
    }

    const alert = {
      incident_id: "test",
      platform_admin_user_id: context.userId,
      recipient: data.recipient,
      severity: "test",
      title: "Mensaje de prueba del monitoreo",
      description: "Las alertas técnicas por correo del panel maestro están configuradas.",
      recommended_action: "No se requiere ninguna acción.",
      detected_at: new Date().toISOString(),
      org_name: "Global",
    };

    const result = await mod.sendAlertEmail(
      data.recipient,
      "CasaFlow · Mensaje de prueba de alertas técnicas",
      mod.buildAlertHtml(alert),
      mod.buildAlertText(alert),
    );

    await record(result.status, result.error ?? null, result.providerMessageId ?? null);
    return { status: result.status, error: result.error ?? null };
  });

export const dispatchEmailAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin" as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { dispatchPendingAlerts } = await import("./email-alerts.server");
    return await dispatchPendingAlerts(context.supabase);
  });
