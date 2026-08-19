import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, ROLE_SCOPE, homeForRole, type AppRole } from "@/lib/casaflow";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Invitación de equipo — CasaFlow" },
      {
        name: "description",
        content:
          "Acepta la invitación de tu empresa administradora y entra a CasaFlow con el rol asignado.",
      },
      { property: "og:title", content: "Invitación de equipo — CasaFlow" },
      { property: "og:description", content: "Activa tu acceso de trabajador en CasaFlow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

type Preview =
  | { valid: false; reason: string }
  | {
      valid: true;
      email: string;
      full_name: string | null;
      role: AppRole;
      message: string | null;
      org_name: string;
    };

const REASON: Record<string, string> = {
  invalid: "Este enlace de invitación no es válido.",
  expired: "Este enlace caducó. Pide a tu administrador que te lo reenvíe.",
  accepted: "Esta invitación ya fue utilizada.",
  revoked: "Esta invitación fue cancelada por el administrador.",
};

const ACCEPT_ERROR: Record<string, string> = {
  email_mismatch: "Tu sesión usa otro correo. Cierra sesión y entra con el correo invitado.",
  expired_invitation: "El enlace caducó. Pide a tu administrador que te lo reenvíe.",
  account_already_belongs_to_another_org:
    "Esta cuenta ya pertenece a otra empresa. Usa un correo distinto para unirte a este equipo.",

  revoked_invitation: "La invitación fue cancelada.",
  already_used: "Esta invitación ya fue utilizada por otra cuenta.",
  invalid_invitation: "Este enlace de invitación no es válido.",
  max_users_reached: "La empresa alcanzó su límite de usuarios. Avisa a tu administrador.",
};

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("invitation_preview", { _token: token });
      if (error) throw error;
      return data as unknown as Preview;
    },
    retry: false,
  });

  const { data: session } = useQuery({
    queryKey: ["invite-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  async function finish() {
    const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
    if (error) {
      const key = Object.keys(ACCEPT_ERROR).find((k) => error.message.includes(k));
      throw new Error(key ? ACCEPT_ERROR[key]! : error.message);
    }
    const role = (data as unknown as { role: AppRole }).role;
    qc.clear();
    toast.success("Acceso activado. Bienvenido a CasaFlow.");
    navigate({ to: homeForRole(role), replace: true });
  }

  async function acceptExisting() {
    setBusy(true);
    try {
      await finish();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aceptar la invitación.");
    }
    setBusy(false);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || !preview.valid) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: preview.email,
        password,
        options: {
          data: { invited: "true", first_name: preview.full_name ?? "" },
        },
      });
      if (error) {
        if (/already registered/i.test(error.message)) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: preview.email,
            password,
          });
          if (signInErr) throw new Error("Ya existe una cuenta con ese correo. Escribe tu contraseña actual.");
        } else if (/at least 6 characters/i.test(error.message)) {
          throw new Error("La contraseña debe tener al menos 6 caracteres.");
        } else {
          throw new Error(error.message);
        }
      }
      if (!(await supabase.auth.getSession()).data.session) {
        await supabase.auth.signInWithPassword({ email: preview.email, password });
      }
      await finish();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo activar el acceso.");
    }
    setBusy(false);
  }

  async function switchAccount() {
    await supabase.auth.signOut();
    qc.clear();
    window.location.reload();
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Verificando invitación…
      </div>
    );
  }

  if (!preview || !preview.valid) {
    return (
      <Shell title="Invitación no disponible">
        <p className="text-sm text-muted-foreground">
          {REASON[(preview as { reason?: string } | undefined)?.reason ?? "invalid"] ?? REASON["invalid"]}
        </p>
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>
          Ir al acceso
        </Button>
      </Shell>
    );
  }

  const sameEmail = session?.user?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <Shell title={`${preview.org_name} te invitó a su equipo`}>
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-medium">{ROLE_LABEL[preview.role] ?? preview.role}</p>
        <p className="text-xs text-muted-foreground">{ROLE_SCOPE[preview.role]}</p>
        <p className="mt-2 text-xs text-muted-foreground">Correo invitado: {preview.email}</p>
      </div>
      {preview.message && (
        <p className="rounded-md bg-muted p-3 text-sm">{preview.message}</p>
      )}

      {session && sameEmail && (
        <Button className="w-full" disabled={busy} onClick={acceptExisting}>
          Aceptar invitación
        </Button>
      )}

      {session && !sameEmail && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Tu sesión actual es {session.user.email}. Esta invitación es para {preview.email}.
          </p>
          <Button variant="outline" className="w-full" onClick={switchAccount}>
            Cerrar sesión y continuar
          </Button>
        </div>
      )}

      {!session && (
        <form onSubmit={createAccount} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-mail">Correo</Label>
            <Input id="inv-mail" value={preview.email} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-pass">Crea tu contraseña</Label>
            <Input
              id="inv-pass"
              type="password"
              value={password}
              minLength={6}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Activar mi acceso
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Si ya tienes cuenta con este correo, escribe tu contraseña actual.
          </p>
        </form>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <ShieldCheck className="size-6 text-muted-foreground" />
          <CardTitle className="font-display text-xl">{title}</CardTitle>
          <CardDescription>
            El acceso, la empresa y el rol los define tu administrador. No puedes cambiarlos aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
