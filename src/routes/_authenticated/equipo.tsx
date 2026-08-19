import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Copy, Mail, RotateCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvitation, resendInvitation } from "@/lib/invitations.functions";
import {
  INVITABLE_ROLES,
  ROLE_LABEL,
  ROLE_SCOPE,
  inviteErrorMessage,
  useInvitations,
  useMyContext,
  useOrgMembers,
  useOrganization,
  useProperties,
  useTeamMutations,
  type AppRole,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/equipo")({
  head: () => ({
    meta: [
      { title: "Equipo, invitaciones y permisos — CasaFlow" },
      {
        name: "description",
        content:
          "Invita a limpieza, mantenimiento, recepción y contabilidad con un enlace de un solo uso, asigna propiedades y controla qué ve cada rol.",
      },
      { property: "og:title", content: "Equipo y accesos — CasaFlow" },
      {
        property: "og:description",
        content: "Invitaciones seguras, propiedades asignadas y permisos por rol.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Equipo,
});

function Equipo() {
  const qc = useQueryClient();
  const { data: ctx } = useMyContext();
  const { data: org } = useOrganization();
  const { data: members = [] } = useOrgMembers();
  const { data: invites = [] } = useInvitations();
  const { data: properties = [] } = useProperties();
  const { setProperties, setStatus, revoke, refresh } = useTeamMutations();

  const invite = useServerFn(createInvitation);
  const resend = useServerFn(resendInvitation);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("cleaning");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editPicked, setEditPicked] = useState<string[]>([]);

  const pending = useMemo(() => invites.filter((i) => i.status === "pending"), [invites]);
  const seats = members.length + pending.length;
  const maxUsers = org?.max_users ?? 0;
  const full = maxUsers > 0 && seats >= maxUsers;

  const sendInvite = useMutation({
    mutationFn: async () =>
      await invite({
        data: {
          email,
          full_name: name,
          role,
          property_ids: picked,
          message: message || undefined,
          origin: window.location.origin,
        },
      }),
    onSuccess: (res) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["org-members"] });
      if (res.emailStatus === "sent") toast.success(`Invitación enviada a ${res.email}`);
      else
        toast.warning("Invitación creada, pero el correo no salió. Copia el enlace y compártelo.", {
          action: {
            label: "Copiar enlace",
            onClick: () => navigator.clipboard.writeText(res.link),
          },
          duration: 12_000,
        });
      setOpen(false);
      setEmail("");
      setName("");
      setMessage("");
      setPicked([]);
    },
    onError: (err) => toast.error(inviteErrorMessage(err)),
  });

  const resendInvite = useMutation({
    mutationFn: async (id: string) =>
      await resend({ data: { invitation_id: id, origin: window.location.origin } }),
    onSuccess: (res) => {
      refresh();
      if (res.emailStatus === "sent") toast.success("Invitación reenviada.");
      else
        toast.warning("Enlace regenerado, pero el correo no salió.", {
          action: {
            label: "Copiar enlace",
            onClick: () => navigator.clipboard.writeText(res.link),
          },
          duration: 12_000,
        });
    },
    onError: (err) => toast.error(inviteErrorMessage(err)),
  });

  const propLabel = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p ? `${p.code}` : "—";
  };

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function saveProperties(userId: string) {
    setProperties.mutate(
      { user_id: userId, property_ids: editPicked },
      {
        onSuccess: () => {
          toast.success("Propiedades actualizadas.");
          setEditing(null);
        },
        onError: (err) => toast.error(inviteErrorMessage(err)),
      },
    );
  }

  return (
    <AppShell
      title="Equipo y roles"
      subtitle="Invitación por enlace de un solo uso, propiedades asignadas y permisos por rol"
      actions={
        <Button size="sm" onClick={() => setOpen((v) => !v)} disabled={full}>
          <UserPlus className="size-4" /> Invitar trabajador
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Usuarios: <strong className="text-foreground">{seats}</strong> de {maxUsers || "—"}
        </span>
        <span>
          Licencia: <strong className="text-foreground">{ctx?.license_status ?? "—"}</strong>
        </span>
        {full && <span className="text-destructive">Límite de usuarios alcanzado.</span>}
      </div>

      {open && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invitar trabajador</CardTitle>
            <p className="text-xs text-muted-foreground">
              Se envía un enlace de un solo uso que caduca en 7 días. La persona crea su contraseña
              y entra directo a su vista de trabajo. No puede elegir empresa ni rol.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendInvite.mutate();
              }}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name">Nombre</Label>
                  <Input id="inv-name" value={name} required onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-email">Correo</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    value={email}
                    required
                    placeholder="persona@gmail.com"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{ROLE_SCOPE[role]}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-msg">Mensaje (opcional)</Label>
                  <Textarea
                    id="inv-msg"
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Propiedades asignadas ({picked.length})</Label>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {properties.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm">
                      <Checkbox
                        checked={picked.includes(p.id)}
                        onCheckedChange={() => toggle(picked, p.id, setPicked)}
                      />
                      <span className="truncate">
                        {p.code} · {p.name}
                      </span>
                    </label>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={sendInvite.isPending || full}>
                  <Mail className="size-4" /> Enviar invitación
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Personal ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || "Sin nombre"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email ?? "sin correo"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {ROLE_LABEL[m.role ?? ""] ?? "Sin rol"}
                    </span>
                    <StatusPill value={m.access_status} />
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Propiedades: {m.property_ids.length === 0
                    ? m.role === "owner" || m.role === "manager" || m.role === "accounting"
                      ? "todas (por rol)"
                      : "ninguna"
                    : m.property_ids.map(propLabel).join(", ")}
                </p>

                {m.role !== "owner" && m.user_id !== ctx?.user_id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(editing === m.user_id ? null : m.user_id);
                        setEditPicked(m.property_ids);
                      }}
                    >
                      Propiedades
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setStatus.mutate(
                          {
                            user_id: m.user_id,
                            status: m.access_status === "active" ? "suspended" : "active",
                          },
                          {
                            onSuccess: () => toast.success("Acceso actualizado."),
                            onError: (err) => toast.error(inviteErrorMessage(err)),
                          },
                        )
                      }
                    >
                      {m.access_status === "active" ? "Desactivar acceso" : "Reactivar acceso"}
                    </Button>
                  </div>
                )}

                {editing === m.user_id && (
                  <div className="mt-2 space-y-1 rounded-md border p-2">
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {properties.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editPicked.includes(p.id)}
                            onCheckedChange={() => toggle(editPicked, p.id, setEditPicked)}
                          />
                          <span className="truncate">
                            {p.code} · {p.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => saveProperties(m.user_id)}>
                      Guardar asignación
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Invitaciones ({invites.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin invitaciones registradas.
              </p>
            )}
            {invites.map((i) => (
              <div key={i.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.full_name ?? i.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.email}</p>
                  </div>
                  <StatusPill value={i.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROLE_LABEL[i.role] ?? i.role}
                  {i.expires_at ? ` · caduca ${new Date(i.expires_at).toLocaleDateString("es-MX")}` : ""}
                </p>
                {i.status !== "accepted" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resendInvite.isPending}
                      onClick={() => resendInvite.mutate(i.id)}
                    >
                      <RotateCw className="size-3.5" /> Reenviar
                    </Button>
                    {i.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Revocar invitación"
                        onClick={() =>
                          revoke.mutate(i.id, {
                            onSuccess: () => toast.success("Invitación revocada."),
                            onError: (err) => toast.error(inviteErrorMessage(err)),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" /> Revocar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <p className="pt-2 text-[11px] text-muted-foreground">
              <Copy className="mr-1 inline size-3" />
              Los enlaces son de un solo uso; al reenviar, el anterior deja de funcionar.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
