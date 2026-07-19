import { auth, GOOGLE_ENABLED } from "@/auth";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminShell from "@/components/admin/AdminShell";
import { DEFAULT_PRICE, OVERRIDES, STAY_RULES } from "@/data/availability";
import { DEMO_MODE } from "@/lib/demo";

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    return <AdminLogin demo={DEMO_MODE} google={GOOGLE_ENABLED} />;
  }

  return (
    <AdminShell userName={session.user?.name ?? session.user?.email} width="max-w-3xl">
        <AdminEditor initialDefaultPrice={DEFAULT_PRICE} initialOverrides={OVERRIDES} initialStayRules={STAY_RULES} />
    </AdminShell>
  );
}
