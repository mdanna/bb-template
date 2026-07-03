import { AdminLanguageProvider } from "@/i18n/AdminLanguageContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLanguageProvider>{children}</AdminLanguageProvider>;
}
