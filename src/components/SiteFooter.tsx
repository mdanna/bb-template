"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";

export default function SiteFooter() {
  const { locale } = useLanguage();
  const siteName = CONTENT.siteTitle[locale] ?? CONTENT.siteTitle.it;

  return (
    <footer className="border-t border-gold/30 px-6 py-8 text-center text-xs text-foreground/50">
© {new Date().getFullYear()} {siteName} · {CONTENT.city}
      <br />{CONTENT.phone} · {CONTENT.email}
      <br />CIN: {CONTENT.cin}
      <br />
      <a href="/privacy" className="underline hover:text-gold">
        Informativa sulla privacy
      </a>
    </footer>
  );
}
