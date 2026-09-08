import { supabase } from "@/integrations/supabase/client";

export const CSV_RESERVATION_HEADERS = [
  "codigo",
  "propiedad",
  "huesped",
  "check_in",
  "check_out",
  "huespedes",
  "total",
  "canal",
  "estado",
  "pago",
  "notas",
] as const;

export type CsvReservationRow = {
  rowNumber: number;
  codigo: string;
  propiedad: string;
  huesped: string;
  email: string;
  telefono: string;
  check_in: string;
  check_out: string;
  huespedes: number;
  total: number;
  canal: string;
  estado: string;
  pago: string;
  notas: string;
};

export type CsvRowValidation = CsvReservationRow & {
  valid: boolean;
  errors: string[];
  propertyId: string | null;
  duplicate: boolean;
};

export type CsvImportResult = {
  imported: number;
  skipped: number;
  errors: { rowNumber: number; message: string }[];
};

type PropertyRef = { id: string; code: string; name: string };
type ReservationRef = {
  code: string;
  property_id: string;
  channel: string;
  check_in: string;
  check_out: string;
};

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function splitCsvRecords(text: string) {
  const records: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        current += '""';
        i += 1;
      } else {
        quoted = !quoted;
        current += char;
      }
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (current.trim()) records.push(current);
      current = "";
      if (char === "\r" && text[i + 1] === "\n") i += 1;
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  return records;
}

function validIsoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
  );
}

function normalizeDate(value: string, order: "dmy" | "mdy" = "dmy") {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, first, second, y] = match;
    const [d, m] = order === "mdy" ? [second, first] : [first, second];
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw;
}

function normalizeChannel(value: string) {
  const v = normalize(value);
  if (v === "airbnb") return "Airbnb";
  if (["booking", "booking.com"].includes(v)) return "Booking";
  if (v === "vrbo") return "VRBO";
  if (v === "expedia") return "Expedia";
  if (["directo", "directa", "web directa"].includes(v)) return "directo";
  return value.trim();
}

function parseMoney(value: string) {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/[$€£MXNUSDMXN\u00a0]/gi, "")
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned || "0");
  return Number.isFinite(parsed) ? parsed : -1;
}

function findIndex(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const i = headers.indexOf(normalize(alias));
    if (i >= 0) return i;
  }
  return -1;
}

function getCell(cells: string[], headers: string[], aliases: string[]) {
  const i = findIndex(headers, aliases);
  return i >= 0 ? (cells[i] ?? "").trim() : "";
}

function isAirbnb(headers: string[]) {
  return [
    "codigo de confirmacion",
    "fecha de inicio",
    "fecha de finalizacion",
    "huesped",
    "espacio",
  ].every((header) => headers.includes(header));
}

export function parseReservationsCsv(text: string): CsvReservationRow[] {
  const records = splitCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("El CSV no contiene filas de reservas.");

  const headers = parseCsvLine(records[0]!).map(normalize);
  const airbnb = isAirbnb(headers);
  const casaFlow = ["codigo", "propiedad", "huesped", "check_in", "check_out"].every((h) =>
    headers.includes(h),
  );

  if (!airbnb && !casaFlow) {
    throw new Error(
      "Formato no reconocido. Sube el CSV original de Airbnb o usa la plantilla de CasaFlow.",
    );
  }

  const parsedRows = records.slice(1).map((record, i) => {
    const cells = parseCsvLine(record);

    const codigo = airbnb
      ? getCell(cells, headers, ["Código de confirmación"])
      : getCell(cells, headers, ["codigo"]);
    const propiedad = airbnb
      ? getCell(cells, headers, ["Espacio"])
      : getCell(cells, headers, ["propiedad"]);
    const huesped = getCell(cells, headers, airbnb ? ["Huésped"] : ["huesped"]);
    const checkIn = normalizeDate(
      getCell(cells, headers, airbnb ? ["Fecha de inicio"] : ["check_in"]),
      airbnb ? "mdy" : "dmy",
    );
    const checkOut = normalizeDate(
      getCell(cells, headers, airbnb ? ["Fecha de finalización"] : ["check_out"]),
      airbnb ? "mdy" : "dmy",
    );
    const guestsRaw = airbnb ? "1" : getCell(cells, headers, ["huespedes"]);
    const guests = Number.parseInt(guestsRaw || "1", 10);
    const totalRaw = airbnb
      ? getCell(cells, headers, ["Ingresos brutos", "Monto", "Ingresos recibidos"])
      : getCell(cells, headers, ["total"]);

    return {
      rowNumber: i + 2,
      codigo,
      propiedad,
      huesped,
      email: "",
      telefono: "",
      check_in: checkIn,
      check_out: checkOut,
      huespedes: Number.isFinite(guests) && guests > 0 ? guests : 1,
      total: parseMoney(totalRaw),
      canal: airbnb ? "Airbnb" : normalizeChannel(getCell(cells, headers, ["canal"])),
      estado: airbnb ? "confirmada" : getCell(cells, headers, ["estado"]) || "confirmada",
      pago: airbnb ? "registrado" : getCell(cells, headers, ["pago"]) || "pendiente",
      notas: "",
    };
  });

  if (!airbnb) return parsedRows;

  // El historial de transacciones de Airbnb suele repetir una reserva en varias
  // filas (alojamiento, limpieza, impuestos, ajustes). Conservamos una sola fila
  // completa por código y el importe positivo más alto disponible.
  const byCode = new Map<string, CsvReservationRow>();
  for (const row of parsedRows) {
    const hasReservationData = Boolean(
      row.codigo || row.propiedad || row.huesped || row.check_in || row.check_out,
    );
    if (!hasReservationData) continue;

    const key = normalize(row.codigo);
    if (!key) {
      byCode.set(`fila-${row.rowNumber}`, row);
      continue;
    }

    const previous = byCode.get(key);
    if (!previous) {
      byCode.set(key, row);
      continue;
    }

    const previousCompleteness = [
      previous.propiedad,
      previous.huesped,
      previous.check_in,
      previous.check_out,
    ].filter(Boolean).length;
    const rowCompleteness = [row.propiedad, row.huesped, row.check_in, row.check_out].filter(
      Boolean,
    ).length;
    const base = rowCompleteness > previousCompleteness ? row : previous;
    byCode.set(key, { ...base, total: Math.max(previous.total, row.total, 0) });
  }

  return [...byCode.values()];
}

