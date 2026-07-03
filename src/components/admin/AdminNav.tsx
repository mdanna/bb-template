"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

const links = [
  { href: "/admin", label: "Calendario" },
  { href: "/admin/policy", label: "Policy" },
  { href: "/admin/contenuti", label: "Contenuti" },
  { href: "/admin/immagini", label: "Immagini" },
  { href: "/admin/bookings", label: "Prenotazioni" },
  { href: "/admin/dashboard", label: "Dashboard" },
];

export default function AdminNav(_: { userName?: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          Amministrazione
        </span>
        {/* Empty right slot to keep title centered */}
        <div className="w-[52px]" />
      </div>

      {/* Desktop toolbar */}
      <div className="mx-auto hidden max-w-6xl items-center justify-between px-6 py-3 lg:flex">
        <span className="font-serif-display text-base italic text-foreground">
          Amministrazione
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
            Esci
          </button>
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
              Esci
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
