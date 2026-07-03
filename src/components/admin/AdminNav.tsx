"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import { adminLocaleOrder, adminFlags, adminTranslations, type AdminLocaleCode } from "@/i18n/admin";

function AdminLanguagePicker({
  locale,
  setLocale,
}: {
  locale: AdminLocaleCode;
  setLocale: (l: AdminLocaleCode) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={adminTranslations[locale].langName}
        className="text-xl leading-none transition hover:opacity-70"
      >
        {adminFlags[locale]}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-md border border-gold/40 bg-background shadow-lg">
          {adminLocaleOrder.map((code) => (
            <button
              key={code}
              onClick={() => {
                setLocale(code);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-gold/10 ${
                code === locale ? "text-gold" : "text-foreground/80"
              }`}
            >
              <span className="text-base leading-none">{adminFlags[code]}</span>
              {adminTranslations[code].langName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminNav({ userName: _userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useAdminLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/admin", label: t.nav.calendar },
    { href: "/admin/policy", label: t.nav.policy },
    { href: "/admin/contenuti", label: t.nav.contents },
    { href: "/admin/immagini", label: t.nav.images },
    { href: "/admin/bookings", label: t.nav.bookings },
    { href: "/admin/dashboard", label: t.nav.dashboard },
  ];

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const linkCls = (href: string) =>
    `text-xs uppercase tracking-widest transition hover:text-gold ${
      isActive(href) ? "text-gold" : "text-foreground/70"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-gold/30 bg-background/90 backdrop-blur-sm">
      {/* Mobile toolbar */}
      <div className="relative flex items-center justify-between px-6 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="rounded-full border border-gold/40 px-3 py-1.5 text-gold"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif-display text-sm italic text-foreground">
          {t.nav.title}
        </span>
        <AdminLanguagePicker locale={locale} setLocale={setLocale} />
      </div>

      {/* Desktop toolbar */}
      <div className="mx-auto hidden max-w-6xl items-center justify-between px-6 py-3 lg:flex">
        <span className="font-serif-display text-base italic text-foreground">
          {t.nav.title}
        </span>
        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkCls(link.href)}>
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: "/admin" })}
            className="text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
          >
            {t.nav.signOut}
          </button>
          <AdminLanguagePicker locale={locale} setLocale={setLocale} />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-gold/30 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkCls(link.href)}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: "/admin" })}
              className="text-left text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
            >
              {t.nav.signOut}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
