import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";

const FILE_PATH = "src/data/availability.json";

interface DayRate {
  date: string;
  price: number;
  status: "available" | "booked";
  source?: "airbnb" | "app" | "blocked" | "direct";
  note?: string;
}

interface SavePayload {
  defaultPrice: number;
  overrides: DayRate[];
}

function isValidPayload(body: unknown): body is SavePayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.defaultPrice !== "number" || b.defaultPrice <= 0) return false;
  if (!Array.isArray(b.overrides)) return false;
  return b.overrides.every((o) => {
    if (!o || typeof o !== "object") return false;
    const r = o as Record<string, unknown>;
    return (
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      typeof r.price === "number" &&
      r.price > 0 &&
      (r.status === "available" || r.status === "booked") &&
      (r.source === undefined || r.source === "airbnb" || r.source === "airbnb-blocked" || r.source === "app" || r.source === "blocked" || r.source === "direct") &&
      (r.note === undefined || typeof r.note === "string") &&
      (r.conflict === undefined || typeof r.conflict === "boolean")
    );
  });
}

export async function POST(request: Request) {
  // L'identità admin è verificata via GitHub OAuth (sessione), ma il commit effettivo
  // viene fatto con un token di servizio dedicato e limitato al solo repo: l'OAuth admin
  // non ha più bisogno dello scope "repo" sul proprio account personale.
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
    const { sha } = await getFile(FILE_PATH, token);

    const sortedOverrides = [...body.overrides].sort((a, b) => a.date.localeCompare(b.date));
    const content = JSON.stringify(
      { defaultPrice: body.defaultPrice, overrides: sortedOverrides },
      null,
      2
    );

    await putFile(FILE_PATH, content, sha, "Update availability and pricing from admin panel", token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