export function validateReservationsCsv(
  rows: CsvReservationRow[],
  properties: PropertyRef[],
  reservations: ReservationRef[],
): CsvRowValidation[] {
  const propertyByKey = new Map<string, PropertyRef>();
  for (const property of properties) {
    propertyByKey.set(normalize(property.code), property);
    propertyByKey.set(normalize(property.name), property);
  }

  const findProperty = (value: string) => {
    const key = normalize(value);
    const exact = propertyByKey.get(key);
    if (exact) return exact;
    if (key.length < 5) return null;

    const matches = properties.filter((property) => {
      const name = normalize(property.name);
      return name.includes(key) || key.includes(name);
    });
    return matches.length === 1 ? matches[0]! : null;
  };

  const existingCodes = new Set(reservations.map((reservation) => normalize(reservation.code)));
  const existingStays = new Set(
    reservations.map((reservation) =>
      [
        reservation.property_id,
        normalize(reservation.channel),
        reservation.check_in,
        reservation.check_out,
      ].join("|"),
    ),
  );
  const seenCodes = new Set<string>();
  const seenStays = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const property = findProperty(row.propiedad);
    const codeKey = normalize(row.codigo);
    const stayKey = property
      ? [property.id, normalize(row.canal), row.check_in, row.check_out].join("|")
      : "";
    const duplicate = Boolean(
      (codeKey && (existingCodes.has(codeKey) || seenCodes.has(codeKey))) ||
      (stayKey && (existingStays.has(stayKey) || seenStays.has(stayKey))),
    );

    if (!row.codigo) errors.push("Falta código de reserva.");
    if (!property) errors.push("La propiedad no coincide con una propiedad existente de CasaFlow.");
    if (!row.huesped) errors.push("Falta el nombre del huésped.");
    if (!validIsoDate(row.check_in)) errors.push("La fecha de entrada no es válida.");
    if (!validIsoDate(row.check_out)) errors.push("La fecha de salida no es válida.");
    if (
      validIsoDate(row.check_in) &&
      validIsoDate(row.check_out) &&
      row.check_out <= row.check_in
    ) {
      errors.push("La salida debe ser posterior a la entrada.");
    }
    if (!Number.isFinite(row.total) || row.total < 0) errors.push("El total no es válido.");
    if (!row.canal) errors.push("Falta el canal.");

    if (codeKey) seenCodes.add(codeKey);
    if (stayKey) seenStays.add(stayKey);

    return {
      ...row,
      valid: errors.length === 0,
      errors,
      propertyId: property?.id ?? null,
      duplicate,
    };
  });
}

export async function importReservationsCsv(rows: CsvRowValidation[]): Promise<CsvImportResult> {
  const result: CsvImportResult = { imported: 0, skipped: 0, errors: [] };
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  for (const row of rows) {
    if (!row.valid || row.duplicate || !row.propertyId) {
      result.skipped += 1;
      continue;
    }

    const { data, error } = await rpc("import_external_reservation", {
      _code: row.codigo,
      _property_id: row.propertyId,
      _guest_name: row.huesped,
      _guest_email: null,
      _guest_phone: null,
      _check_in: row.check_in,
      _check_out: row.check_out,
      _guests_count: row.huespedes,
      _total_amount: row.total,
      _channel: row.canal,
      _status: row.estado,
      _payment_status: row.pago,
      _notes: null,
    });

    if (error) {
      result.errors.push({ rowNumber: row.rowNumber, message: error.message });
      continue;
    }

    const payload = data as { status?: string } | null;
    if (payload?.status === "duplicate") result.skipped += 1;
    else result.imported += 1;
  }

  return result;
}

export const CSV_TEMPLATE = `${CSV_RESERVATION_HEADERS.join(",")}\nRES-001,CF-001,Nombre Apellido,2026-09-10,2026-09-12,2,3500,Airbnb,confirmada,registrado,`;
