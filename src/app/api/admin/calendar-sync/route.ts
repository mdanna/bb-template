import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { parseICalEvents, icalEventNights } from "@/lib/icalParser";
import { reconcile, type FetchedFeed, type CalendarConflict, type ReverseGap, type PlatformSummary } from "@/lib/calendarSync";
import { calendarUrlsFromPolicies, type Policies } from "@/lib/policies";
import { toISODate, type DayRate, type OtaPlatform } from "@/data/availability";
import { DEMO_MODE } from "@/lib/demo";

const AVAIL_PATH = "src/data/availability.json";
const SETTINGS_PATH = "src/data/policies.json";
const PLATFORMS: OtaPlatform[] = ["airbnb", "booking", "vrbo"];

export interface CalendarSyncResult {
  perPlatform: PlatformSummary[];
  fetchErrors: { platform: OtaPlatform; error: string }[];
  conflicts: CalendarConflict[];
  reverseGaps: ReverseGap[];
  bookingDisclaimer: boolean;
  changed: boolean;
  overrides: DayRate[];
  defaultPrice: number;
}

// Serializza un override con ordine di campi stabile (per il diff no-op).
function clean(o: DayRate): DayRate {
  const r: DayRate = { date: o.date, price: o.price, status: o.status };
  if (o.source) r.source = o.source;
  if (o.note) r.note = o.note;
  if (o.blockedBy && o.blockedBy.length) r.blockedBy = o.blockedBy;
  if (o.conflict) r.conflict = o.conflict;
  if (o.conflictWith && o.conflictWith.length) r.conflictWith = o.conflictWith;
  return r;
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // In demo non si sincronizza nulla (nessun URL reale, nessuna scrittura).
  if (DEMO_MODE) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const token = requireBotToken();

  // URL dei calendari dalle impostazioni (policies.json), con retrocompat.
  let urls: Record<OtaPlatform, string>;
  try {
    const { content } = await getFile(SETTINGS_PATH, token);
    urls = calendarUrlsFromPolicies(JSON.parse(content) as Policies);
  } catch {
    return NextResponse.json({ error: "Impostazioni calendari non leggibili" }, { status: 400 });
  }

  const configured = PLATFORMS.filter((p) => urls[p]);
  if (configured.length === 0) {
    return NextResponse.json({ error: "Nessun calendario iCal configurato" }, { status: 400 });
  }

  // Fetch per-piattaforma, FAIL-SAFE: se una fallisce non entra in `fetched` → i suoi
  // dati esistenti restano intatti (una notte non viene mai liberata per un fetch fallito).
  const fetched: FetchedFeed[] = [];
  const fetchErrors: { platform: OtaPlatform; error: string }[] = [];
  for (const platform of configured) {
    try {
      const res = await fetch(urls[platform], { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const events = parseICalEvents(text, platform);

      const resSet = new Set<string>();
      const reservations: { date: string; note: string }[] = [];
      const blockSet = new Set<string>();
      for (const ev of events) {
        for (const night of icalEventNights(ev)) {
          if (ev.isReservation) {
            if (!resSet.has(night)) { resSet.add(night); reservations.push({ date: night, note: ev.summary }); }
          } else {
            blockSet.add(night);
          }
        }
      }
      // Una notte che è sia prenotazione che blocco → vince la prenotazione.
      const blocks = [...blockSet].filter((n) => !resSet.has(n));
      fetched.push({ platform, reservations, blocks });
    } catch (err) {
      fetchErrors.push({ platform, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Riconciliazione (pura) sugli override attuali.
  const { content, sha } = await getFile(AVAIL_PATH, token);
  const data = JSON.parse(content) as { defaultPrice: number; overrides: DayRate[] };
  const result = reconcile({
    defaultPrice: data.defaultPrice,
    currentOverrides: data.overrides,
    fetched,
    todayISO: toISODate(new Date()),
  });

  const cleanOverrides = result.overrides.map(clean);
  const nextContent = JSON.stringify({ defaultPrice: data.defaultPrice, overrides: cleanOverrides }, null, 2) + "\n";
  const changed = nextContent !== content;
  if (changed) await putFile(AVAIL_PATH, nextContent, sha, "Sync calendars", token);

  const payload: CalendarSyncResult = {
    perPlatform: result.perPlatform,
    fetchErrors,
    conflicts: result.conflicts,
    reverseGaps: result.reverseGaps,
    bookingDisclaimer: result.bookingDisclaimer,
    changed,
    overrides: cleanOverrides,
    defaultPrice: data.defaultPrice,
  };
  return NextResponse.json(payload);
}
