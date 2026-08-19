import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkerShell } from "@/components/worker-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABEL, ROLE_SCOPE, useMyContext, useProfile, useProperties } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/trabajo/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil de trabajo — CasaFlow" },
      {
        name: "description",
        content:
          "Consulta tu rol, empresa y propiedades asignadas en CasaFlow, y cierra sesión de forma segura.",
      },
      { property: "og:title", content: "Mi perfil de trabajo — CasaFlow" },
      { property: "og:description", content: "Rol, empresa y propiedades asignadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: ctx } = useMyContext();
  const { data: profile } = useProfile();
  const { data: properties = [] } = useProperties();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <WorkerShell title="Mi perfil">
      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <Line label="Nombre" value={`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "—"} />
          <Line label="Correo" value={profile?.email ?? "—"} />
          <Line label="Empresa" value={ctx?.org_name ?? "—"} />
          <Line label="Rol" value={ROLE_LABEL[ctx?.role ?? ""] ?? "—"} />
          <p className="text-xs text-muted-foreground">{ROLE_SCOPE[ctx?.role ?? ""] ?? ""}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 py-4 text-sm">
          <p className="font-medium">Propiedades asignadas ({properties.length})</p>
          {properties.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin asignaciones por ahora.</p>
          )}
          {properties.map((p) => (
            <p key={p.id} className="text-xs text-muted-foreground">
              {p.code} · {p.name} · {p.location}
            </p>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tu rol y tus propiedades los define el administrador de tu empresa.
      </p>
      <Button variant="outline" className="w-full" onClick={signOut}>
        Cerrar sesión
      </Button>
    </WorkerShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
