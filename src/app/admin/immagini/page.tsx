import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import ImageManager from "@/components/admin/ImageManager";

export default async function ImmaginiPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
          <p className="text-sm text-foreground/60">
            Carica e gestisci le immagini del sito.
          </p>
          <ImageManager />
        </div>
      </div>
    </div>
  );
}
