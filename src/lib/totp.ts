import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import * as OTPAuth from "otpauth";
import { pool, ensureStripeAdminSchema } from "@/lib/db";
import { CONTENT } from "@/lib/siteContent";

// Protezione TOTP (RFC 6238) della pagina di configurazione Stripe.
// Il secret vive SOLO nel database (mai su git). Se TOTP_ENC_KEY è impostata,
// viene cifrato a riposo (AES-256-GCM): nemmeno l'accesso al solo DB basta a
// generare codici.

const ISSUER = CONTENT.siteTitle.it || "B&B Admin";
const LABEL = `${ISSUER} · Stripe`;

function buildTotp(base32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: LABEL,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  });
}

// --- cifratura a riposo (opzionale) ---

function encKey(): Buffer | null {
  const k = process.env.TOTP_ENC_KEY;
  if (!k) return null;
  return createHash("sha256").update(k).digest(); // 32 byte
}

function encryptSecret(base32: string): string {
  const key = encKey();
  if (!key) return base32; // nessuna chiave → salvato in chiaro
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(base32, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

function decryptSecret(stored: string): string {
  if (!stored.startsWith("enc:v1:")) return stored; // già in chiaro
  const key = encKey();
  if (!key) throw new Error("TOTP_ENC_KEY non configurata ma il secret è cifrato");
  const [, , ivB64, tagB64, ctB64] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

// --- stato / enrollment ---

export type TotpStatus = "none" | "pending" | "confirmed";

async function readRow(): Promise<{ secret: string | null; confirmed: boolean } | null> {
  await ensureStripeAdminSchema();
  const res = await pool.query<{ secret: string | null; confirmed: boolean }>(
    `SELECT secret, confirmed FROM stripe_admin_totp WHERE id = 1`
  );
  return res.rows[0] ?? null;
}

export async function getStatus(): Promise<TotpStatus> {
  const row = await readRow();
  if (!row || !row.secret) return "none";
  return row.confirmed ? "confirmed" : "pending";
}

// Genera un nuovo secret (non confermato) e lo salva. Restituisce base32 + URI otpauth
// per QR. Sovrascrive un eventuale enrollment pending (ma non uno confermato: quello
// va prima resettato).
export async function startEnrollment(): Promise<{ base32: string; uri: string }> {
  await ensureStripeAdminSchema();
  const base32 = new OTPAuth.Secret({ size: 20 }).base32;
  const stored = encryptSecret(base32);
  await pool.query(
    `INSERT INTO stripe_admin_totp (id, secret, confirmed, created_at, confirmed_at)
     VALUES (1, $1, false, now(), NULL)
     ON CONFLICT (id) DO UPDATE SET secret = EXCLUDED.secret, confirmed = false, created_at = now(), confirmed_at = NULL`,
    [stored]
  );
  return { base32, uri: buildTotp(base32).toString() };
}

// Verifica un codice contro il secret pending e, se valido, conferma l'enrollment.
export async function confirmEnrollment(code: string): Promise<boolean> {
  const row = await readRow();
  if (!row || !row.secret) return false;
  const base32 = decryptSecret(row.secret);
  const delta = buildTotp(base32).validate({ token: code, window: 1 });
  if (delta === null) return false;
  await pool.query(`UPDATE stripe_admin_totp SET confirmed = true, confirmed_at = now() WHERE id = 1`);
  return true;
}

// Verifica un codice contro il secret CONFERMATO (uso normale: unlock / azioni).
export async function verifyCode(code: string): Promise<boolean> {
  const row = await readRow();
  if (!row || !row.secret || !row.confirmed) return false;
  const base32 = decryptSecret(row.secret);
  return buildTotp(base32).validate({ token: code, window: 1 }) !== null;
}

// Azzera l'enrollment (recupero telefono perso). Protetto a monte da un fattore diverso.
export async function resetEnrollment(): Promise<void> {
  await ensureStripeAdminSchema();
  await pool.query(`DELETE FROM stripe_admin_totp WHERE id = 1`);
}
