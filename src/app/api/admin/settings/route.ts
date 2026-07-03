import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import type { Policies } from "@/lib/policies";

const FILE_PATH = "src/data/policies.json";

export interface AppSettings {
  airbnbIcalUrl: string;
}

function isValidSettings(body: unknown): body is AppSettings {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.airbnbIcalUrl === "string";
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    const policies: Policies = JSON.parse(content);
    return NextResponse.json({ airbnbIcalUrl: policies.airbnbIcalUrl });
  } catch {
    return NextResponse.json({ airbnbIcalUrl: "" });
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
    const updated = { ...currentPolicies, airbnbIcalUrl: body.airbnbIcalUrl };
    const content = JSON.stringify(updated, null, 2) + "\n";
    await putFile(FILE_PATH, content, sha, "Update airbnb iCal URL", token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
