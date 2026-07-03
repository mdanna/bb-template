import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import PostgresAdapter from "@auth/pg-adapter";
import type { Adapter } from "next-auth/adapters";
import { pool, ensureAuthSchema } from "@/lib/db";
import { CONTENT } from "@/lib/siteContent";

// Allowlist admin: username GitHub e/o indirizzi email autorizzati.
const ALLOWED_LOGINS = (process.env.ADMIN_GITHUB_LOGINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Mittente del magic-link: di default lo stesso indirizzo (sul dominio verificato
// in Resend) usato per le email transazionali, così eredita l'autenticazione SPF/DKIM.
const AUTH_EMAIL_FROM = process.env.AUTH_EMAIL_FROM ?? CONTENT.bookingEmail;

// Wrappa l'adapter Postgres in modo che lo schema Auth.js venga creato (idempotente)
// prima di ogni chiamata: l'app crea le tabelle a runtime (come ensureSchema).
function ensuredAdapter(): Adapter {
  const base = PostgresAdapter(pool) as unknown as Record<string, unknown>;
  return new Proxy(base, {
    get(target, prop) {
      const value = target[prop as string];
      if (typeof value === "function") {
        return async (...args: unknown[]) => {
          await ensureAuthSchema();
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as unknown as Adapter;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Senza questo, dietro il proxy di Vercel Auth.js non si fida dell'header Host del dominio
  // personalizzato e ricostruisce la callback URL usando il dominio *.vercel.app di default.
  trustHost: true,
  adapter: ensuredAdapter(),
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      // Con l'adapter DB, se esiste già un utente con la stessa email (es. creato
      // dal login via magic-link) il login GitHub darebbe OAuthAccountNotLinked.
      // Colleghiamo l'account allo stesso utente: l'accesso resta comunque
      // ristretto dall'allowlist (ADMIN_GITHUB_LOGINS/ADMIN_EMAILS).
      allowDangerousEmailAccountLinking: true,
      // I commit su GitHub usano GITHUB_BOT_TOKEN, non il token OAuth dell'admin:
      // qui basta lo scope minimo per identificare l'utente che effettua il login.
      authorization: { params: { scope: "read:user user:email" } },
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: AUTH_EMAIL_FROM,
      // Invia il magic-link SOLO agli indirizzi in allowlist: evita di usare il
      // sito per spedire email a indirizzi arbitrari (enumeration/abuso).
      async sendVerificationRequest({ identifier, url, provider }) {
        const email = identifier.toLowerCase();
        if (ALLOWED_EMAILS.length === 0 || !ALLOWED_EMAILS.includes(email)) {
          return; // non autorizzato: nessun invio, in silenzio
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject: "Accesso amministrazione",
            html: `<p>Ciao,</p><p>clicca il pulsante per accedere all'amministrazione:</p>
                   <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#b8860b;color:#fff;text-decoration:none;border-radius:9999px">Accedi</a></p>
                   <p>Oppure copia questo link: ${url}</p>
                   <p>Il link scade a breve. Se non hai richiesto tu l'accesso, ignora questa email.</p>`,
          }),
        });
        if (!res.ok) {
          throw new Error(`Invio email di accesso fallito: ${await res.text()}`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, user, account }) {
      // GitHub: autorizza per username.
      if (account?.provider === "github") {
        const login = (profile as { login?: string } | undefined)?.login?.toLowerCase();
        if (!login) return false;
        // Retrocompatibilità: se nessuna allowlist è configurata, non bloccare.
        if (ALLOWED_LOGINS.length === 0 && ALLOWED_EMAILS.length === 0) return true;
        return ALLOWED_LOGINS.includes(login);
      }
      // Magic-link email: autorizza per indirizzo (allowlist obbligatoria).
      if (account?.provider === "resend") {
        const email = user?.email?.toLowerCase();
        if (!email) return false;
        return ALLOWED_EMAILS.includes(email);
      }
      return false;
    },
  },
  pages: {
    signIn: "/admin",
  },
});
