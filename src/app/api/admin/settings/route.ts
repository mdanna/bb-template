import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { calendarUrlsFromPolicies, type CalendarUrls, type Policies } from "@/lib/policies";
import type { OtaPlatform } from "@/data/availability";

const FILE_PATH = "src/data/policies.json";
const PLATFORMS: OtaPlatform[] = ["airbnb", "booking", "vrbo"];

export interface AppSettings {
  calendars: CalendarUrls;
}

function isValidSettings(body: unknown): body is AppSettings {
  if (!body || typeof body !== "object") return false;
  const c = (body as { calendars?: unknown }).calendars;
  if (!c || typeof c !== "object") return false;
  const cal = c as Record<string, unknown>;
  return PLATFORMS.every((p) => cal[p] === undefined || typeof cal[p] === "string");
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    const policies: Policies = JSON.parse(content);
    return NextResponse.json({ calendars: calendarUrlsFromPolicies(policies) });
  } catch {
    return NextResponse.json({ calendars: { airbnb: "", booking: "", vrbo: "" } });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidSettings(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
    let sha: string;
    let currentPolicies: Policies;
    try {
      const { content, sha: fileSha } = await getFile(FILE_PATH, token);
      sha = fileSha;
      currentPolicies = JSON.parse(content);
    } catch {
      sha = "";
      const { POLICIES } = await import("@/lib/policies");
      currentPolicies = POLICIES;
    }
    // Normalizza i 3 URL e rimuovi il vecchio campo legacy.
    const calendars: CalendarUrls = {
      airbnb: (body.calendars.airbnb ?? "").trim(),
      booking: (body.calendars.booking ?? "").trim(),
      vrbo: (body.calendars.vrbo ?? "").trim(),
    };
    const updated: Policies = { ...currentPolicies, calendars };
    delete updated.airbnbIcalUrl;
    const content = JSON.stringify(updated, null, 2) + "\n";
    await putFile(FILE_PATH, content, sha, "Update calendar iCal URLs", token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
