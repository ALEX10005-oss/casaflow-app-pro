/**
 * Utilidades de calendario iCal (solo servidor).
 * Sincronización por sondeo: no es tiempo real, se registra la última lectura.
 */

export type IcalEvent = {
  uid: string;
  summary: string | null;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exclusivo, igual que check_out)
  cancelled: boolean;
};

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function toISODate(value: string): string | null {
  const v = value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> & { status?: string } | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {};
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (current?.uid && current.start && current.end) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? null,
          start: current.start,
          end: current.end,
          cancelled: (current.status ?? "").toUpperCase() === "CANCELLED",
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).toUpperCase();
    const value = line.slice(idx + 1);
    const name = key.split(";")[0] ?? "";

    if (name === "UID") current.uid = value.trim();
    else if (name === "SUMMARY") current.summary = value.trim().slice(0, 200) || null;
    else if (name === "STATUS") current.status = value.trim();
    else if (name === "DTSTART") current.start = toISODate(value) ?? undefined;
    else if (name === "DTEND") current.end = toISODate(value) ?? undefined;
  }

  // DTEND ausente: evento de un día
  return events.filter((e) => e.end > e.start);
}

export async function fetchIcal(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL de calendario no válida.");
  }
  const res = await fetch(parsed.toString(), {
    headers: { Accept: "text/calendar,text/plain,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`El canal respondió ${res.status}.`);
  const body = await res.text();
  if (!body.includes("BEGIN:VCALENDAR")) throw new Error("La URL no devuelve un calendario iCal.");
  return body;
}

/* ---------- Exportación ---------- */

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
const compact = (iso: string) => iso.replace(/-/g, "");

export function buildIcal(
  propertyName: string,
  items: { uid: string; start: string; end: string; summary: string }[],
): string {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CasaFlow//PMS//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc(propertyName)} — CasaFlow`),
  ];
  for (const it of items) {
    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:${it.uid}@casaflow`),
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(it.start)}`,
      `DTEND;VALUE=DATE:${compact(it.end)}`,
      fold(`SUMMARY:${esc(it.summary)}`),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
