import { createHmac, timingSafeEqual } from "crypto";

// Dopo aver superato il TOTP, la pagina Stripe riceve un cookie di "unlock" firmato
// con scadenza breve: sblocca la visualizzazione dell'health-check e abilita il
// toggle (che richiede comunque un codice TOTP fresco per l'azione effettiva).
const UNLOCK_TTL_MS = 15 * 60 * 1000; // 15 minuti
export const UNLOCK_COOKIE = "stripe_unlock";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET non configurato");
  return s;
}

function sign(exp: number): string {
  return createHmac("sha256", secret()).update(`stripe-unlock:${exp}`).digest("base64url");
}

export function generateUnlockToken(): string {
  const exp = Date.now() + UNLOCK_TTL_MS;
  return `${exp}.${sign(exp)}`;
}

export function verifyUnlockToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
