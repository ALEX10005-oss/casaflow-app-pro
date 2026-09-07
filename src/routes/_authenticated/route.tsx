import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMyContext, homeForRole, type AppRole, type MyContext } from "@/lib/casaflow";

/** Rutas permitidas por rol. `null` = acceso administrativo completo. */
export function allowedPaths(role: AppRole | null): string[] | null {
  if (role === "owner" || role === "manager") return null;
  if (role === "accounting") return ["/finanzas", "/reportes"];
  if (role === "reception") return ["/trabajo", "/calendario", "/reservas", "/huespedes"];
  if (role === "cleaning" || role === "maintenance") return ["/trabajo"];
  return [];
}

function isAllowed(pathname: string, role: AppRole | null) {
  const allowed = allowedPaths(role);
  if (allowed === null) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const ctx = await fetchMyContext();
    if (!ctx?.org_id || !ctx.role) throw redirect({ to: "/pendiente" });

    const blocked = ctx.license_status !== "active" || ctx.access_status !== "active";
    if (!blocked && !isAllowed(location.pathname, ctx.role)) {
      throw redirect({ to: homeForRole(ctx.role) });
    }
    return { user: data.user, ctx, blocked };
  },
  component: Guard,
});

function Guard() {
  const { ctx, blocked } = Route.useRouteContext();
  if (blocked) return <Blocked ctx={ctx} />;
  return <Outlet />;
}

function Blocked({ ctx: _ctx }: { ctx: MyContext }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Lock className="size-6 text-muted-foreground" />
          <CardTitle className="font-display text-xl">Servicio temporalmente inactivo</CardTitle>
          <CardDescription>
            Tu acceso a CasaFlow no está disponible en este momento. Ponte en contacto con soporte
            para revisar el estado de tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Tu información permanece guardada mientras el servicio no está disponible.</p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
