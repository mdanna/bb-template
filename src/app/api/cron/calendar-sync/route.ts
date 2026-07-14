import { NextResponse } from "next/server";
import { runCalendarSync } from "@/lib/runCalendarSync";
import { setAppState } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { CALENDAR_LAST_SYNC_KEY } from "@/app/api/admin/calendar-sync/route";

// Sincronizzazione AUTOMATICA dei calendari OTA, invocata da Vercel Cron (vedi vercel.json).
// Stesso motore del pulsante manuale, ma autenticato via CRON_SECRET invece che sessione admin.
export async function GET(request: Request) {
  // Vercel Cron invia CRON_SECRET come Authorization: Bearer <secret>.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // In demo non c'è nulla da sincronizzare (nessun URL reale, nessuna scrittura).
  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true });

  const outcome = await runCalendarSync();
  if (!outcome.ok) {
    // Nessun calendario configurato o impostazioni illeggibili: non è un errore del cron.
    return NextResponse.json({ ok: true, skipped: outcome.reason });
  }

  await setAppState(CALENDAR_LAST_SYNC_KEY, new Date().toISOString()).catch(() => {});
  return NextResponse.json({
    ok: true,
    changed: outcome.result.changed,
    perPlatform: outcome.result.perPlatform,
    fetchErrors: outcome.result.fetchErrors,
  });
}
