import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useSaveProperty, type Property } from "@/lib/casaflow";

type FormState = {
  code: string;
  name: string;
  location: string;
  address: string;
  capacity: string;
  nightly_rate: string;
  status: string;
  check_in_time: string;
  check_out_time: string;
  wifi_name: string;
  wifi_password: string;
  access_code: string;
  instructions: string;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  location: "",
  address: "",
  capacity: "4",
  nightly_rate: "2500",
  status: "available",
  check_in_time: "15:00",
  check_out_time: "11:00",
  wifi_name: "",
  wifi_password: "",
  access_code: "",
  instructions: "",
};

export function PropertyForm({
  open,
  onOpenChange,
  property,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  property?: Property | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const save = useSaveProperty();

  useEffect(() => {
    if (!open) return;
    setForm(
      property
        ? {
            code: property.code ?? "",
            name: property.name ?? "",
            location: property.location ?? "",
            address: property.address ?? "",
            capacity: String(property.capacity ?? 4),
            nightly_rate: String(property.nightly_rate ?? 0),
            status: property.status ?? "available",
            check_in_time: property.check_in_time ?? "15:00",
            check_out_time: property.check_out_time ?? "11:00",
            wifi_name: property.wifi_name ?? "",
            wifi_password: property.wifi_password ?? "",
            access_code: property.access_code ?? "",
            instructions: property.instructions ?? "",
          }
        : EMPTY,
    );
  }, [open, property]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.location.trim()) {
      toast.error("Código, nombre y zona son obligatorios.");
      return;
    }
    try {
      await save.mutateAsync({
        id: property?.id,
        code: form.code.trim(),
        name: form.name.trim(),
        location: form.location.trim(),
        address: form.address.trim() || null,
        capacity: Number(form.capacity) || 1,
        nightly_rate: Number(form.nightly_rate) || 0,
        status: form.status,
        check_in_time: form.check_in_time,
        check_out_time: form.check_out_time,
        wifi_name: form.wifi_name.trim() || null,
        wifi_password: form.wifi_password.trim() || null,
        access_code: form.access_code.trim() || null,
        instructions: form.instructions.trim() || null,
      });
      toast.success(property ? "Propiedad actualizada." : "Propiedad creada.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {property ? "Editar propiedad" : "Nueva propiedad"}
          </DialogTitle>
          <DialogDescription>
            Datos operativos de la unidad: identificación, tarifa, horarios y accesos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Código" value={form.code} onChange={set("code")} placeholder="CV-01" />
          <Field label="Nombre" value={form.name} onChange={set("name")} placeholder="Casa Marina" />
          <Field label="Zona" value={form.location} onChange={set("location")} placeholder="Rosarito" />
          <Field label="Dirección" value={form.address} onChange={set("address")} />
          <Field label="Capacidad (pax)" type="number" value={form.capacity} onChange={set("capacity")} />
          <Field label="Tarifa por noche (MXN)" type="number" value={form.nightly_rate} onChange={set("nightly_rate")} />
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="occupied">Ocupada</SelectItem>
                <SelectItem value="maintenance">Mantenimiento</SelectItem>
                <SelectItem value="blocked">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in" value={form.check_in_time} onChange={set("check_in_time")} />
            <Field label="Check-out" value={form.check_out_time} onChange={set("check_out_time")} />
          </div>
          <Field label="Wifi (red)" value={form.wifi_name} onChange={set("wifi_name")} />
          <Field label="Wifi (contraseña)" value={form.wifi_password} onChange={set("wifi_password")} />
          <Field label="Código de acceso" value={form.access_code} onChange={set("access_code")} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Instrucciones de llegada</Label>
            <Textarea
              rows={3}
              value={form.instructions}
              onChange={(e) => set("instructions")(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar propiedad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
