import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { icalExportToken } from "@/lib/icalExportToken";
import { getAppState } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { CALENDAR_LAST_SYNC_KEY } from "@/app/api/admin/calendar-sync/route";

// Fornisce al pannello l'URL del feed iCal di export (da incollare negli OTA) e il timestamp
// dell'ultima sincronizzazione automatica. Solo admin autenticato.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let url = "";
  try {
    url = base ? `${base}/api/calendar/${icalExportToken()}.ics` : "";
  } catch {
    url = "";
  }

  const lastSyncAt = DEMO_MODE ? null : await getAppState(CALENDAR_LAST_SYNC_KEY).catch(() => null);

  return NextResponse.json({ url, lastSyncAt });
}
