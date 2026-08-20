import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  reservationErrorMessage,
  useCreateReservation,
  useProperties,
  todayISO,
  addDays,
} from "@/lib/casaflow";

export function ReservationForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: properties = [] } = useProperties();
  const createReservation = useCreateReservation();

  const [propertyId, setPropertyId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(addDays(todayISO(), 1));
  const [guestsCount, setGuestsCount] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("pendiente");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && !propertyId && properties[0]) setPropertyId(properties[0].id);
  }, [open, properties, propertyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) {
      toast.error("Selecciona una propiedad.");
      return;
    }
    if (!guestName.trim()) {
      toast.error("Escribe el nombre del huésped.");
      return;
    }
    if (checkOut <= checkIn) {
      toast.error("La salida debe ser posterior a la entrada.");
      return;
    }

    try {
      await createReservation.mutateAsync({
        property_id: propertyId,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim() || null,
        guest_phone: guestPhone.trim() || null,
        check_in: checkIn,
        check_out: checkOut,
        guests_count: guestsCount,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        notes: notes.trim() || null,
      });
      toast.success("Reserva directa creada y agregada al calendario.");
      onOpenChange(false);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setNotes("");
      setGuestsCount(1);
      setTotalAmount(0);
    } catch (error) {
      toast.error(reservationErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva reserva directa</DialogTitle>
          <DialogDescription>
            CasaFlow valida disponibilidad contra reservas, iCal y bloqueos antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Propiedad</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue placeholder="Selecciona propiedad" /></SelectTrigger>
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
            <Label>Huésped</Label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Correo</Label>
            <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Entrada</Label>
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Salida</Label>
            <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Huéspedes</Label>
            <Input
              type="number"
              min={1}
              value={guestsCount}
              onChange={(e) => setGuestsCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Estado de pago</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Button className="w-full" type="submit" disabled={createReservation.isPending}>
              {createReservation.isPending ? "Creando…" : "Crear reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
