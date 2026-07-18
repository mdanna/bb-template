import { auth, GOOGLE_ENABLED } from "@/auth";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminNav from "@/components/admin/AdminNav";
import { DEFAULT_PRICE, OVERRIDES, STAY_RULES } from "@/data/availability";
import { DEMO_MODE } from "@/lib/demo";

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    return <AdminLogin demo={DEMO_MODE} google={GOOGLE_ENABLED} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav userName={session.user?.name ?? session.user?.email} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <AdminEditor initialDefaultPrice={DEFAULT_PRICE} initialOverrides={OVERRIDES} initialStayRules={STAY_RULES} />
      </div>
    </div>
  );
}
