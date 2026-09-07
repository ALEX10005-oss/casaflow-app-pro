import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nightsBetween, shortDate, type ExternalCalendarEvent, type Property } from "@/lib/casaflow";

export function ExternalEventDetailDialog({
  event,
  property,
  onOpenChange,
}: {
  event: ExternalCalendarEvent | null;
  property: Property | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {event && (
          <>
            <DialogHeader>
              <DialogTitle>{event.summary || `Reserva de ${event.channel}`}</DialogTitle>
              <DialogDescription>
                {property?.name ?? "Propiedad"} · origen {event.channel}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Propiedad" value={property?.name ?? "—"} />
              <Field label="Canal / origen" value={event.channel} />
              <Field label="Entrada" value={shortDate(event.start_date)} />
              <Field label="Salida" value={shortDate(event.end_date)} />
              <Field label="Noches" value={String(nightsBetween(event.start_date, event.end_date))} />
              <Field label="Estado de sincronización" value={event.status} />
              <div className="sm:col-span-2">
                <Field label="Referencia externa" value={event.external_uid || "—"} />
              </div>
            </div>

            <p className="rounded-lg border p-3 text-sm text-muted-foreground">
              Este canal solo entregó información de calendario. CasaFlow muestra únicamente los datos reales recibidos; teléfono, correo, huéspedes, importe y pago aparecerán cuando la fuente de reserva los proporcione.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words font-medium">{value}</p>
    </div>
  );
}
