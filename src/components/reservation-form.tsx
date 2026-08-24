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
  useUpdateReservation,
  useGuests,
  useProperties,
  todayISO,
  addDays,
  type Reservation,
} from "@/lib/casaflow";

const CHANNELS = ["directo", "Airbnb", "Booking", "VRBO", "Expedia", "Otro"];

export function ReservationForm({
  open,
  onOpenChange,
  reservation = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: Reservation | null;
}) {
  const { data: properties = [] } = useProperties();
  const { data: guests = [] } = useGuests();
  const createReservation = useCreateReservation();
  const updateReservation = useUpdateReservation();
  const isEdit = Boolean(reservation);
  const pending = createReservation.isPending || updateReservation.isPending;

  const [propertyId, setPropertyId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(addDays(todayISO(), 1));
  const [guestsCount, setGuestsCount] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("pendiente");
  const [status, setStatus] = useState("confirmada");
  const [channel, setChannel] = useState("directo");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorText(null);
    if (reservation) {
      const guest = guests.find((g) => g.id === reservation.guest_id);
      setPropertyId(reservation.property_id);
      setGuestName(guest?.full_name ?? "");
      setGuestEmail(guest?.email ?? "");
      setGuestPhone(guest?.phone ?? "");
      setCheckIn(reservation.check_in);
      setCheckOut(reservation.check_out);
      setGuestsCount(reservation.guests_count ?? 1);
      setTotalAmount(Number(reservation.total_amount ?? 0));
      setPaymentStatus(reservation.payment_status);
      setStatus(reservation.status);
      setChannel(reservation.channel);
      setCode(reservation.code ?? "");
      setNotes(reservation.notes ?? "");
    } else if (!propertyId && properties[0]) {
      setPropertyId(properties[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id, guests.length, properties.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorText(null);
    if (!propertyId) {
      setErrorText("Selecciona una propiedad.");
      return;
    }
    if (!guestName.trim()) {
      setErrorText("Escribe el nombre del huésped.");
      return;
    }
    if (checkOut <= checkIn) {
      setErrorText("La salida debe ser posterior a la entrada.");
      return;
    }

    try {
      if (reservation) {
        await updateReservation.mutateAsync({
          id: reservation.id,
          property_id: propertyId,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || null,
          guest_phone: guestPhone.trim() || null,
          check_in: checkIn,
          check_out: checkOut,
          guests_count: guestsCount,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          status,
          channel,
          code: code.trim(),
          notes: notes.trim() || null,
        });
        toast.success("Reserva actualizada.");
      } else {
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
        setGuestName("");
        setGuestEmail("");
        setGuestPhone("");
        setNotes("");
        setGuestsCount(1);
        setTotalAmount(0);
      }
      onOpenChange(false);
    } catch (error) {
      const message = reservationErrorMessage(error);
      setErrorText(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar reserva" : "Nueva reserva directa"}</DialogTitle>
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

          {isEdit && (
            <>
              <div className="space-y-1.5">
                <Label>Canal / origen</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...new Set([channel, ...CHANNELS])].filter(Boolean).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Código externo</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado de la reserva</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmada">Confirmada</SelectItem>
                    <SelectItem value="en_curso">En curso</SelectItem>
                    <SelectItem value="completada">Completada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className={isEdit ? "space-y-1.5" : "sm:col-span-2 space-y-1.5"}>
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

          {errorText && (
            <p className="sm:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorText}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
