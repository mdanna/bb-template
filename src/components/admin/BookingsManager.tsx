"use client";

import { useEffect, useState } from "react";
import { formatDateOnly } from "@/lib/dateOnly";
import { DEFAULT_DEPOSIT_RATE } from "@/lib/pricing";

interface Booking {
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: string | null;
  deposit_amount: string | null;
  balance_due: string | null;
  city_tax: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  rejection_reason: string | null;
  payment_method: string | null;
  paid_at: string | null;
  balance_paid_at: string | null;
  created_at: string;
  archived: boolean;
}

const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "In attesa",
  approved: "Approvata · in attesa di pagamento",
  rejected: "Rifiutata",
  completed: "Completata",
  cancelled: "Annullata",
};

const STATUS_COLOR: Record<Booking["status"], string> = {
  pending: "text-gold",
  approved: "text-blue-700",
  rejected: "text-red-600",
  completed: "text-green-700",
  cancelled: "text-foreground/40",
};

function formatStayDate(value: string) {
  return formatDateOnly(value, "it-IT");
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString("it-IT");
}

function methodLabel(method: string | null) {
  if (method === "card") return "Carta di credito";
  if (method === "paypal") return "PayPal";
  return method ?? "";
}

function isPast(checkout: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(checkout) < today;
}

