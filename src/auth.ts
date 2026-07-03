import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const ALLOWED_LOGINS = (process.env.ADMIN_GITHUB_LOGINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Senza questo, dietro il proxy di Vercel Auth.js non si fida dell'header Host del dominio
  // personalizzato e ricostruisce la callback URL usando il dominio *.vercel.app di default,
  // causando "redirect_uri is not associated with this application" su GitHub.
  trustHost: true,
  providers: [
    GitHub({
      // I commit su GitHub (prezzi/disponibilità, sincronizzazione calendario) usano un
      // token di servizio dedicato (GITHUB_BOT_TOKEN), non il token OAuth dell'admin: qui
      // basta lo scope minimo per identificare l'utente che effettua il login.
      authorization: { params: { scope: "read:user user:email" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const login = (profile as { login?: string } | undefined)?.login?.toLowerCase();
      if (!login) return false;
      if (ALLOWED_LOGINS.length === 0) return true;
      return ALLOWED_LOGINS.includes(login);
    },
  },
  pages: {
    signIn: "/admin",
  },
});
