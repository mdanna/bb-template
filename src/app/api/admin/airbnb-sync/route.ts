import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { parseICalReservations, icalEventNights } from "@/lib/icalParser";
import type { DayRate } from "@/data/availability";

const AVAIL_PATH = "src/data/availability.json";
const SETTINGS_PATH = "src/data/policies.json";

export interface SyncConflict {
  date: string;
  type: "overbooking"; // airbnb + app booking on the same night
  airbnbNote: string;
  appNote: string | undefined;
}

export interface SyncResult {
  imported: number;
  removed: number;
  conflicts: SyncConflict[];
  overrides: import("@/data/availability").DayRate[];
  defaultPrice: number;
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const token = requireBotToken();

  // Read iCal URL from settings
  let icalUrl = "";
  try {
    const { content } = await getFile(SETTINGS_PATH, token);
    icalUrl = (JSON.parse(content) as { airbnbIcalUrl?: string }).airbnbIcalUrl ?? "";
  } catch {
    return NextResponse.json({ error: "URL iCal Airbnb non configurato" }, { status: 400 });
  }

  if (!icalUrl.trim()) {
    return NextResponse.json({ error: "URL iCal Airbnb non configurato" }, { status: 400 });
  }

  // Download iCal feed
  let icalText: string;
  try {
    const res = await fetch(icalUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    icalText = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: `Impossibile scaricare il calendario Airbnb: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }

  // Parse reservations (SUMMARY contains "Reserved")
  const events = parseICalReservations(icalText);

  // Collect all nights from Airbnb events, distinguishing reservations from blocks
  const airbnbNightMap = new Map<string, { summary: string; isReservation: boolean }>();
  for (const event of events) {
    for (const night of icalEventNights(event)) {
      // Reservations take priority over blocks if the same night appears in both
      const existing = airbnbNightMap.get(night);
      if (!existing || event.isReservation) {
        airbnbNightMap.set(night, { summary: event.summary, isReservation: event.isReservation });
      }
    }
  }

  // Read current availability
  const { content, sha } = await getFile(AVAIL_PATH, token);
  const data = JSON.parse(content) as { defaultPrice: number; overrides: DayRate[] };

  // Count how many existing airbnb nights we are removing
  const removed = data.overrides.filter(
    (o) => o.source === "airbnb" || o.source === "airbnb-blocked"
  ).length;

  // Remove all existing airbnb/airbnb-blocked nights and clear conflict flags
  let overrides: DayRate[] = data.overrides
    .filter((o) => o.source !== "airbnb" && o.source !== "airbnb-blocked")
    .map((o) => (o.conflict ? { ...o, conflict: undefined } : o));

  // Process each Airbnb night
  const conflicts: SyncConflict[] = [];
  const byDate = new Map(overrides.map((o) => [o.date, o]));

  for (const [date, { summary, isReservation }] of airbnbNightMap) {
    const existing = byDate.get(date);
    const existingSource = existing?.source ?? (existing?.status === "booked" ? "blocked" : undefined);
    // Only real customer bookings (app/direct) are protected from Airbnb overwrite
    const isCustomerBooked = existing?.status === "booked" &&
      (existingSource === "app" || existingSource === "direct");
    // Manual blocks (blocked) yield to Airbnb reservations but not to host blocks
    const isManualBlock = existing?.status === "booked" && existingSource === "blocked";

    if (isCustomerBooked && isReservation) {
      // Airbnb guest reservation overlaps a customer booking → overbooking conflict
      conflicts.push({
        date,
        type: "overbooking",
        airbnbNote: summary,
        appNote: existing!.note,
      });
      // Mark the existing night with the conflict flag (do NOT overwrite)
      byDate.set(date, { ...existing!, conflict: true });
    } else if (isCustomerBooked) {
      // Airbnb host block vs customer booking: skip, customer booking takes priority
    } else if (isManualBlock && !isReservation) {
      // Airbnb host block vs manual block: skip, keep manual block
    } else {
      // Free night or manual block overridden by Airbnb reservation → import
      const price = data.defaultPrice;
      const source = isReservation ? "airbnb" : "airbnb-blocked";
      byDate.set(date, { date, price, status: "booked", source });
    }
  }

  overrides = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Strip undefined fields to keep the JSON clean
  const cleanOverrides = overrides.map((o) => {
    const r: DayRate = { date: o.date, price: o.price, status: o.status };
    if (o.source) r.source = o.source;
    if (o.note) r.note = o.note;
    if (o.conflict) r.conflict = o.conflict;
    return r;
  });

  const nextContent =
    JSON.stringify({ defaultPrice: data.defaultPrice, overrides: cleanOverrides }, null, 2) + "\n";

  await putFile(AVAIL_PATH, nextContent, sha, "Sync Airbnb calendar", token);

  const result: SyncResult = {
    imported: airbnbNightMap.size,
    removed,
    conflicts,
    overrides: cleanOverrides,
    defaultPrice: data.defaultPrice,
  };

  return NextResponse.json(result);
}
