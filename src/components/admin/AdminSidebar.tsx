"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import StructureSwitcher from "@/components/admin/StructureSwitcher";
import { CONTENT } from "@/lib/siteContent";

// Sidebar del pannello: sostituisce la vecchia top-bar. Lo sfondo diverso dal sito
// pubblico dà lo "stacco" (si capisce subito di essere nel pannello) e l'eyebrow
// "Amministrazione" + nome struttura dice sempre dove sei. Le voci sono raggruppate
// per come si usa: Gestione (ogni giorno), Il tuo sito (vetrina), Impostazioni (raro).

interface NavItem {
  href: string;
  label: string;
}
interface NavGroup {
  header: string;
  items: NavItem[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminSidebar({ userName: _userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const { t, locale } = useAdminLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const siteName = CONTENT.siteTitle[locale] || CONTENT.siteTitle.it || t.nav.title;

  const groups: NavGroup[] = [
    {
      header: t.nav.groupManage,
      items: [
        { href: "/admin/dashboard", label: t.nav.dashboard },
        { href: "/admin", label: t.nav.calendar },
        { href: "/admin/bookings", label: t.nav.bookings },
        { href: "/admin/recensioni", label: t.nav.reviews },
      ],
    },
    {
      header: t.nav.groupSite,
      items: [
        { href: "/admin/contenuti", label: t.nav.contents },
        { href: "/admin/immagini", label: t.nav.images },
        { href: "/admin/tema", label: t.nav.theme },
      ],
    },
    {
      header: t.nav.groupSettings,
      items: [
        { href: "/admin/policy", label: t.nav.rules },
        { href: "/admin/stripe", label: t.nav.payments },
        { href: "/admin/accessi", label: t.nav.access },
        { href: "/admin/impostazioni", label: t.nav.sync },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const itemCls = (href: string) =>
    `block rounded-md px-2.5 py-1.5 text-sm transition ${
      isActive(href)
        ? "bg-gold/10 font-medium text-gold"
        : "text-foreground/70 hover:bg-gold/5 hover:text-gold"
    }`;

  const brand = (
    <div className="border-b border-gold/20 px-2.5 pb-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-gold">{t.nav.title}</div>
      <div className="mt-1 font-serif-display text-lg italic leading-tight text-foreground">{siteName}</div>
    </div>
  );

  const nav = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.header}>
          <div className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/40">
            {g.header}
          </div>
          <div className="flex flex-col gap-0.5">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} onClick={onNavigate} className={itemCls(it.href)}>
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const footer = (onNavigate?: () => void) => (
    <div className="mt-auto flex flex-col gap-1 border-t border-gold/20 pt-4">
      <StructureSwitcher />
      <Link
        href="/"
        onClick={onNavigate}
        className="rounded-md px-2.5 py-1.5 text-sm text-foreground/70 transition hover:bg-gold/5 hover:text-gold"
      >
        {t.nav.publicSite}
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/admin" })}
        className="rounded-md px-2.5 py-1.5 text-left text-sm text-foreground/70 transition hover:bg-gold/5 hover:text-gold"
      >
        {t.nav.signOut}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop: sidebar fissa a sinistra */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-gold/30 bg-card px-4 py-6 lg:flex">
        {brand}
        <div className="mt-5 flex flex-1 flex-col">
          {nav()}
          {footer()}
        </div>
      </aside>

      {/* Mobile: barra in alto + drawer a scomparsa */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-gold/30 bg-card/95 px-6 py-3 backdrop-blur-sm">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="rounded-full border border-gold/40 px-3 py-1.5 text-gold"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
          <span className="whitespace-nowrap font-serif-display text-sm italic text-foreground">{siteName}</span>
          <span className="w-9" aria-hidden />
        </div>
        {mobileOpen && (
          <div className="flex flex-col border-b border-gold/30 bg-card px-6 py-5">
            {nav(() => setMobileOpen(false))}
            {footer(() => setMobileOpen(false))}
          </div>
        )}
      </div>
    </>
  );
}
