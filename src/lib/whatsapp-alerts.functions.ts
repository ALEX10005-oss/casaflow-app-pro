import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWhatsAppConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin" as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { whatsappConfig } = await import("./whatsapp-alerts.server");
    const { configured } = whatsappConfig();
    return { configured };
  });

export const sendWhatsAppTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin" as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { sendWhatsAppText, whatsappConfig } = await import("./whatsapp-alerts.server");
    if (!whatsappConfig().configured) {
      await context.supabase.rpc("platform_record_whatsapp_delivery" as never, {
        _platform_admin_user_id: context.userId,
        _incident_id: null,
        _severity: "test",
        _recipient: data.recipient,
        _status: "skipped",
        _provider_message_id: null,
        _error_message: "config_missing",
      } as never);
      return {
        status: "skipped" as const,
        error:
          "Faltan los secretos de WhatsApp (WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID).",
      };
    }

    const result = await sendWhatsAppText(
      data.recipient,
      "CasaFlow · Mensaje de prueba\nLas alertas por WhatsApp del panel maestro están configuradas correctamente.",
    );

    await context.supabase.rpc("platform_record_whatsapp_delivery" as never, {
      _platform_admin_user_id: context.userId,
      _incident_id: null,
      _severity: "test",
      _recipient: data.recipient,
      _status: result.status,
      _provider_message_id: result.providerMessageId ?? null,
      _error_message: result.error ?? null,
    } as never);

    return { status: result.status, error: result.error ?? null };
  });

export const dispatchWhatsAppAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin" as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { dispatchPendingAlerts } = await import("./whatsapp-alerts.server");
    return await dispatchPendingAlerts(context.supabase);
  });
