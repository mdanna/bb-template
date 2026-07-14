import { getFile } from "@/lib/githubContent";
import { verifyIcalExportToken } from "@/lib/icalExportToken";
import { buildExportICal } from "@/lib/icalExport";
import { CONTENT } from "@/lib/siteContent";
import type { DayRate } from "@/data/availability";

const AVAIL_PATH = "src/data/availability.json";

// Feed iCal PUBBLICO (ma protetto da token segreto nell'URL) delle notti occupate, così gli
// OTA esterni possono importare la nostra disponibilità. URL: /api/calendar/<token>.ics
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const raw = token.replace(/\.ics$/i, "");

  // Token non valido → 404 (non 401), per non rivelare l'esistenza del feed.
  if (!verifyIcalExportToken(raw)) {
    return new Response("Not found", { status: 404 });
  }

  let overrides: DayRate[] = [];
  try {
    const { content } = await getFile(AVAIL_PATH, process.env.GITHUB_BOT_TOKEN ?? "");
    const data = JSON.parse(content) as { overrides?: DayRate[] };
    overrides = data.overrides ?? [];
  } catch {
    return new Response("Bad gateway", { status: 502 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const uidDomain = (() => {
    try { return new URL(siteUrl).hostname; } catch { return "example.com"; }
  })();

  const ics = buildExportICal(overrides, {
    calName: `${CONTENT.siteTitle.it} — ${CONTENT.city}`,
    uidDomain,
    stamp: new Date().toISOString(),
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
}
