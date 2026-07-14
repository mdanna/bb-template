import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { parseICalEvents, icalEventNights } from "@/lib/icalParser";
import { reconcile, type FetchedFeed, type CalendarConflict, type ReverseGap, type PlatformSummary } from "@/lib/calendarSync";
import { calendarUrlsFromPolicies, type Policies } from "@/lib/policies";
import { toISODate, type DayRate, type OtaPlatform } from "@/data/availability";

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

// Esito del motore: distingue i casi di configurazione (che l'admin mostra come 400 e il
// cron come "skip") dal successo. Così la logica di sync vive in un solo posto, richiamata
// sia dal pulsante manuale (sessione admin) sia dal cron automatico (CRON_SECRET).
export type SyncOutcome =
  | { ok: true; result: CalendarSyncResult }
  | { ok: false; reason: "settings-unreadable" | "no-calendars" };

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

/**
 * Importa le prenotazioni dagli OTA (Airbnb/Booking/Vrbo) e riconcilia `availability.json`.
 * FAIL-SAFE: se il feed di una piattaforma non risponde, i suoi dati esistenti restano
 * intatti (una notte non viene mai liberata per un fetch fallito). Scrive solo se cambia.
 */
export async function runCalendarSync(): Promise<SyncOutcome> {
  const token = requireBotToken();

  // URL dei calendari dalle impostazioni (policies.json), con retrocompat.
  let urls: Record<OtaPlatform, string>;
  try {
    const { content } = await getFile(SETTINGS_PATH, token);
    urls = calendarUrlsFromPolicies(JSON.parse(content) as Policies);
  } catch {
    return { ok: false, reason: "settings-unreadable" };
  }

  const configured = PLATFORMS.filter((p) => urls[p]);
  if (configured.length === 0) {
    return { ok: false, reason: "no-calendars" };
  }

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

  return {
    ok: true,
    result: {
      perPlatform: result.perPlatform,
      fetchErrors,
      conflicts: result.conflicts,
      reverseGaps: result.reverseGaps,
      bookingDisclaimer: result.bookingDisclaimer,
      changed,
      overrides: cleanOverrides,
      defaultPrice: data.defaultPrice,
    },
  };
}
