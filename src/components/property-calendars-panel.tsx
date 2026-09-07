import { FileSpreadsheet, History, ShieldCheck } from "lucide-react";
import type { Property } from "@/lib/casaflow";

export function PropertyCalendarsPanel({ property }: { property: Property }) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="font-medium">Importación de reservas</p>
        <p className="text-xs text-muted-foreground">
          {property.code} · {property.name}
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">CSV activo desde el 7 de septiembre de 2026</p>
            <p className="text-muted-foreground">
              Las nuevas reservas de Airbnb, Booking, VRBO, Expedia u otros canales se consolidan mediante la importación CSV de CasaFlow.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">iCal deshabilitado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ya no se agregan, sincronizan ni usan calendarios iCal para disponibilidad futura.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Histórico conservado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                La información iCal anterior al corte permanece almacenada y no se sobrescribe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
