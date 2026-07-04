import Link from "next/link";
import { auth, signIn } from "@/auth";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminNav from "@/components/admin/AdminNav";
import EmailLoginForm from "@/components/admin/EmailLoginForm";
import { DEFAULT_PRICE, OVERRIDES } from "@/data/availability";
import { DEMO_MODE } from "@/lib/demo";

export default async function AdminPage() {
  const session = await auth();

  if (!session && DEMO_MODE) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <Link href="/" className="fixed left-6 top-6 text-xs uppercase tracking-widest text-foreground/60 transition hover:text-gold">
          ← Torna al sito
        </Link>
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Demo interattiva</p>
        <h1 className="font-serif-display text-3xl italic text-foreground">Il pannello di Dimora Suite</h1>
        <p className="max-w-md text-sm text-foreground/70">
          Esplora liberamente il pannello di gestione di una struttura di esempio: prenotazioni, contenuti,
          colori del sito, incassi. Modifica quello che vuoi — <strong>le modifiche non vengono salvate</strong>.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("demo", { redirectTo: "/admin" });
          }}
        >
          <button type="submit" className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold">
            Entra nella demo
          </button>
        </form>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <Link
          href="/"
          className="fixed left-6 top-6 text-xs uppercase tracking-widest text-foreground/60 transition hover:text-gold"
        >
          ← Torna al sito
        </Link>
        <h1 className="font-serif-display text-3xl italic text-foreground">
          Amministrazione
        </h1>
        <p className="max-w-sm text-sm text-foreground/70">
          Accedi per gestire prezzi e disponibilità. Scegli il metodo che preferisci.
        </p>

        {/* Login con GitHub */}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/admin" });
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
          >
            Accedi con GitHub
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-foreground/40">
          <span className="h-px w-8 bg-foreground/20" /> oppure <span className="h-px w-8 bg-foreground/20" />
        </div>

        {/* Login con magic-link via email (client component con esito inline) */}
        <EmailLoginForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav userName={session.user?.name ?? session.user?.email} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <AdminEditor initialDefaultPrice={DEFAULT_PRICE} initialOverrides={OVERRIDES} />
      </div>
    </div>
  );
}
