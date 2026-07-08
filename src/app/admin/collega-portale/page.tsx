import { auth } from "@/auth";
import AdminLogin from "@/components/admin/AdminLogin";
import PortalLinkConfirm from "@/components/admin/PortalLinkConfirm";
import { DEMO_MODE } from "@/lib/demo";

// Pagina di conferma dell'associazione al portale (lato sito). Ci si arriva dal
// portale (redirect con ?portal=&name=&t=&action=); richiede il login admin di
// QUESTO sito, così solo chi lo controlla può collegarlo/scollegarlo.
export default async function CollegaPortalePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) return <AdminLogin demo={DEMO_MODE} />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  return (
    <PortalLinkConfirm
      portal={one(sp.portal)}
      name={one(sp.name)}
      token={one(sp.t)}
      action={one(sp.action) === "unlink" ? "unlink" : "link"}
    />
  );
}
