import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { WorkerShell } from "@/components/worker-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { longDate, useMaintenance, useProperties, useReportIssue } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/trabajo/incidencias")({
  head: () => ({
    meta: [
      { title: "Reportar incidencia — CasaFlow" },
      {
        name: "description",
        content:
          "Reporta desperfectos de una propiedad asignada: tipo, descripción y prioridad. El reporte llega directo a la operación del administrador.",
      },
      { property: "og:title", content: "Reportar incidencia — CasaFlow" },
      { property: "og:description", content: "Levanta incidencias desde el trabajo de campo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Incidencias,
});

const PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

function Incidencias() {
  const { data: properties = [] } = useProperties();
  const { data: issues = [] } = useMaintenance();
  const report = useReportIssue();

  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [blocks, setBlocks] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) {
      toast.error("Elige la propiedad.");
      return;
    }
    report.mutate(
      { property_id: propertyId, title, description, priority, blocks_guests: blocks },
      {
        onSuccess: () => {
          toast.success("Incidencia enviada a la administración.");
          setTitle("");
          setDescription("");
          setBlocks(false);
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "No se pudo enviar la incidencia."),
      },
    );
  }

  return (
    <WorkerShell title="Incidencias" subtitle="Reporta y sigue los desperfectos de tus propiedades">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reportar incidencia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Propiedad</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-title">Tipo o título</Label>
              <Input
                id="i-title"
                value={title}
                required
                placeholder="Fuga en el baño principal"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-desc">Descripción</Label>
              <Textarea
                id="i-desc"
                value={description}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={blocks}
                onChange={(e) => setBlocks(e.target.checked)}
                className="size-4"
              />
              Impide recibir huéspedes
            </label>
            <Button type="submit" className="w-full" disabled={report.isPending}>
              Enviar incidencia
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="pt-2 text-sm font-semibold">Incidencias de mis propiedades ({issues.length})</p>
      {issues.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {longDate(m.reported_on)} · {m.priority}
              </p>
            </div>
            <StatusPill value={m.status} />
          </CardContent>
        </Card>
      ))}
    </WorkerShell>
  );
}
