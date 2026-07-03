import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import ContentEditor from "@/components/admin/ContentEditor";

export default async function ContenutiPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
          <p className="text-sm text-foreground/60">
            Modifica i testi e le immagini del sito: nome, contatti, coordinate, galleria. Le
            modifiche vengono salvate su GitHub e pubblicate automaticamente in 1–2 minuti.
          </p>
          <ContentEditor />
        </div>
      </div>
    </div>
  );
}
