import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useOrganization, useProfile, useProperties, useTeam } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración y licencia — CasaFlow" },
      {
        name: "description",
        content: "Datos de la empresa administradora, tipo de licencia y consumo de propiedades y usuarios.",
      },
      { property: "og:title", content: "Configuración — CasaFlow" },
      { property: "og:description", content: "Licencia, límites y datos de la cuenta empresarial." },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const { data: org } = useOrganization();
  const { data: profile } = useProfile();
  const { data: properties = [] } = useProperties();
  const { data: team = [] } = useTeam();

  const propPct = org ? Math.round((properties.length / org.max_properties) * 100) : 0;
  const userPct = org ? Math.round((team.length / org.max_users) * 100) : 0;

  return (
    <AppShell title="Configuración" subtitle="Cuenta empresarial y licencia de plataforma">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Razón social" value={org?.name ?? "—"} />
            <Line label="Contacto principal" value={`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "—"} />
            <Line label="Correo" value={profile?.email ?? "—"} />
            <Line label="Teléfono" value={profile?.phone ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Licencia {org?.license_type?.toUpperCase()}</CardTitle>
            <StatusPill value={org?.license_status ?? "active"} />
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Propiedades</span>
                <span>
                  {properties.length} / {org?.max_properties ?? 0}
                </span>
              </div>
              <Progress value={propPct} className="mt-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Usuarios</span>
                <span>
                  {team.length} / {org?.max_users ?? 0}
                </span>
              </div>
              <Progress value={userPct} className="mt-1.5" />
            </div>
            <p className="text-xs text-muted-foreground">
              La licencia y los límites se administran desde el panel privado de la plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
