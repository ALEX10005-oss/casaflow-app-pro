import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MaintenanceChecklist } from "@/components/maintenance-checklist";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  longDate,
  todayISO,
  useAssignTask,
  useCleaningTasks,
  useMaintenance,
  useOrgMembers,
  useProperties,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/operaciones")({
  head: () => ({ meta: [{ title: "Limpieza y mantenimiento — CasaFlow" }] }),
  component: Operaciones,
});

const MAINTENANCE_FORM_URL = "https://forms.gle/QNZjcC5yq9WwjXsp9";

function callRpc(fn: string, args: Record<string, unknown>) {
  return supabase.rpc(fn as never, args as never) as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

function Operaciones() {
  const qc = useQueryClient();
  const { data: cleaning = [] } = useCleaningTasks();
  const { data: issues = [] } = useMaintenance();
  const { data: properties = [] } = useProperties();
  const { data: members = [] } = useOrgMembers();
  const assign = useAssignTask();
  const assignable = members.filter((m) => m.access_status === "active");
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const today = todayISO();

  const [cleanProperty, setCleanProperty] = useState("");
  const [cleanDate, setCleanDate] = useState(today);
  const [cleanTime, setCleanTime] = useState("11:00");
  const [cleanAssignee, setCleanAssignee] = useState("");
  const [cleanPriority, setCleanPriority] = useState("normal");

  const [maintProperty, setMaintProperty] = useState("");
  const [maintTitle, setMaintTitle] = useState("");
  const [maintDescription, setMaintDescription] = useState("");
  const [maintDate, setMaintDate] = useState(today);
  const [maintTime, setMaintTime] = useState("10:00");
  const [maintAssignee, setMaintAssignee] = useState("");
  const [maintPriority, setMaintPriority] = useState("media");
  const [blocksGuests, setBlocksGuests] = useState(false);

  const scheduleCleaning = useMutation({
    mutationFn: async () => {
      if (!cleanProperty || !cleanDate) throw new Error("Selecciona propiedad y fecha.");
      const { error } = await callRpc("schedule_cleaning_task", {
        _property_id: cleanProperty,
        _scheduled_date: cleanDate,
        _scheduled_time: cleanTime || null,
        _assignee_user_id: cleanAssignee || null,
        _priority: cleanPriority,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cleaning_tasks"] });
      toast.success("Limpieza programada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMaintenance = useMutation({
    mutationFn: async () => {
      if (!maintProperty || !maintTitle.trim())
        throw new Error("Selecciona propiedad y escribe el trabajo.");
      const { error } = await callRpc("schedule_maintenance_issue", {
        _property_id: maintProperty,
        _title: maintTitle.trim(),
        _description: maintDescription.trim() || null,
        _scheduled_date: maintDate || null,
        _scheduled_time: maintTime || null,
        _assignee_user_id: maintAssignee || null,
        _priority: maintPriority,
        _blocks_guests: blocksGuests,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setMaintTitle("");
      setMaintDescription("");
      void qc.invalidateQueries({ queryKey: ["maintenance_issues"] });
      toast.success("Mantenimiento programado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function AssigneeSelect({
    kind,
    taskId,
    value,
    roles,
  }: {
    kind: "cleaning" | "maintenance";
    taskId: string;
    value: string | null;
    roles: string[];
  }) {
    const options = assignable.filter((m) => m.role && roles.includes(m.role));
    return (
      <select
        aria-label="Responsable"
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={value ?? ""}
        onChange={(e) =>
          assign.mutate(
            { kind, taskId, userId: e.target.value || null },
            {
              onSuccess: () => toast.success("Responsable actualizado"),
              onError: (err: Error) => toast.error(err.message),
            },
          )
        }
      >
        <option value="">Sin asignar</option>
        {options.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email}
          </option>
        ))}
      </select>
    );
  }

  const updateCleaning = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("cleaning_tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });

  const updateIssue = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("maintenance_issues").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["maintenance_issues"] }),
  });

  const grouped = cleaning.reduce<Record<string, typeof cleaning>>((acc, t) => {
    (acc[t.scheduled_date] ??= []).push(t);
    return acc;
  }, {});

  return (
    <AppShell
      title="Operaciones"
      subtitle="Programa y asigna manualmente limpiezas y mantenimiento"
    >
      <Tabs defaultValue="limpieza">
        <TabsList>
          <TabsTrigger value="limpieza">
            Limpieza ({cleaning.filter((c) => c.status !== "completada").length})
          </TabsTrigger>
          <TabsTrigger value="mantenimiento">
            Mantenimiento ({issues.filter((i) => i.status !== "resuelta").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="limpieza" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Programar limpieza</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">
              <Field label="Propiedad">
                <PropertySelect
                  value={cleanProperty}
                  onChange={setCleanProperty}
                  properties={properties}
                />
              </Field>
              <Field label="Fecha">
                <Input
                  type="date"
                  value={cleanDate}
                  onChange={(e) => setCleanDate(e.target.value)}
                />
              </Field>
              <Field label="Hora">
                <Input
                  type="time"
                  value={cleanTime}
                  onChange={(e) => setCleanTime(e.target.value)}
                />
              </Field>
              <Field label="Responsable">
                <MemberSelect
                  value={cleanAssignee}
                  onChange={setCleanAssignee}
                  members={assignable}
                  roles={["cleaning", "manager"]}
                />
              </Field>
              <Field label="Prioridad">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={cleanPriority}
                  onChange={(e) => setCleanPriority(e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                </select>
              </Field>
              <div className="md:col-span-5">
                <Button
                  onClick={() => scheduleCleaning.mutate()}
                  disabled={scheduleCleaning.isPending}
                >
                  <Plus className="size-4" /> Programar limpieza
                </Button>
              </div>
            </CardContent>
          </Card>

          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, tasks]) => (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {longDate(date)} {date === today && "· hoy"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{propById[t.property_id]?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Hora {t.checkout_time ?? "—"} · {t.assignee ?? "sin asignar"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AssigneeSelect
                          kind="cleaning"
                          taskId={t.id}
                          value={t.assignee_user_id}
                          roles={["cleaning", "manager"]}
                        />
                        <StatusPill value={t.priority} />
                        <StatusPill value={t.status} />
                        {t.status !== "completada" && (
                          <Button
                            size="sm"
                            variant={t.status === "pendiente" ? "outline" : "default"}
                            onClick={() =>
                              updateCleaning.mutate({
                                id: t.id,
                                status: t.status === "pendiente" ? "en_proceso" : "completada",
                              })
                            }
                          >
                            {t.status === "pendiente" ? "Iniciar" : "Completar"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="mantenimiento" className="space-y-4 pt-4">
          <MaintenanceChecklist />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Programar mantenimiento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Propiedad">
                <PropertySelect
                  value={maintProperty}
                  onChange={setMaintProperty}
                  properties={properties}
                />
              </Field>
              <Field label="Fecha">
                <Input
                  type="date"
                  value={maintDate}
                  onChange={(e) => setMaintDate(e.target.value)}
                />
              </Field>
              <Field label="Hora">
                <Input
                  type="time"
                  value={maintTime}
                  onChange={(e) => setMaintTime(e.target.value)}
                />
              </Field>
              <Field label="Responsable">
                <MemberSelect
                  value={maintAssignee}
                  onChange={setMaintAssignee}
                  members={assignable}
                  roles={["maintenance", "manager"]}
                />
              </Field>
              <Field label="Trabajo">
                <Input
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  placeholder="Ej. revisar aire acondicionado"
                />
              </Field>
              <Field label="Prioridad">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={maintPriority}
                  onChange={(e) => setMaintPriority(e.target.value)}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Field>
              <div className="lg:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  rows={2}
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={blocksGuests}
                  onChange={(e) => setBlocksGuests(e.target.checked)}
                />{" "}
                Impide recibir huéspedes
              </label>
              <div className="lg:col-span-4">
                <Button
                  onClick={() => scheduleMaintenance.mutate()}
                  disabled={scheduleMaintenance.isPending}
                >
                  <Plus className="size-4" /> Programar mantenimiento
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium">Formulario oficial de mantenimiento</p>
                <p className="text-xs text-muted-foreground">
                  También puede usarse para registrar reportes externos.
                </p>
              </div>
              <Button asChild variant="outline">
                <a href={MAINTENANCE_FORM_URL} target="_blank" rel="noreferrer">
                  Abrir formulario
                  <ExternalLink className="ml-2 size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {issues.map((i) => {
            const scheduled = i as typeof i & {
              scheduled_date?: string | null;
              scheduled_time?: string | null;
            };
            return (
              <Card
                key={i.id}
                className={
                  i.blocks_guests && i.status !== "resuelta" ? "border-destructive/40" : ""
                }
              >
                <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{i.title}</p>
                      <StatusPill value={i.priority} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {propById[i.property_id]?.name} ·{" "}
                      {scheduled.scheduled_date
                        ? `programado ${scheduled.scheduled_date}${scheduled.scheduled_time ? ` ${scheduled.scheduled_time}` : ""}`
                        : `reportada ${i.reported_on}`}{" "}
                      · {i.assignee ?? "sin asignar"}
                    </p>
                    {i.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <AssigneeSelect
                      kind="maintenance"
                      taskId={i.id}
                      value={i.assignee_user_id}
                      roles={["maintenance", "manager"]}
                    />
                    <StatusPill value={i.status} />
                    {i.status !== "resuelta" && (
                      <Button
                        size="sm"
                        variant={i.status === "nueva" ? "outline" : "default"}
                        onClick={() =>
                          updateIssue.mutate({
                            id: i.id,
                            status: i.status === "nueva" ? "en_proceso" : "resuelta",
                          })
                        }
                      >
                        {i.status === "nueva" ? "Tomar" : "Resolver"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function PropertySelect({
  value,
  onChange,
  properties,
}: {
  value: string;
  onChange: (v: string) => void;
  properties: { id: string; code: string; name: string }[];
}) {
  return (
    <select
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Selecciona…</option>
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.code} · {p.name}
        </option>
      ))}
    </select>
  );
}
function MemberSelect({
  value,
  onChange,
  members,
  roles,
}: {
  value: string;
  onChange: (v: string) => void;
  members: {
    user_id: string;
    role: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }[];
  roles: string[];
}) {
  const options = members.filter((m) => m.role && roles.includes(m.role));
  return (
    <select
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Sin asignar</option>
      {options.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email}
        </option>
      ))}
    </select>
  );
}
