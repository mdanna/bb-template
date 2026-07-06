import { AdminLanguageProvider } from "@/i18n/AdminLanguageContext";
import { resolveAdminLocale } from "@/lib/policies";

// La lingua del pannello viene dalla configurazione del sito (policies.adminLocale,
// default "it"), letta lato server e passata al provider. Cambiabile da Impostazioni.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLanguageProvider locale={resolveAdminLocale()}>{children}</AdminLanguageProvider>;
}
