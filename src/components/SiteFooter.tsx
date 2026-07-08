"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";
import type { LocaleCode } from "@/i18n/index";

// Se questa struttura fa parte di un portale multi-struttura, mostriamo un link che
// rimanda alla home del portale ("scopri tutte le nostre dimore"). Riusa lo stesso
// NEXT_PUBLIC_PORTAL_URL dello switcher admin; NEXT_PUBLIC_PORTAL_NAME (opzionale) è
// il nome del brand. Assenti = struttura singola → nessun link (retro-compatibile).
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL;
const PORTAL_NAME = process.env.NEXT_PUBLIC_PORTAL_NAME;

const PORTAL_LABEL: Record<LocaleCode, string> = {
  it: "Scopri tutte le nostre dimore",
  en: "Discover all our properties",
  fr: "Découvrez tous nos hébergements",
  de: "Alle unsere Unterkünfte entdecken",
  es: "Descubre todos nuestros alojamientos",
  pt: "Descubra todos os nossos alojamentos",
  zh: "探索我们所有的住宿",
  ja: "すべての宿泊施設を見る",
  ko: "우리의 모든 숙소 보기",
};

export default function SiteFooter() {
  const { locale } = useLanguage();
  const siteName = CONTENT.siteTitle[locale] ?? CONTENT.siteTitle.it;
  const portalLabel = PORTAL_LABEL[locale] ?? PORTAL_LABEL.it;

  return (
    <footer className="border-t border-gold/30 px-6 py-8 text-center text-xs text-foreground/50">
      {PORTAL_URL && (
        <div className="mb-5">
          <a
            href={PORTAL_URL}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-gold transition hover:opacity-70"
          >
            {PORTAL_NAME ? `${PORTAL_NAME} · ${portalLabel}` : portalLabel} →
          </a>
        </div>
      )}
© {new Date().getFullYear()} {siteName} · {CONTENT.city}
      <br />{CONTENT.phone} · {CONTENT.email}
      <br />CIN: {CONTENT.cin}
      <br />
      <a href="/privacy" className="underline hover:text-gold">
        Informativa sulla privacy
      </a>
      <div className="mt-4 text-foreground/40">
        Powered by{" "}
        <a
          href="https://dimorasuite.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gold"
        >
          Dimora Suite
        </a>
      </div>
    </footer>
  );
}
