import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, useProperties } from "@/lib/casaflow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ITEMS = [
  "Cerradura de la puerta principal funciona correctamente.",
  "Llaves completas, identificadas y en buen estado.",
  "Puertas, chapas y ventanas funcionan correctamente.",
  "Barandales, escaleras y pasamanos están firmes.",
  "Todos los focos encienden correctamente.",
  "Apagadores funcionan y no están flojos o dañados.",
  "Contactos eléctricos funcionan correctamente.",
  "WC descarga correctamente y no presenta fugas.",
  "Lavabo funciona y drena correctamente.",
  "Regadera funciona y tiene presión adecuada.",
  "Coladeras y desagües drenan sin obstrucciones.",
  "Tinaco o cisterna cuenta con suministro suficiente, si aplica.",
  "Calentador o boiler enciende correctamente.",
  "Estufa o parrilla enciende y la campana funciona.",
  "Fregadero y llave funcionan, drenan y no presentan fugas.",
  "Cortinas están completas y los ventiladores funcionan.",
  "Sillas, mesas y muebles no tienen piezas flojas o rotas.",
  "Televisión enciende, muestra imagen y el control remoto tiene baterías.",
  "Módem o router está encendido, sin alertas y la red Wi-Fi es estable.",
] as const;

type Answer = "ok" | "attention" | "not_applicable";
type ChecklistRow = {
  id: string;
  property_id: string;
  checklist_month: string;
  answers: Record<string, Answer>;
};

export function MaintenanceChecklist() {
  const qc = useQueryClient();
  const { data: context } = useMyContext();
  const { data: properties = [] } = useProperties();
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  const [propertyId, setPropertyId] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const { data: checklists = [] } = useQuery({
    queryKey: ["maintenance_checklists", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_checklists" as never)
        .select("id,property_id,checklist_month,answers")
        .eq("checklist_month", month);
      if (error) throw error;
      return (data ?? []) as unknown as ChecklistRow[];
    },
  });

  const completedIds = useMemo(
    () => new Set(checklists.map((row) => row.property_id)),
    [checklists],
  );
  const pending = properties.filter((property) => !completedIds.has(property.id));

  const save = useMutation({
    mutationFn: async () => {
      if (!context?.org_id || !context.user_id || !propertyId)
        throw new Error("Selecciona una propiedad.");
      if (ITEMS.some((_, index) => !answers[String(index)]))
        throw new Error("Responde los 19 puntos del checklist.");
      const { error } = await supabase.from("maintenance_checklists" as never).upsert(
        {
          org_id: context.org_id,
          property_id: propertyId,
          checklist_month: month,
          answers,
          completed_by: context.user_id,
          completed_at: new Date().toISOString(),
        } as never,
        { onConflict: "org_id,property_id,checklist_month" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist mensual guardado");
      setPropertyId("");
      setAnswers({});
      qc.invalidateQueries({ queryKey: ["maintenance_checklists"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4" /> Checklist mensual de mantenimiento
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {checklists.length} de {properties.length} propiedades completadas este mes.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary"
            style={{
              width: `${properties.length ? (checklists.length / properties.length) * 100 : 0}%`,
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="grid gap-1 text-sm font-medium">
          Propiedad pendiente
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            <option value="">Seleccionar propiedad</option>
            {pending.map((property) => (
              <option key={property.id} value={property.id}>
                {property.code} · {property.name}
              </option>
            ))}
          </select>
        </label>
        {propertyId && (
          <div className="space-y-2">
            {ITEMS.map((item, index) => (
              <label
                key={item}
                className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_180px] md:items-center"
              >
                <span>
                  {index + 1}. {item}
                </span>
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={answers[String(index)] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [String(index)]: event.target.value as Answer,
                    }))
                  }
                >
                  <option value="">Seleccionar</option>
                  <option value="ok">En orden</option>
                  <option value="attention">Necesita atención</option>
                  <option value="not_applicable">No aplica</option>
                </select>
              </label>
            ))}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Guardar checklist mensual
            </Button>
          </div>
        )}
        {!propertyId && pending.length === 0 && (
          <p className="text-sm font-medium text-emerald-600">
            Las {properties.length} propiedades están revisadas este mes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
