import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";

const FILE_PATH = "src/data/availability.json";

import type { DayRate, DaySource, StayRule } from "@/data/availability";

// Fonte unica dei `source` validi (allineata a DaySource in availability.ts): include i
// blocchi/prenotazioni multi-OTA (booking, vrbo) e i blocchi importati (imported). Senza
// questi, pubblicare un calendario che contiene notti sincronizzate da Booking/Vrbo o
// blocchi OTA veniva rifiutato con "Dati non validi".
const VALID_SOURCES: ReadonlySet<DaySource> = new Set<DaySource>([
  "airbnb", "booking", "vrbo", "app", "direct", "blocked", "imported", "airbnb-blocked",
]);

interface SavePayload {
  defaultPrice: number;
  overrides: DayRate[];
  stayRules?: StayRule[];
}

// Valida `stayRules` (opzionale, retro-compatibile): array di regole { from, to } in
// formato YYYY-MM-DD con minStay/maxStay numerici opzionali (>0).
function isValidStayRules(v: unknown): v is StayRule[] {
  if (v === undefined) return true;
  if (!Array.isArray(v)) return false;
  return v.every((s) => {
    if (!s || typeof s !== "object") return false;
    const r = s as Record<string, unknown>;
    return (
      typeof r.from === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.from) &&
      typeof r.to === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.to) &&
      (r.minStay === undefined || (typeof r.minStay === "number" && r.minStay > 0)) &&
      (r.maxStay === undefined || (typeof r.maxStay === "number" && r.maxStay > 0))
    );
  });
}

// Ripulisce le regole in una forma minima e ordinata (from, to, e solo i limiti impostati).
function cleanStayRules(rules: StayRule[]): StayRule[] {
  return [...rules]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((r) => ({
      from: r.from,
      to: r.to,
      ...(typeof r.minStay === "number" ? { minStay: r.minStay } : {}),
      ...(typeof r.maxStay === "number" ? { maxStay: r.maxStay } : {}),
    }));
}

function isValidPayload(body: unknown): body is SavePayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.defaultPrice !== "number" || b.defaultPrice <= 0) return false;
  if (!Array.isArray(b.overrides)) return false;
  if (!isValidStayRules(b.stayRules)) return false;
  return b.overrides.every((o) => {
    if (!o || typeof o !== "object") return false;
    const r = o as Record<string, unknown>;
    return (
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      typeof r.price === "number" &&
      r.price > 0 &&
      (r.status === "available" || r.status === "booked") &&
      (r.source === undefined || VALID_SOURCES.has(r.source as DaySource)) &&
      (r.note === undefined || typeof r.note === "string") &&
      (r.conflict === undefined || typeof r.conflict === "boolean") &&
      (r.blockedBy === undefined || Array.isArray(r.blockedBy)) &&
      (r.conflictWith === undefined || Array.isArray(r.conflictWith))
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
    const stayRules = cleanStayRules(body.stayRules ?? []);
    const content = JSON.stringify(
      // `stayRules` incluso solo se non vuoto → i calendari senza regole restano identici
      // (retro-compatibilità: nessun campo nuovo nei file già esistenti).
      {
        defaultPrice: body.defaultPrice,
        overrides: sortedOverrides,
        ...(stayRules.length ? { stayRules } : {}),
      },
      null,
      2
    );

    const { commitSha } = await putFile(FILE_PATH, content, sha, "Update availability and pricing from admin panel", token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
