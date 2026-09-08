import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CSV_TEMPLATE,
  importReservationsCsv,
  parseReservationsCsv,
  validateReservationsCsv,
  type CsvImportResult,
  type CsvRowValidation,
} from "@/lib/csv-reservation-import";
import type { Property, Reservation } from "@/lib/casaflow";

export function ReservationCsvImport({
  open,
  onOpenChange,
  properties,
  reservations,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  reservations: Reservation[];
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRowValidation[]>([]);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(() => rows.filter((row) => row.valid && !row.duplicate), [rows]);
  const duplicateRows = useMemo(() => rows.filter((row) => row.duplicate), [rows]);
  const invalidRows = useMemo(() => rows.filter((row) => !row.valid), [rows]);

  const reset = () => {
    setFileName("");
    setRows([]);
    setParseError("");
    setResult(null);
    setImporting(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !importing) reset();
    onOpenChange(next);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setParseError("");
    setRows([]);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Selecciona un archivo con extensión .csv.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseReservationsCsv(text);
      setRows(
        validateReservationsCsv(
          parsed,
          properties.map((property) => ({
            id: property.id,
            code: property.code,
            name: property.name,
          })),
          reservations.map((reservation) => ({
            code: reservation.code,
            property_id: reservation.property_id,
            channel: reservation.channel,
            check_in: reservation.check_in,
            check_out: reservation.check_out,
          })),
        ),
      );
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "No se pudo leer el CSV.");
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "casaflow-reservas.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!validRows.length || importing) return;
    setImporting(true);
    setResult(null);
    try {
      const nextResult = await importReservationsCsv(rows);
      setResult(nextResult);
      if (nextResult.imported > 0) onImported();
    } finally {
      setImporting(false);
    }
  };

  const assignProperty = (rowNumber: number, propertyName: string) => {
    const updated = rows.map((row) =>
      row.rowNumber === rowNumber ? { ...row, propiedad: propertyName } : row,
    );
    setRows(
      validateReservationsCsv(
        updated,
        properties.map((property) => ({
          id: property.id,
          code: property.code,
          name: property.name,
        })),
        reservations.map((reservation) => ({
          code: reservation.code,
          property_id: reservation.property_id,
          channel: reservation.channel,
          check_in: reservation.check_in,
          check_out: reservation.check_out,
        })),
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar reservas desde CSV</DialogTitle>
          <DialogDescription>
            Puedes subir directamente el CSV original de Airbnb. CasaFlow ignora las columnas
            adicionales y solo toma los datos acordados.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Protección de datos del cliente</p>
              <p className="text-muted-foreground">
                Primero se valida todo el archivo. Las reservas existentes se omiten y nunca se
                actualizan ni se eliminan durante la importación.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="size-4" /> Seleccionar CSV
          </Button>
          <Button type="button" variant="ghost" onClick={downloadTemplate} disabled={importing}>
            <Download className="size-4" /> Descargar plantilla
          </Button>
          {fileName && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" /> {fileName}
            </span>
          )}
        </div>

        <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          Datos que CasaFlow mostrará e importará: código de confirmación, propiedad, huésped,
          check-in, check-out, noches calculadas, canal y total. Las demás columnas del archivo de
          Airbnb se ignoran.
        </div>

        {parseError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {parseError}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Summary label="Listas para importar" value={validRows.length} />
              <Summary label="Duplicadas · se omiten" value={duplicateRows.length} />
              <Summary label="Con errores" value={invalidRows.length} />
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[980px] text-xs">
                <thead className="border-b bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Propiedad</th>
                    <th className="px-3 py-2">Huésped</th>
                    <th className="px-3 py-2">Estancia</th>
                    <th className="px-3 py-2">Canal</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.codigo}`} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono">{row.codigo || "—"}</td>
                      <td className="px-3 py-2">
                        {row.propertyId ? (
                          row.propiedad
                        ) : (
                          <select
                            className="max-w-56 rounded border bg-background px-2 py-1"
                            value=""
                            onChange={(event) => assignProperty(row.rowNumber, event.target.value)}
                            aria-label={`Asignar propiedad a la fila ${row.rowNumber}`}
                          >
                            <option value="">Asignar propiedad…</option>
                            {properties.map((property) => (
                              <option key={property.id} value={property.name}>
                                {property.code} · {property.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.huesped || "—"}</td>
                      <td className="px-3 py-2">
                        {row.check_in || "—"} → {row.check_out || "—"}
                      </td>
                      <td className="px-3 py-2">{row.canal || "—"}</td>
                      <td className="px-3 py-2">
                        {row.total >= 0 ? row.total.toLocaleString("es-MX") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.duplicate ? (
                          <span className="font-medium text-amber-700">Duplicada · se omite</span>
                        ) : row.valid ? (
                          <span className="font-medium text-emerald-700">Lista</span>
                        ) : (
                          <span className="text-destructive">{row.errors.join(" ")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {result && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-semibold">Resultado de importación</p>
            <p className="mt-1 text-muted-foreground">
              {result.imported} nuevas · {result.skipped} omitidas · {result.errors.length} con
              error.
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1 text-destructive">
                {result.errors.map((error) => (
                  <p key={`${error.rowNumber}-${error.message}`}>
                    Fila {error.rowNumber}: {error.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => void runImport()}
            disabled={!validRows.length || importing}
          >
            {importing ? "Importando…" : `Importar ${validRows.length} nuevas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
