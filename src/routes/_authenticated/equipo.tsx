import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeam } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/equipo")({
  head: () => ({
    meta: [
      { title: "Equipo y roles de acceso — CasaFlow" },
      {
        name: "description",
        content: "Administra qué ve cada rol: recepción, limpieza, mantenimiento y contabilidad con acceso limitado.",
      },
      { property: "og:title", content: "Equipo y roles — CasaFlow" },
      { property: "og:description", content: "Permisos por rol para la operación de propiedades vacacionales." },
    ],
  }),
  component: Equipo,
});

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  manager: "Administrador",
  reception: "Recepción",
  cleaning: "Limpieza",
  maintenance: "Mantenimiento",
  accounting: "Contabilidad",
};

const ROLE_SCOPE: Record<string, string> = {
  owner: "Acceso total, licencias y finanzas",
  manager: "Operación completa sin configuración de licencia",
  reception: "Reservas, huéspedes y mensajería",
  cleaning: "Solo sus tareas de limpieza del día",
  maintenance: "Solo incidencias asignadas",
  accounting: "Finanzas y reportes, sin datos de huésped",
};

function Equipo() {
  const { data: team = [] } = useTeam();
  const grouped = team.reduce<Record<string, typeof team>>((acc, m) => {
    (acc[m.role] ??= []).push(m);
    return acc;
  }, {});

  return (
    <AppShell title="Equipo y roles" subtitle={`${team.length} personas con acceso a la plataforma`}>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(grouped).map(([role, members]) => (
          <Card key={role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{ROLE_LABEL[role] ?? role}</CardTitle>
              <p className="text-xs text-muted-foreground">{ROLE_SCOPE[role] ?? ""}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email ?? "sin correo"}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill value={m.status} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {m.last_access
                        ? `Último acceso ${new Date(m.last_access).toLocaleDateString("es-MX")}`
                        : "Sin accesos"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
