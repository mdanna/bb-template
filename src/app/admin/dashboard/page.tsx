"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import { CONTENT } from "@/lib/siteContent";

interface Quarter {
  year: number;
  quarter: number;
  bookings: number;
  revenue: number;
  city_tax: number;
}

const QUARTER_MONTHS: Record<number, string> = {
  1: "Gen–Mar",
  2: "Apr–Giu",
  3: "Lug–Set",
  4: "Ott–Dic",
};

export default function DashboardPage() {
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => setQuarters(d.quarters ?? []))
      .finally(() => setLoading(false));
  }, []);

  const totals = quarters.reduce(
    (acc, q) => ({
      bookings: acc.bookings + q.bookings,
      revenue: acc.revenue + Number(q.revenue),
      city_tax: acc.city_tax + Number(q.city_tax),
    }),
    { bookings: 0, revenue: 0, city_tax: 0 }
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif-display text-3xl italic text-foreground">Dashboard</h1>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-gold/40 bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-foreground/50">Prenotazioni totali</p>
            <p className="mt-2 font-serif-display text-3xl italic text-foreground">{loading ? "…" : totals.bookings}</p>
          </div>
          <div className="rounded-lg border border-gold/40 bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-foreground/50">Ricavi totali</p>
            <p className="mt-2 font-serif-display text-3xl italic text-foreground">
              {loading ? "…" : `€${Number(totals.revenue).toLocaleString("it-IT")}`}
            </p>
          </div>
          <div className="rounded-lg border border-gold/40 bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-foreground/50">Tassa di soggiorno</p>
            <p className="mt-2 font-serif-display text-3xl italic text-foreground">
              {loading ? "…" : `€${Number(totals.city_tax).toLocaleString("it-IT")}`}
            </p>
          </div>
        </div>

        <h2 className="mt-10 font-serif-display text-xl italic text-foreground">Per trimestre</h2>
        <p className="mt-1 text-xs text-foreground/50">
          La tassa di soggiorno deve essere versata al Comune di {CONTENT.city} ogni trimestre.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-foreground/50">Caricamento…</p>
        ) : quarters.length === 0 ? (
          <p className="mt-6 text-sm text-foreground/50">Nessuna prenotazione completata o approvata.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-gold/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/30 bg-gold/5 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground/60">Trimestre</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground/60 text-right">Prenotazioni</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground/60 text-right">Ricavi</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-foreground/60 text-right">Tassa di soggiorno</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map((q, i) => (
                  <tr key={`${q.year}-${q.quarter}`} className={i % 2 === 0 ? "" : "bg-foreground/[0.02]"}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      T{q.quarter} {q.year}
                      <span className="ml-2 text-xs text-foreground/40">{QUARTER_MONTHS[q.quarter]}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/70">{q.bookings}</td>
                    <td className="px-4 py-3 text-right text-foreground">€{Number(q.revenue).toLocaleString("it-IT")}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">€{Number(q.city_tax).toLocaleString("it-IT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
