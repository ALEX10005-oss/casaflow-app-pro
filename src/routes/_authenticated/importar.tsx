import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  money,
  nightsBetween,
  useCreateReservation,
  useGuests,
  useProperties,
  useReservations,
} from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({ meta: [{ title: "Importar reservaciones CSV — CasaFlow" }] }),
  component: Importar,
});

type ParsedRow = {
  propertyName: string;
  propertyId: string | null;
  guestName: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  channel: string;
  duplicate: boolean;
  error?: string;
};

const ALIASES = {
  property: ["alojamiento", "propiedad", "anuncio", "listing", "property", "listing name"],
  guest: ["huesped", "nombre del huesped", "guest", "guest name", "nombre"],
  checkIn: ["entrada", "fecha de llegada", "check in", "check-in", "start date"],
  checkOut: ["salida", "fecha de salida", "check out", "check-out", "end date"],
  amount: ["pagado", "importe", "total", "amount", "payout", "total paid", "precio"],
  channel: ["canal", "plataforma", "source", "channel"],
} as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

function isoDate(value: string) {
  const clean = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";
  const year = match[3]!.length === 2 ? `20${match[3]}` : match[3]!;
  return `${year}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

function amount(value: string) {
  const normalized = value
    .replace(/[^0-9.,-]/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function Importar() {
  const { data: properties = [] } = useProperties();
  const { data: reservations = [] } = useReservations();
  const { data: guests = [] } = useGuests();
  const create = useCreateReservation();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [defaultChannel, setDefaultChannel] = useState("airbnb");
  const [manual, setManual] = useState({
    channel: "booking",
    propertyId: "",
    guestName: "",
    checkIn: "",
    checkOut: "",
    amount: "",
  });

  async function createManualReservation() {
    if (!manual.propertyId || !manual.guestName.trim() || !manual.checkIn || !manual.checkOut) {
      return toast.error("Completa alojamiento, huésped y fechas.");
    }
    if (manual.checkOut <= manual.checkIn) {
      return toast.error("La salida debe ser posterior a la entrada.");
    }

    try {
      await create.mutateAsync({
        property_id: manual.propertyId,
        guest_name: manual.guestName.trim(),
        guest_email: null,
        guest_phone: null,
        check_in: manual.checkIn,
        check_out: manual.checkOut,
        guests_count: 1,
        total_amount: Number(manual.amount) || 0,
        payment_status: "registrado",
        notes: `Captura manual · ${manual.channel}`,
        channel: manual.channel,
      });
      toast.success("Reservación agregada al calendario y a los reportes.");
      setManual({
        channel: manual.channel,
        propertyId: "",
        guestName: "",
        checkIn: "",
        checkOut: "",
        amount: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la reservación.");
    }
  }

  async function selectFile(file?: File) {
    if (!file) return;
    const lines = (await file.text())
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines.length < 2) return toast.error("El archivo CSV no contiene reservaciones.");
    const headers = parseLine(lines[0]!).map(normalize);
    const indexOf = (key: keyof typeof ALIASES) =>
      headers.findIndex((header) => ALIASES[key].includes(header as never));
    const indexes = {
      property: indexOf("property"),
      guest: indexOf("guest"),
      checkIn: indexOf("checkIn"),
      checkOut: indexOf("checkOut"),
      amount: indexOf("amount"),
      channel: indexOf("channel"),
    };
    if (
      [indexes.property, indexes.guest, indexes.checkIn, indexes.checkOut].some(
        (index) => index < 0,
      )
    ) {
      return toast.error("Faltan columnas necesarias: alojamiento, huésped, entrada o salida.");
    }
    const parsed = lines.slice(1).map((line): ParsedRow => {
      const cells = parseLine(line);
      const propertyName = cells[indexes.property] ?? "";
      const property = properties.find((item) =>
        [item.name, item.code].some(
          (candidate) => normalize(candidate) === normalize(propertyName),
        ),
      );
      const guestName = cells[indexes.guest] ?? "";
      const checkIn = isoDate(cells[indexes.checkIn] ?? "");
      const checkOut = isoDate(cells[indexes.checkOut] ?? "");
      const channel =
        normalize(cells[indexes.channel] ?? defaultChannel).replace("booking.com", "booking") ||
        defaultChannel;
      const guest = guests.find((item) => normalize(item.full_name) === normalize(guestName));
      const duplicate = Boolean(
        property &&
        reservations.some(
          (reservation) =>
            reservation.property_id === property.id &&
            reservation.guest_id === guest?.id &&
            reservation.check_in === checkIn &&
            reservation.check_out === checkOut,
        ),
      );
      const error = !property
        ? "Alojamiento no reconocido"
        : !guestName
          ? "Falta huésped"
          : !checkIn || !checkOut || checkOut <= checkIn
            ? "Fechas inválidas"
            : undefined;
      return {
        propertyName,
        propertyId: property?.id ?? null,
        guestName,
        checkIn,
        checkOut,
        amount: amount(cells[indexes.amount] ?? "0"),
        channel,
        duplicate,
        error,
      };
    });
    setRows(parsed);
  }

  async function importRows() {
    const ready = rows.filter((row) => !row.error && !row.duplicate && row.propertyId);
    let imported = 0;
    for (const row of ready) {
      try {
        await create.mutateAsync({
          property_id: row.propertyId!,
          guest_name: row.guestName,
          guest_email: null,
          guest_phone: null,
          check_in: row.checkIn,
          check_out: row.checkOut,
          guests_count: 1,
          total_amount: row.amount,
          payment_status: "paid",
          notes: "Importada desde CSV",
          channel: row.channel,
        });
        imported += 1;
      } catch (error) {
        toast.error(
          `${row.guestName}: ${error instanceof Error ? error.message : "No se pudo importar"}`,
        );
      }
    }
    toast.success(`${imported} reservación(es) importadas al calendario.`);
    setRows([]);
  }

  return (
    <AppShell
      title="Agregar reservaciones externas"
      subtitle="Airbnb por CSV; Booking.com, Vrbo, Expedia y otros canales mediante captura manual"
    >
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Captura manual de otros canales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Registra únicamente los datos que necesita el cliente. Al guardar, la reservación
            aparecerá inmediatamente en el calendario y en los reportes con su canal de origen.
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Canal">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={manual.channel}
                onChange={(event) =>
                  setManual((value) => ({ ...value, channel: event.target.value }))
                }
              >
                <option value="booking">Booking.com</option>
                <option value="vrbo">Vrbo</option>
                <option value="expedia">Expedia</option>
                <option value="directo">Directa</option>
                <option value="otro">Otro canal</option>
              </select>
            </Field>
            <Field label="Casa / alojamiento">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={manual.propertyId}
                onChange={(event) =>
                  setManual((value) => ({ ...value, propertyId: event.target.value }))
                }
              >
                <option value="">Selecciona una propiedad</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.code} · {property.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre del huésped">
              <Input
                value={manual.guestName}
                onChange={(event) =>
                  setManual((value) => ({ ...value, guestName: event.target.value }))
                }
              />
            </Field>
            <Field label="Entrada">
              <Input
                type="date"
                value={manual.checkIn}
                onChange={(event) =>
                  setManual((value) => ({ ...value, checkIn: event.target.value }))
                }
              />
            </Field>
            <Field label="Salida">
              <Input
                type="date"
                value={manual.checkOut}
                onChange={(event) =>
                  setManual((value) => ({ ...value, checkOut: event.target.value }))
                }
              />
            </Field>
            <Field label="Importe pagado">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={manual.amount}
                onChange={(event) =>
                  setManual((value) => ({ ...value, amount: event.target.value }))
                }
              />
            </Field>
          </div>
          {manual.checkIn && manual.checkOut && manual.checkOut > manual.checkIn && (
            <p className="text-sm text-muted-foreground">
              Estancia: {nightsBetween(manual.checkIn, manual.checkOut)} noches
            </p>
          )}
          <Button disabled={create.isPending} onClick={createManualReservation}>
            {create.isPending ? "Guardando…" : "Agregar al calendario"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos que CasaFlow utilizará</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Solo se guardan canal, alojamiento, huésped, entrada, salida e importe pagado. Las demás
            columnas del archivo se ignoran.
          </p>
          <label className="grid max-w-xs gap-1 text-sm font-medium">
            Canal predeterminado
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={defaultChannel}
              onChange={(event) => setDefaultChannel(event.target.value)}
            >
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking.com</option>
              <option value="vrbo">Vrbo</option>
              <option value="expedia">Expedia</option>
              <option value="directo">Directo / otro</option>
            </select>
          </label>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Upload className="size-7" />
            <span className="font-medium">Seleccionar archivo CSV</span>
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
        </CardContent>
      </Card>
      {rows.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Vista previa ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Canal</th>
                    <th>Alojamiento</th>
                    <th>Huésped</th>
                    <th>Estancia</th>
                    <th>Pagado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.guestName}-${index}`} className="border-b">
                      <td className="p-2">{row.channel}</td>
                      <td>{row.propertyName}</td>
                      <td>{row.guestName}</td>
                      <td>
                        {row.checkIn} → {row.checkOut} ·{" "}
                        {row.checkIn && row.checkOut ? nightsBetween(row.checkIn, row.checkOut) : 0}{" "}
                        noches
                      </td>
                      <td>{money(row.amount)}</td>
                      <td
                        className={
                          row.error
                            ? "text-destructive"
                            : row.duplicate
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }
                      >
                        {row.error ?? (row.duplicate ? "Duplicada" : "Lista")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              className="mt-4"
              disabled={create.isPending || rows.every((row) => row.error || row.duplicate)}
              onClick={importRows}
            >
              Importar al calendario
            </Button>
          </CardContent>
        </Card>
      )}
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
