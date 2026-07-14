import type { DayRate } from "@/data/availability";

// Genera il feed iCal (VCALENDAR) delle notti NON disponibili, così gli OTA esterni
// (Airbnb, Booking, Vrbo…) possono importare la nostra disponibilità e bloccare le stesse
// date. Fonte unica: gli override di `availability.json` con `status: "booked"` — che
// includono già prenotazioni dirette (source "app"), reservation OTA e blocchi manuali.
// Le notti contigue vengono accorpate in un solo evento (DTSTART..DTEND esclusivo).

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "2026-07-27" → "20260727" (formato DATE iCal). */
function icalDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Piega le righe lunghe a 75 ottetti come da RFC 5545 (continuazione con spazio). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

export interface ExportOptions {
  /** Nome del calendario mostrato all'importazione (X-WR-CALNAME). */
  calName: string;
  /** Dominio per gli UID stabili (es. "villarosa.com"). */
  uidDomain: string;
  /** DTSTAMP condiviso (ISO). Passato dall'esterno per output deterministico/testabile. */
  stamp: string;
  /** Testo del riepilogo evento (localizzato). Default "Reserved". */
  summary?: string;
}

/** Comprime le date prenotate ordinate in intervalli contigui [start, endExclusive). */
export function bookedRanges(overrides: DayRate[]): { start: string; end: string }[] {
  const dates = overrides
    .filter((o) => o.status === "booked")
    .map((o) => o.date)
    .filter((d, i, a) => a.indexOf(d) === i)
    .sort();
  const ranges: { start: string; end: string }[] = [];
  for (const d of dates) {
    const last = ranges[ranges.length - 1];
    // `last.end` è esclusivo (= giorno dopo l'ultima notte): se d lo eguaglia, d è la
    // notte immediatamente successiva → estende l'intervallo; altrimenti c'è un buco.
    if (last && last.end === d) {
      last.end = addDays(d, 1);
    } else {
      ranges.push({ start: d, end: addDays(d, 1) });
    }
  }
  return ranges;
}

export function buildExportICal(overrides: DayRate[], opts: ExportOptions): string {
  const stamp = `${opts.stamp.replace(/[-:]/g, "").slice(0, 15)}Z`; // YYYYMMDDTHHMMSSZ
  const summary = opts.summary ?? "Reserved";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dimora Suite//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${opts.calName}`),
  ];
  for (const r of bookedRanges(overrides)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.start}-${r.end}@${opts.uidDomain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icalDate(r.start)}`,
      `DTEND;VALUE=DATE:${icalDate(r.end)}`,
      fold(`SUMMARY:${summary}`),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
