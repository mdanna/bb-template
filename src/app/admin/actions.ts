"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export type LoginState = { ok: boolean; message: string } | null;

// Richiede il magic-link SENZA redirect: così l'esito torna qui e possiamo
// mostrare un messaggio inline invece della pagina di errore di Next.
// Messaggio neutro (uguale per email autorizzate e non) per non rivelare
// quali indirizzi sono admin.
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Inserisci un indirizzo email." };

  try {
    await signIn("resend", { email, redirect: false });
  } catch (err) {
    // Se Auth.js tentasse comunque un redirect (caso di successo), lascialo passare.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    if (err instanceof AuthError) {
      return {
        ok: false,
        message: "Non è stato possibile inviare il link. Riprova tra poco.",
      };
    }
    throw err;
  }

  return {
    ok: true,
    message:
      "Se l'indirizzo è autorizzato, riceverai un'email con il link di accesso. Controlla la posta (anche lo spam).",
  };
}
