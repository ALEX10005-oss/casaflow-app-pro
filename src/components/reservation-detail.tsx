import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReservationForm } from "@/components/reservation-form";
import { StatusPill } from "@/components/status-pill";
import {
  canEditReservations,
  money,
  nightsBetween,
  shortDate,
  useGuests,
  useMyContext,
  useProperties,
  type Reservation,
} from "@/lib/casaflow";

export function ReservationDetailDialog({
  reservation,
  onOpenChange,
}: {
  reservation: Reservation | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: ctx } = useMyContext();
  const { data: guests = [] } = useGuests();
  const { data: properties = [] } = useProperties();
  const [editing, setEditing] = useState(false);

  const guest = guests.find((g) => g.id === reservation?.guest_id) ?? null;
  const property = properties.find((p) => p.id === reservation?.property_id) ?? null;
  const canEdit = canEditReservations(ctx?.role);

  return (
    <>
      <Dialog open={Boolean(reservation) && !editing} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {reservation && (
            <>
              <DialogHeader>
                <DialogTitle>{guest?.full_name ?? "Huésped"}</DialogTitle>
                <DialogDescription>
                  {property?.name ?? "Propiedad"} · {reservation.channel} · {reservation.code}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Entrada" value={shortDate(reservation.check_in)} />
                <Field label="Salida" value={shortDate(reservation.check_out)} />
                <Field
                  label="Noches"
                  value={String(nightsBetween(reservation.check_in, reservation.check_out))}
                />
                <Field label="Huéspedes" value={String(reservation.guests_count ?? "—")} />
                <Field label="Total" value={money(Number(reservation.total_amount))} />
                <Field label="Correo" value={guest?.email ?? "—"} />
                <Field label="Teléfono" value={guest?.phone ?? "—"} />
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusPill value={reservation.status} />
                    <StatusPill value={reservation.payment_status} />
                  </div>
                </div>
              </div>

              {reservation.notes && (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">{reservation.notes}</p>
              )}

              {canEdit ? (
                <Button onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Editar reserva
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tu rol no permite editar reservas.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReservationForm
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) onOpenChange(false);
        }}
        reservation={reservation}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
