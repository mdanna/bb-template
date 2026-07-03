import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import PolicyEditor from "@/components/admin/PolicyEditor";

export default async function PolicyPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
          <p className="text-sm text-foreground/60">
            Modifica le policy operative: tasse, depositi, cancellazioni, orari. Le modifiche vengono
            salvate su GitHub e pubblicate automaticamente in 1–2 minuti.
          </p>
          <PolicyEditor />
        </div>
      </div>
    </div>
  );
}