export default function BookingsManager() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<number, string>>({});

  async function load() {
    try {
      const [bookingsRes, availRes] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/availability"),
      ]);
      const data = await bookingsRes.json();
      if (!bookingsRes.ok) throw new Error(data.error ?? "Errore nel caricamento");
      setBookings(data.bookings);

      // Build a price-per-night lookup from availability data
      const avail = availRes.ok ? await availRes.json() : null;
      const defaultPrice: number = avail?.defaultPrice ?? 0;
      const overridesMap = new Map<string, number>(
        (avail?.overrides ?? []).map((o: { date: string; price: number }) => [o.date, o.price])
      );
      function nightPrice(isoDate: string): number {
        return overridesMap.get(isoDate) ?? defaultPrice;
      }
      function computeTotal(checkin: string, checkout: string): number {
        const [y1, m1, d1] = checkin.slice(0, 10).split("-").map(Number);
        const [y2, m2, d2] = checkout.slice(0, 10).split("-").map(Number);
        const cur = new Date(y1!, (m1 ?? 1) - 1, d1 ?? 1);
        const end = new Date(y2!, (m2 ?? 1) - 1, d2 ?? 1);
        let total = 0;
        while (cur < end) {
          const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
          total += nightPrice(iso);
          cur.setDate(cur.getDate() + 1);
        }
        return total;
      }

      const init: Record<number, string> = {};
      for (const b of data.bookings as Booking[]) {
        if (b.status !== "pending") continue;
        const price = b.total_price
          ? Number(b.total_price)
          : b.checkin && b.checkout ? computeTotal(b.checkin, b.checkout) : 0;
        if (price > 0) init[b.id] = String(price);
      }
      setCustomPrices((prev) => ({ ...init, ...prev }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    }
  }

  useEffect(() => {
    // Caricamento dati al mount da un'API interna: pattern di fetch-on-mount intenzionale.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function approve(id: number) {
    setBusyId(id);
    setError("");
    const rawPrice = customPrices[id];
    const customPrice = rawPrice && !isNaN(Number(rawPrice)) && Number(rawPrice) > 0
      ? Number(rawPrice)
      : null;
    try {
      const res = await fetch(`/api/admin/bookings/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      const warnings: string[] = [];
      if (data.calendarError) {
        warnings.push(`il calendario non è stato aggiornato automaticamente (${data.calendarError}) — blocca le date a mano in "Prezzi e disponibilità"`);
      }
      if (data.emailError) {
        warnings.push(`l'email di approvazione non è stata inviata (${data.emailError})`);
      }
      if (warnings.length > 0) {
        setError(`Stato aggiornato, ma ${warnings.join("; ")}.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!reason.trim()) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      if (data.emailError) {
        setError(`Stato aggiornato, ma l'email di rifiuto non è stata inviata: ${data.emailError}`);
      }
      setRejectingId(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: number) {
    if (!window.confirm("Annullare questa prenotazione? Le date verranno liberate sul calendario se erano bloccate.")) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      const notices: string[] = [];
      if (data.calendarError) {
        notices.push(`il calendario non è stato liberato automaticamente (${data.calendarError})`);
      }
      if (data.refundNotice) {
        notices.push(data.refundNotice);
      }
      if (notices.length > 0) {
        setError(`Prenotazione annullata. ${notices.join(" ")}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteBooking(id: number) {
    if (!window.confirm("Eliminare definitivamente questa prenotazione? L'operazione non è reversibile.")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setBusyId(null);
    }
  }

  async function setArchived(id: number, archived: boolean) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setBusyId(null);
    }
  }

  if (bookings === null) {
    return <p className="mt-10 text-sm text-foreground/60">Caricamento...</p>;
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const visibleBookings = bookings.filter((b) => (showArchived ? b.archived : !b.archived));
  const archivedCount = bookings.filter((b) => b.archived).length;

  return (
    <div className="mt-10 space-y-4">
      {pendingCount > 0 && (
        <p className="rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-foreground">
          {pendingCount} {pendingCount === 1 ? "richiesta in attesa" : "richieste in attesa"} di risposta
        </p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="font-serif-display text-lg italic text-foreground">
          {showArchived ? "Prenotazioni archiviate" : "Prenotazioni attive"}
        </h2>
        <div className="flex items-center gap-3">
          <a
            href="/api/admin/export"
            download
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            ↓ Esporta CSV
          </a>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            {showArchived ? "← Torna alle attive" : `Vedi archiviate (${archivedCount})`}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {visibleBookings.length === 0 && (
        <p className="text-sm text-foreground/60">
          {showArchived ? "Nessuna prenotazione archiviata." : "Nessuna richiesta di prenotazione."}
        </p>
      )}
      {visibleBookings.map((b) => (
        <div key={b.id} className={`rounded-lg border p-5 ${b.status === "cancelled" ? "border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/20" : "border-gold/40 bg-card"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-serif-display text-lg italic text-foreground">
                {b.code} · {b.first_name} {b.last_name}
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                {formatStayDate(b.checkin)} → {formatStayDate(b.checkout)} · {b.guests} ospiti
                {b.total_price ? ` · €${b.total_price}` : ""}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                {b.email} · {b.phone}
              </p>
              {b.message && (
                <p className="mt-2 text-sm italic text-foreground/70">&ldquo;{b.message}&rdquo;</p>
              )}
              {b.status === "rejected" && b.rejection_reason && (
                <p className="mt-2 text-sm text-red-600">Motivo: {b.rejection_reason}</p>
              )}
              {b.status === "cancelled" && (
                <p className="mt-2 text-sm text-red-600">Prenotazione annullata dall&apos;ospite</p>
              )}

              {/* Riquadro stato pagamenti */}
              {b.status === "approved" && b.total_price != null && (
                <div className="mt-3 rounded-md border border-gold/30 bg-background px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Totale soggiorno</span>
                    <span className="font-medium text-foreground">€{b.total_price}</span>
                  </div>
                  <div className="flex justify-between text-foreground/50 text-xs pt-0.5">
                    <span>Anticipo da definire al pagamento</span>
                  </div>
                </div>
              )}
              {b.status === "completed" && b.deposit_amount != null && (
                <div className="mt-3 rounded-md border border-gold/30 bg-background px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Totale soggiorno</span>
                    <span className="font-medium text-foreground">€{b.total_price ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/60">
                      Anticipo <span className="ml-1 text-green-700 font-semibold">✓ pagato</span>
                    </span>
                    <span className="font-semibold text-green-700">€{b.deposit_amount}</span>
                  </div>
                  {b.balance_due != null && Number(b.balance_due) > 0 && (
                    <div className="flex justify-between border-t border-gold/20 pt-1">
                      <span className="text-foreground/60">
                        Saldo{" "}
                        {b.balance_paid_at
                          ? <span className="text-green-700 font-semibold">✓ pagato il {formatTimestamp(b.balance_paid_at)}</span>
                          : <span className="text-amber-600 font-semibold">da incassare (entro 2 gg dal check-in)</span>}
                      </span>
                      <span className={`font-semibold ${b.balance_paid_at ? "text-green-700" : "text-foreground"}`}>
                        €{b.balance_due}
                      </span>
                    </div>
                  )}
                  {b.city_tax != null && Number(b.city_tax) > 0 && (
                    <div className="flex justify-between text-foreground/50 text-xs pt-0.5">
                      <span>Tassa di soggiorno (al check-in)</span>
                      <span>€{b.city_tax}</span>
                    </div>
                  )}
                  {b.paid_at && (
                    <p className="text-xs text-foreground/50 pt-0.5">
                      Pagato con {methodLabel(b.payment_method)} il {formatTimestamp(b.paid_at)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <span className={`text-xs font-semibold uppercase tracking-widest ${STATUS_COLOR[b.status]}`}>
              {STATUS_LABEL[b.status]}
            </span>
          </div>

          {b.status === "pending" && !showArchived && (
            <div className="mt-4 space-y-3">
              {/* Prezzo personalizzato opzionale */}
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-widest text-foreground/50 whitespace-nowrap">
                  Importo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={b.total_price ? String(Number(b.total_price)) : "—"}
                    value={customPrices[b.id] ?? ""}
                    onChange={(e) =>
                      setCustomPrices((prev) => ({ ...prev, [b.id]: e.target.value }))
                    }
                    className="w-32 rounded border border-gold/40 bg-background py-1.5 pl-7 pr-3 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                {customPrices[b.id] && (
                  <button
                    onClick={() => setCustomPrices((prev) => { const n = { ...prev }; delete n[b.id]; return n; })}
                    className="text-xs text-foreground/40 hover:text-foreground/70"
                  >
                    ✕
                  </button>
                )}
                <span className="text-xs text-foreground/40">
                  {customPrices[b.id] && !isNaN(Number(customPrices[b.id])) && Number(customPrices[b.id]) > 0
                    ? `Anticipo: €${Math.round(Number(customPrices[b.id]) * DEFAULT_DEPOSIT_RATE).toFixed(2)}`
                    : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => approve(b.id)}
                disabled={busyId === b.id}
                className="rounded-full border border-gold bg-gold px-5 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
              >
                Approva
              </button>
              {rejectingId === b.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Motivo del rifiuto..."
                    className="min-w-[200px] flex-1 rounded border border-gold/40 bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                  <button
                    onClick={() => reject(b.id)}
                    disabled={busyId === b.id || !reason.trim()}
                    className="rounded-full border border-red-600 px-4 py-1.5 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    Conferma rifiuto
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setReason("");
                    }}
                    className="text-xs uppercase tracking-widest text-foreground/50"
                  >
                    Annulla
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRejectingId(b.id)}
                  disabled={busyId === b.id}
                  className="rounded-full border border-red-600/60 px-5 py-2 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                >
                  Rifiuta
                </button>
              )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(b.status === "cancelled" || b.status === "rejected") && (
              <button
                onClick={() => deleteBooking(b.id)}
                disabled={busyId === b.id}
                className="rounded-full border border-red-400/60 px-5 py-2 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
              >
                Elimina
              </button>
            )}
            {(b.status === "approved" || b.status === "completed") && !showArchived && (
              <button
                onClick={() => cancel(b.id)}
                disabled={busyId === b.id}
                className="rounded-full border border-foreground/30 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:border-red-600 hover:text-red-600 disabled:opacity-50"
              >
                Annulla prenotazione
              </button>
            )}
            {!showArchived &&
              (b.status === "completed" || b.status === "rejected" || b.status === "cancelled") &&
              isPast(b.checkout) && (
                <button
                  onClick={() => setArchived(b.id, true)}
                  disabled={busyId === b.id}
                  className="rounded-full border border-foreground/30 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-foreground/10 disabled:opacity-50"
                >
                  Archivia
                </button>
              )}
            {showArchived && (
              <button
                onClick={() => setArchived(b.id, false)}
                disabled={busyId === b.id}
                className="rounded-full border border-foreground/30 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-foreground/10 disabled:opacity-50"
              >
                Ripristina
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
