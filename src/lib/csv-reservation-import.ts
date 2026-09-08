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

function callRpc(fn: string, args: Record<string, unknown>) {
  return supabase.rpc(fn as never, args as never) as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slug(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const [, first, second, rawYear] = match;
    const year = rawYear!.length === 2 ? `20${rawYear}` : rawYear!;
    const [d, m] = order === "mdy" ? [second, first] : [first, second];
    return `${year}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const da = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return raw;
}

// Deduce el orden real (día/mes) observando toda la columna de fechas.
function inferDateOrder(values: string[], fallback: "dmy" | "mdy"): "dmy" | "mdy" {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const value of values) {
    const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) continue;
    if (Number(match[1]) > 12) firstOver12 = true;
    if (Number(match[2]) > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return "dmy";
  if (secondOver12 && !firstOver12) return "mdy";
  return fallback;
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

const FIELD_ALIASES = {
  codigo: ["codigo de confirmacion", "confirmation code", "codigo", "code"],
  propiedad: ["espacio", "alojamiento", "anuncio", "listing", "propiedad", "property"],
  huesped: ["huesped", "nombre del huesped", "guest name", "guest"],
  check_in: ["fecha de inicio", "start date", "check in", "checkin", "llegada", "entrada"],
  check_out: [
    "fecha de finalizacion",
    "fecha de fin",
    "end date",
    "check out",
    "checkout",
    "salida",
  ],
  huespedes: ["huespedes", "numero de huespedes", "guests", "of guests", "adultos"],
  total: [
    "ingresos brutos",
    "gross earnings",
    "ingresos recibidos",
    "monto",
    "amount",
    "total",
    "importe",
  ],
  canal: ["canal", "channel"],
  estado: ["estado", "status"],
  pago: ["pago", "payment", "estado de pago"],
  notas: ["notas", "notes"],
} as const;

type FieldKey = keyof typeof FIELD_ALIASES;

function findIndex(headers: string[], field: FieldKey) {
  const aliases = FIELD_ALIASES[field].map(slug);
  for (const alias of aliases) {
    const exact = headers.indexOf(alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((header) => header.includes(alias));
    if (partial >= 0) return partial;
  }
  return -1;
}

function columnValues(records: string[], index: number) {
  if (index < 0) return [];
  return records.map((record) => parseCsvLine(record)[index] ?? "");
}


export function parseReservationsCsv(text: string): CsvReservationRow[] {
  const records = splitCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("El CSV no contiene filas de reservas.");

  const headers = parseCsvLine(records[0]!).map(slug);
  const dataRecords = records.slice(1);

  const index = {
    codigo: findIndex(headers, "codigo"),
    propiedad: findIndex(headers, "propiedad"),
    huesped: findIndex(headers, "huesped"),
    check_in: findIndex(headers, "check_in"),
    check_out: findIndex(headers, "check_out"),
    huespedes: findIndex(headers, "huespedes"),
    total: findIndex(headers, "total"),
    canal: findIndex(headers, "canal"),
    estado: findIndex(headers, "estado"),
    pago: findIndex(headers, "pago"),
    notas: findIndex(headers, "notas"),
  };

  const casaFlow = ["codigo", "propiedad", "huesped", "check_in", "check_out"].every((header) =>
    headers.includes(header),
  );
  const airbnb =
    !casaFlow && index.codigo >= 0 && index.check_in >= 0 && index.check_out >= 0;

  if (!airbnb && !casaFlow) {
    throw new Error(
      "Formato no reconocido. Sube el CSV original de Airbnb o usa la plantilla de CasaFlow.",
    );
  }

  // Airbnb exporta las fechas en MM/DD/YYYY; la plantilla de CasaFlow usa YYYY-MM-DD.
  const fallbackOrder: "dmy" | "mdy" = airbnb ? "mdy" : "dmy";
  const dateOrder = inferDateOrder(
    [
      ...columnValues(dataRecords, index.check_in),
      ...columnValues(dataRecords, index.check_out),
    ],
    fallbackOrder,
  );

  const cell = (cells: string[], key: keyof typeof index) =>
    index[key] >= 0 ? (cells[index[key]] ?? "").trim() : "";

  const parsedRows = dataRecords.map((record, i) => {
    const cells = parseCsvLine(record);
    const guests = Number.parseInt(cell(cells, "huespedes") || "1", 10);

    return {
      rowNumber: i + 2,
      codigo: cell(cells, "codigo"),
      propiedad: cell(cells, "propiedad"),
      huesped: cell(cells, "huesped"),
      email: "",
      telefono: "",
      check_in: normalizeDate(cell(cells, "check_in"), dateOrder),
      check_out: normalizeDate(cell(cells, "check_out"), dateOrder),
      huespedes: Number.isFinite(guests) && guests > 0 ? guests : 1,
      total: parseMoney(cell(cells, "total")),
      canal: airbnb ? "Airbnb" : normalizeChannel(cell(cells, "canal")) || "directo",
      estado: airbnb ? "confirmada" : cell(cells, "estado") || "confirmada",
      pago: airbnb ? "registrado" : cell(cells, "pago") || "pendiente",
      notas: airbnb ? "" : cell(cells, "notas"),
    };
  });

  // Ignora filas puramente financieras (sin código, propiedad, huésped ni estancia).
  const usableRows = parsedRows.filter((row) =>
    Boolean(row.codigo || row.propiedad || row.huesped || row.check_in || row.check_out),
  );

  if (!airbnb) return usableRows;

  // El historial de transacciones de Airbnb suele repetir una reserva en varias
  // filas (alojamiento, limpieza, impuestos, ajustes). Conservamos una sola fila
  // completa por código y el importe positivo más alto disponible.
  const byCode = new Map<string, CsvReservationRow>();
  for (const row of usableRows) {
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

    const completeness = (item: CsvReservationRow) =>
      [item.propiedad, item.huesped, item.check_in, item.check_out].filter(Boolean).length;
    const base = completeness(row) > completeness(previous) ? row : previous;
    byCode.set(key, {
      ...base,
      propiedad: base.propiedad || previous.propiedad || row.propiedad,
      huesped: base.huesped || previous.huesped || row.huesped,
      check_in: base.check_in || previous.check_in || row.check_in,
      check_out: base.check_out || previous.check_out || row.check_out,
      rowNumber: Math.min(previous.rowNumber, row.rowNumber),
      total: Math.max(previous.total, row.total, 0),
    });
  }

  return [...byCode.values()].sort((a, b) => a.rowNumber - b.rowNumber);
}


export function validateReservationsCsv(
  rows: CsvReservationRow[],
  properties: PropertyRef[],
  reservations: ReservationRef[],
): CsvRowValidation[] {
  const propertyByKey = new Map<string, PropertyRef>();
  for (const property of properties) {
    propertyByKey.set(slug(property.code), property);
    propertyByKey.set(slug(property.name), property);
    propertyByKey.set(slug(`${property.code} ${property.name}`), property);
  }

  const findProperty = (value: string) => {
    const key = slug(value);
    if (!key) return null;
    const exact = propertyByKey.get(key);
    if (exact) return exact;

    const contains = properties.filter((property) => {
      const name = slug(property.name);
      return name.length >= 4 && (name.includes(key) || key.includes(name));
    });
    if (contains.length === 1) return contains[0]!;

    // Coincidencia por palabras significativas: solo se acepta si hay un único ganador claro.
    const keyWords = new Set(key.split(" ").filter((word) => word.length > 2));
    if (keyWords.size === 0) return null;

    const scored = properties
      .map((property) => {
        const words = slug(property.name)
          .split(" ")
          .filter((word) => word.length > 2);
        const hits = words.filter((word) => keyWords.has(word)).length;
        return { property, score: words.length ? hits / words.length : 0, hits };
      })
      .filter((item) => item.hits >= 2 && item.score >= 0.6)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 1) return scored[0]!.property;
    if (scored.length > 1 && scored[0]!.score > scored[1]!.score) return scored[0]!.property;
    return null;
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
  for (const row of rows) {
    if (!row.valid || row.duplicate || !row.propertyId) {
      result.skipped += 1;
      continue;
    }

    const { data, error } = await callRpc("import_external_reservation", {
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
