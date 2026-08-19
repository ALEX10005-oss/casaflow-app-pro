import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type InviteInput = {
  email: string;
  full_name: string;
  role: string;
  property_ids: string[];
  message?: string | undefined;
  origin: string;
};

type InviteResult = {
  invitation_id: string;
  link: string;
  email: string;
  emailStatus: "sent" | "failed" | "skipped";
  emailError?: string | undefined;
};

/**
 * Crea la invitación con la sesión del administrador (RLS y validaciones en la
 * función de base de datos: rol, licencia activa y límite de usuarios) y envía
 * el enlace de un solo uso por correo. El token nunca se persiste en claro.
 */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => input)
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const mod = await import("./invitations.server");
    const origin = mod.safeOrigin(data.origin);
    if (!origin) throw new Error("invalid_origin");

    const { data: created, error } = await context.supabase.rpc("org_invite_member", {
      _email: data.email,
      _full_name: data.full_name,
      _role: data.role as never,
      _property_ids: data.property_ids,
      _message: data.message ?? undefined,
    });
    if (error) throw new Error(error.message);

    const info = created as unknown as {
      invitation_id: string;
      token: string;
      email: string;
      org_name: string;
      role: string;
    };
    const link = `${origin}/invite/${info.token}`;
    const sent = await mod.sendInvitationEmail({
      recipient: info.email,
      orgName: info.org_name,
      role: info.role,
      link,
      message: data.message ?? null,
      idempotencyKey: `invite-${info.invitation_id}`,
    });

    return {
      invitation_id: info.invitation_id,
      link,
      email: info.email,
      emailStatus: sent.status,
      emailError: sent.error,
    };
  });

/** Regenera el token de una invitación pendiente y reenvía el correo. */
export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invitation_id: string; origin: string }) => input)
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const mod = await import("./invitations.server");
    const origin = mod.safeOrigin(data.origin);
    if (!origin) throw new Error("invalid_origin");

    const { data: created, error } = await context.supabase.rpc("org_resend_invitation", {
      _id: data.invitation_id,
    });
    if (error) throw new Error(error.message);

    const info = created as unknown as {
      invitation_id: string;
      token: string;
      email: string;
      org_name: string;
      role: string;
    };
    const link = `${origin}/invite/${info.token}`;
    const sent = await mod.sendInvitationEmail({
      recipient: info.email,
      orgName: info.org_name,
      role: info.role,
      link,
      idempotencyKey: `invite-${info.invitation_id}-${Date.now()}`,
    });

    return {
      invitation_id: info.invitation_id,
      link,
      email: info.email,
      emailStatus: sent.status,
      emailError: sent.error,
    };
  });
