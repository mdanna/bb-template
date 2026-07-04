import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { verifyCode } from "@/lib/totp";
import { verifyUnlockToken, UNLOCK_COOKIE } from "@/lib/stripeUnlock";
import { STRIPE_MODE, LIVE_KEY_CONFIGURED, stripeLive, WEBHOOK_SECRET_LIVE, type StripeMode } from "@/lib/stripe";

const FILE_PATH = "src/data/stripe.json";

async function isUnlocked(): Promise<boolean> {
  const store = await cookies();
  return verifyUnlockToken(store.get(UNLOCK_COOKIE)?.value);
}

// GET → stato corrente + health-check (richiede unlock). Non espone mai le chiavi.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!(await isUnlocked())) return NextResponse.json({ error: "Sezione bloccata" }, { status: 403 });

  // Valida la live key facendo una chiamata autenticata leggera, senza rivelarla.
  let liveKeyValid = false;
  if (stripeLive) {
    try {
      await stripeLive.balance.retrieve();
      liveKeyValid = true;
    } catch {
      liveKeyValid = false;
    }
  }

  return NextResponse.json({
    mode: STRIPE_MODE,
    liveKeyConfigured: LIVE_KEY_CONFIGURED,
    liveKeyValid,
    webhookLiveConfigured: WEBHOOK_SECRET_LIVE.length > 0,
  });
}

// POST { mode, code, confirmPhrase } → cambia modalità (richiede unlock + TOTP fresco;
// verso "live" anche la frase di conferma). Committa stripe.json → redeploy.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!(await isUnlocked())) return NextResponse.json({ error: "Sezione bloccata" }, { status: 403 });

  const body = await request.json().catch(() => null) as
    { mode?: string; code?: string; acknowledge?: boolean } | null;
  const mode = body?.mode as StripeMode | undefined;
  if (mode !== "test" && mode !== "live") {
    return NextResponse.json({ error: "Modalità non valida" }, { status: 400 });
  }

  const code = String(body?.code ?? "").trim();
  if (!/^\d{6}$/.test(code) || !(await verifyCode(code))) {
    return NextResponse.json({ error: "Codice authenticator non valido" }, { status: 400 });
  }

  if (mode === "live") {
    if (!LIVE_KEY_CONFIGURED) {
      return NextResponse.json(
        { error: "Chiave di produzione non configurata (STRIPE_SECRET_KEY_LIVE)." },
        { status: 400 }
      );
    }
    if (body?.acknowledge !== true) {
      return NextResponse.json(
        { error: "Conferma richiesta: spunta la casella per attivare i pagamenti reali." },
        { status: 400 }
      );
    }
  }

  try {
    const token = requireBotToken();
    let sha = "";
    try {
      ({ sha } = await getFile(FILE_PATH, token));
    } catch {
      sha = "";
    }
    const content = JSON.stringify({ mode }, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, content, sha, `Stripe: modalità → ${mode}`, token);
    return NextResponse.json({ ok: true, mode, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
