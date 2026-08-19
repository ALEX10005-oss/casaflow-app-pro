import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROLE_LABEL,
  useCancelInvitation,
  useInvitations,
  useInviteMember,
  useTeam,
  type AppRole,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/equipo")({
  head: () => ({
    meta: [
      { title: "Equipo y accesos por correo — CasaFlow" },
      {
        name: "description",
        content:
          "Invita a limpieza, mantenimiento, recepción y contabilidad con un enlace por correo y define qué puede ver cada rol.",
      },
      { property: "og:title", content: "Equipo y accesos — CasaFlow" },
      {
        property: "og:description",
        content: "Invitaciones por enlace y permisos por rol para tu operación.",
      },
    ],
  }),
  component: Equipo,
});

const ROLE_SCOPE: Record<string, string> = {
  owner: "Acceso total, licencias y finanzas",
  manager: "Operación completa sin configuración de licencia",
  reception: "Reservas, huéspedes y mensajería",
  cleaning: "Solo su lista de tareas de limpieza (vista móvil)",
  maintenance: "Solo sus incidencias asignadas (vista móvil)",
  accounting: "Finanzas y reportes, sin datos de huésped",
};

const INVITABLE: AppRole[] = ["manager", "reception", "cleaning", "maintenance", "accounting"];

function Equipo() {
  const { data: team = [] } = useTeam();
  const { data: invites = [] } = useInvitations();
  const invite = useInviteMember();
  const cancel = useCancelInvitation();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("cleaning");

  const pending = invites.filter((i) => i.status === "pending");

  function send(e: React.FormEvent) {
    e.preventDefault();
    invite.mutate(
      { email, full_name: name, role },
      {
        onSuccess: () => {
          toast.success(`Enlace de acceso enviado a ${email}`);
          setEmail("");
          setName("");
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "No se pudo enviar la invitación"),
      },
    );
  }

  const grouped = team.reduce<Record<string, typeof team>>((acc, m) => {
    (acc[m.role] ??= []).push(m);
    return acc;
  }, {});

  return (
    <AppShell
      title="Equipo y roles"
      subtitle="Invita por correo: cada persona entra con un enlace y solo ve lo de su rol"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invitar por correo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Enviamos un enlace de acceso. Al abrirlo entra directo, sin contraseña, y queda ligado
              a tu empresa con el rol elegido.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={send} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-name">Nombre</Label>
                <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-email">Correo</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="persona@gmail.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITABLE.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{ROLE_SCOPE[role]}</p>
              </div>
              <Button type="submit" className="w-full" disabled={invite.isPending}>
                <Mail className="size-4" /> Enviar enlace de acceso
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Invitaciones pendientes ({pending.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No hay invitaciones pendientes.
                </p>
              )}
              {pending.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.full_name ?? i.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {ROLE_LABEL[i.role] ?? i.role}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Cancelar invitación"
                      onClick={() => cancel.mutate(i.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(grouped).map(([r, members]) => (
              <Card key={r}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{ROLE_LABEL[r] ?? r}</CardTitle>
                  <p className="text-xs text-muted-foreground">{ROLE_SCOPE[r] ?? ""}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email ?? "sin correo"}</p>
                      </div>
                      <StatusPill value={m.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
