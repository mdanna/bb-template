import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyCode } from "@/lib/totp";
import { generateUnlockToken, UNLOCK_COOKIE } from "@/lib/stripeUnlock";

// Sblocca la sezione Stripe: richiede un codice TOTP fresco e imposta un cookie
// firmato a scadenza breve (15 min).
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as { code?: string } | null;
  const code = String(body?.code ?? "").trim();
  if (!/^\d{6}$/.test(code) || !(await verifyCode(code))) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, generateUnlockToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 15 * 60,
  });
  return res;
}
