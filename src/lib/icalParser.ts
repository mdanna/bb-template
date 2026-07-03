export interface ICalEvent {
  summary: string;
  dtstart: string; // YYYY-MM-DD (first night)
  dtend: string;   // YYYY-MM-DD (exclusive: checkout day)
  isReservation: boolean; // true = actual guest booking, false = host block
}

function parseICalDate(raw: string): string | null {
  // Formats: 20260720 or 20260720T120000Z or 20260720T120000
  const digits = raw.replace(/[TZ].*/g, "").trim();
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// Returns all nights [dtstart, dtend) as ISO date strings.
// DTEND in iCal is exclusive, so a booking 20–23 July occupies nights 20, 21, 22.
export function icalEventNights(event: ICalEvent): string[] {
  const nights: string[] = [];
  const cur = new Date(event.dtstart + "T00:00:00");
  const end = new Date(event.dtend + "T00:00:00");
  while (cur < end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    nights.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

export function parseICalReservations(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  // Split into VEVENT blocks
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of blocks) {
    const end = block.indexOf("END:VEVENT");
    const body = end !== -1 ? block.slice(0, end) : block;

    // Unfold long lines (iCal folds at 75 chars with CRLF + space/tab)
    const unfolded = body.replace(/\r?\n[ \t]/g, "");

    const lines = unfolded.split(/\r?\n/);
    const props: Record<string, string> = {};
    for (const line of lines) {
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      const key = line.slice(0, sep).split(";")[0].toUpperCase().trim();
      const val = line.slice(sep + 1).trim();
      props[key] = val;
    }

    const summary = props["SUMMARY"] ?? "";
    const dtstart = parseICalDate(props["DTSTART"] ?? "");
    const dtend = parseICalDate(props["DTEND"] ?? "");

    if (!dtstart || !dtend) continue;

    const isReservation = summary.toLowerCase().includes("reserved");
    events.push({ summary, dtstart, dtend, isReservation });
  }

  return events;
}
