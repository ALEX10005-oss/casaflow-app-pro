import { supabase } from "@/integrations/supabase/client";

export const CSV_RESERVATION_HEADERS = [
  "codigo",
  "propiedad",
  "huesped",
  "email",
  "telefono",
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
  return value.trim().toLowerCase();
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
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
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

export function parseReservationsCsv(text: string): CsvReservationRow[] {
  const records = splitCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("El CSV no contiene filas de reservas.");

  const headers = parseCsvLine(records[0]!).map(normalize);
  const expected = [...CSV_RESERVATION_HEADERS];
  const missing = expected.filter((header) => !headers.includes(header));
  const extra = headers.filter((header) => !expected.includes(header as (typeof CSV_RESERVATION_HEADERS)[number]));

  if (missing.length || extra.length) {
    const parts = [
      missing.length ? `Faltan columnas: ${missing.join(", ")}.` : "",
      extra.length ? `Columnas no permitidas: ${extra.join(", ")}.` : "",
    ].filter(Boolean);
    throw new Error(parts.join(" "));
  }

  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  return records.slice(1).map((record, i) => {
    const cells = parseCsvLine(record);
    const get = (key: (typeof CSV_RESERVATION_HEADERS)[number]) => cells[index[key]!] ?? "";
    const guests = Number.parseInt(get("huespedes") || "1", 10);
    const total = Number.parseFloat((get("total") || "0").replace(/[$\s]/g, "").replace(/,/g, ""));

    return {
      rowNumber: i + 2,
      codigo: get("codigo").trim(),
      propiedad: get("propiedad").trim(),
      huesped: get("huesped").trim(),
      email: get("email").trim(),
      telefono: get("telefono").trim(),
      check_in: get("check_in").trim(),
      check_out: get("check_out").trim(),
      huespedes: Number.isFinite(guests) ? guests : 0,
      total: Number.isFinite(total) ? total : -1,
      canal: normalizeChannel(get("canal")),
      estado: get("estado").trim() || "confirmada",
      pago: get("pago").trim() || "pendiente",
      notas: get("notas").trim(),
    };
  });
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

  const existingCodes = new Set(reservations.map((reservation) => normalize(reservation.code)));
  const existingStays = new Set(
    reservations.map((reservation) =>
      [reservation.property_id, normalize(reservation.channel), reservation.check_in, reservation.check_out].join("|"),
    ),
  );
  const seenCodes = new Set<string>();
  const seenStays = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const property = propertyByKey.get(normalize(row.propiedad)) ?? null;
    const codeKey = normalize(row.codigo);
    const stayKey = property
      ? [property.id, normalize(row.canal), row.check_in, row.check_out].join("|")
      : "";
    const duplicate = Boolean(
      (codeKey && (existingCodes.has(codeKey) || seenCodes.has(codeKey))) ||
        (stayKey && (existingStays.has(stayKey) || seenStays.has(stayKey))),
    );

    if (!row.codigo) errors.push("Falta código de reserva.");
    if (!property) errors.push("La propiedad no coincide con un código o nombre existente.");
    if (!row.huesped) errors.push("Falta el nombre del huésped.");
    if (!validIsoDate(row.check_in)) errors.push("check_in debe usar formato YYYY-MM-DD.");
    if (!validIsoDate(row.check_out)) errors.push("check_out debe usar formato YYYY-MM-DD.");
    if (validIsoDate(row.check_in) && validIsoDate(row.check_out) && row.check_out <= row.check_in) {
      errors.push("check_out debe ser posterior a check_in.");
    }
    if (!Number.isInteger(row.huespedes) || row.huespedes < 1) errors.push("huespedes debe ser un entero mayor a 0.");
    if (!Number.isFinite(row.total) || row.total < 0) errors.push("total debe ser un número igual o mayor a 0.");
    if (!row.canal) errors.push("Falta el canal.");
    if (!row.estado) errors.push("Falta el estado.");
    if (!row.pago) errors.push("Falta el estado de pago.");

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
  const rpc = supabase.rpc as unknown as (
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
      _guest_email: row.email || null,
      _guest_phone: row.telefono || null,
      _check_in: row.check_in,
      _check_out: row.check_out,
      _guests_count: row.huespedes,
      _total_amount: row.total,
      _channel: row.canal,
      _status: row.estado,
      _payment_status: row.pago,
      _notes: row.notas || null,
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

export const CSV_TEMPLATE = `${CSV_RESERVATION_HEADERS.join(",")}\nRES-001,CF-001,Nombre Apellido,correo@ejemplo.com,+525500000000,2026-09-10,2026-09-12,2,3500,Booking,confirmada,pagado,`;
