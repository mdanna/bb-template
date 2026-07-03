"use client";

import { useEffect, useState } from "react";
import type { DayRate } from "@/data/availability";
import AdminCalendar from "./AdminCalendar";
import type { SyncResult, SyncConflict } from "@/app/api/admin/airbnb-sync/route";

interface Props {
  initialDefaultPrice: number;
  initialOverrides: DayRate[];
}

type SaveState = "idle" | "saving" | "success" | "error";
type SyncState = "idle" | "syncing" | "success" | "error";
type RangeMode = "price" | "booked" | "direct";
// `toISOString()` converte in UTC: con un fuso orario locale avanti rispetto a UTC la data
// può scivolare al giorno precedente. Usiamo sempre i componenti locali della data.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(toLocalISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function AdminEditor({ initialDefaultPrice, initialOverrides }: Props) {
  const [defaultPrice, setDefaultPrice] = useState(initialDefaultPrice);
  const [overrides, setOverrides] = useState<DayRate[]>(initialOverrides);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const today = toLocalISODate(new Date());
  // Airbnb sync state
  const [airbnbIcalUrl, setAirbnbIcalUrl] = useState("");
  const [urlSaveState, setUrlSaveState] = useState<SaveState>("idle");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: { airbnbIcalUrl?: string }) => { if (d.airbnbIcalUrl) setAirbnbIcalUrl(d.airbnbIcalUrl); })
      .catch(() => {});
  }, []);

  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [rangeMode, setRangeMode] = useState<RangeMode>("price");
  const [rangePrice, setRangePrice] = useState(initialDefaultPrice);
  const [airbnbNote, setAirbnbNote] = useState("");
  const [rangeError, setRangeError] = useState("");

  async function saveAirbnbUrl() {
    setUrlSaveState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airbnbIcalUrl: airbnbIcalUrl.trim() }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Errore");
      setUrlSaveState("success");
    } catch {
      setUrlSaveState("error");
    }
  }

  async function runAirbnbSync() {
    setSyncState("syncing");
    setSyncResult(null);
    setSyncError("");
    try {
      const res = await fetch("/api/admin/airbnb-sync", { method: "POST" });
      const data = await res.json() as SyncResult & { error?: string; overrides?: DayRate[] };
      if (!res.ok) throw new Error(data.error ?? "Errore sincronizzazione");
      setSyncResult(data as SyncResult);
      setSyncState("success");
      // Use the overrides returned by the sync API directly — avoids a race
      // condition where a second GitHub fetch would return stale data.
      if (data.overrides) setOverrides(data.overrides);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Errore sconosciuto");
      setSyncState("error");
    }
  }

  function deleteRun(dates: string[]) {
    setOverrides((prev) => prev.filter((o) => !dates.includes(o.date)));
  }

  function editNote(dates: string[], note: string) {
    setOverrides((prev) =>
      prev.map((o) =>
        dates.includes(o.date)
          ? { ...o, note: note.trim() || undefined }
          : o
      )
    );
  }

  function toggleDay(date: string) {
    setOverrides((prev) => {
      const existing = prev.find((o) => o.date === date);
      // Solo i giorni bloccati manualmente possono essere modificati da qui
      if (existing?.status === "booked" && (existing.source === "blocked" || !existing.source)) {
        return prev.filter((o) => o.date !== date);
      }
      if (existing?.status === "booked") return prev; // Airbnb/app: non modificabile
      const price = existing?.price ?? defaultPrice;
      const next = prev.filter((o) => o.date !== date);
      next.push({ date, price, status: "booked", source: "blocked" });
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function applyRange() {
    if (rangeEnd < rangeStart) return;
    setRangeError("");

    if (rangeMode === "booked" || rangeMode === "direct") {
      // Dal/Al sono check-in e check-out: si bloccano le notti, non il giorno di check-out.
      const allDates = enumerateDates(rangeStart, rangeEnd);
      const nights = allDates.length > 1 ? allDates.slice(0, -1) : allDates;

      // Blocca se qualche notte è già occupata da un'altra prenotazione
      const conflicts = overrides.filter(
        (o) => o.status === "booked" && nights.includes(o.date)
      );
      if (conflicts.length > 0) {
        setRangeError(
          `Attenzione: ${conflicts.length} nott${conflicts.length === 1 ? "e già occupata" : "i già occupate"} (${conflicts[0].date}${conflicts.length > 1 ? ` … ${conflicts[conflicts.length - 1].date}` : ""}). Elimina prima la prenotazione esistente.`
        );
        return;
      }

      const source = rangeMode === "direct" ? "direct" : "blocked";
      const note = rangeMode === "direct" && airbnbNote.trim() ? airbnbNote.trim() : undefined;
      setOverrides((prev) => {
        const next = prev.filter((o) => !nights.includes(o.date));
        for (const date of nights) {
          next.push({ date, price: defaultPrice, status: "booked", source, ...(note ? { note } : {}) });
        }
        return next.sort((a, b) => a.date.localeCompare(b.date));
      });
      return;
    }

    const dates = enumerateDates(rangeStart, rangeEnd);
    setOverrides((prev) => {
      const next = prev.filter((o) => !dates.includes(o.date));
      for (const date of dates) {
        const existing = prev.find((o) => o.date === date);
        // If price equals default and day was already freely available, no override needed
        if (rangePrice === defaultPrice && !existing) continue;
        next.push({
          date,
          price: rangePrice,
          // Preserve existing booking status/source/note — only the price changes
          status: existing?.status ?? "available",
          ...(existing?.source ? { source: existing.source } : {}),
          ...(existing?.note ? { note: existing.note } : {}),
        });
      }
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPrice, overrides }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Errore durante il salvataggio");
      setSaveState("success");
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Errore sconosciuto");
    }
  }

  return (
    <div className="mt-10">
      <div className="space-y-10">
          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Prezzo di base</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Usato per qualsiasi data senza un prezzo o uno stato personalizzato.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-foreground/70">€</span>
              <input
                type="number"
                min={1}
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(Number(e.target.value))}
                className="w-32 rounded border border-gold/40 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
              <span className="text-sm text-foreground/60">a notte</span>
            </div>
          </section>

          <section className="rounded-lg border border-gold/40 bg-card p-5">
            <h2 className="font-serif-display text-xl italic text-foreground">
              Imposta un intervallo di date
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Scegli le date, poi indica un prezzo oppure segna l&apos;intervallo come occupato.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-foreground/60">
                  {rangeMode === "booked" || rangeMode === "direct" ? "Check-in" : "Dal"}
                </span>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-foreground/60">
                  {rangeMode === "booked" || rangeMode === "direct" ? "Check-out" : "Al"}
                </span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>
            </div>
            {(rangeMode === "booked" || rangeMode === "direct") && (
              <p className="mt-2 text-xs text-foreground/50">
                Si bloccano le notti dal check-in al check-out: il giorno di check-out resta
                prenotabile, perché quella notte è libera.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="radio"
                  name="rangeMode"
                  checked={rangeMode === "price"}
                  onChange={() => setRangeMode("price")}
                />
                Imposta prezzo
              </label>
              {rangeMode === "price" && (
                <div className="flex items-center gap-1">
                  <span className="text-foreground/70">€</span>
                  <input
                    type="number"
                    min={1}
                    value={rangePrice}
                    onChange={(e) => setRangePrice(Number(e.target.value))}
                    className="w-24 rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                  <span className="text-sm text-foreground/60">a notte</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="radio"
                  name="rangeMode"
                  checked={rangeMode === "booked"}
                  onChange={() => setRangeMode("booked")}
                />
                Blocca giorni
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="radio"
                  name="rangeMode"
                  checked={rangeMode === "direct"}
                  onChange={() => setRangeMode("direct")}
                />
                Inserisci prenotazione non Airbnb
              </label>
            </div>

            {rangeMode === "direct" && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-foreground/60">Nota</span>
                <input
                  type="text"
                  placeholder="Nome ospite o riferimento"
                  value={airbnbNote}
                  onChange={(e) => setAirbnbNote(e.target.value)}
                  className="flex-1 rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>
            )}

            <button
              onClick={applyRange}
              disabled={rangeEnd < rangeStart}
              className="mt-4 rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Applica all&apos;intervallo
            </button>
            {rangeEnd < rangeStart && (
              <p className="mt-2 text-xs text-red-600">
                La data &ldquo;Al&rdquo; deve essere successiva o uguale alla data &ldquo;Dal&rdquo;.
              </p>
            )}
            {rangeError && (
              <p className="mt-2 text-xs text-red-600">{rangeError}</p>
            )}
          </section>

          {/* Airbnb sync section */}
          <section className="rounded-lg border border-[#FF5A5F]/30 bg-card p-5 space-y-4">
            <div>
              <h2 className="font-serif-display text-xl italic text-foreground flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#FF5A5F" }} />
                Sincronizzazione Airbnb
              </h2>
              <p className="mt-1 text-sm text-foreground/60">
                Importa le prenotazioni dal calendario iCal di Airbnb. Sostituisce tutte le notti
                Airbnb esistenti con i dati aggiornati.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-64">
                <label className="text-[10px] uppercase tracking-widest text-foreground/40">
                  URL iCal Airbnb
                </label>
                <input
                  type="url"
                  value={airbnbIcalUrl}
                  onChange={(e) => { setAirbnbIcalUrl(e.target.value); setUrlSaveState("idle"); }}
                  placeholder="https://www.airbnb.com/calendar/ical/…"
                  className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold font-mono"
                />
              </div>
              <button
                onClick={saveAirbnbUrl}
                disabled={urlSaveState === "saving" || !airbnbIcalUrl.trim()}
                className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50"
              >
                {urlSaveState === "saving" ? "Salvataggio…" : "Salva URL"}
              </button>
            </div>
            {urlSaveState === "success" && (
              <p className="text-xs text-green-700">URL salvato.</p>
            )}
            {urlSaveState === "error" && (
              <p className="text-xs text-red-600">Errore nel salvataggio dell&apos;URL.</p>
            )}

            <button
              onClick={runAirbnbSync}
              disabled={syncState === "syncing" || !airbnbIcalUrl.trim()}
              className="rounded-full border border-[#FF5A5F] bg-[#FF5A5F]/10 px-6 py-2 text-xs uppercase tracking-widest text-[#FF5A5F] transition hover:bg-[#FF5A5F]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncState === "syncing" ? "Sincronizzazione in corso…" : "Sincronizza ora"}
            </button>

            {syncState === "error" && (
              <p className="text-sm text-red-600">{syncError}</p>
            )}

            {syncState === "success" && syncResult && (
              <div className="space-y-3">
                <p className="text-sm text-green-700">
                  ✓ Sincronizzazione completata — {syncResult.imported} notti importate
                  {syncResult.removed > 0 ? `, ${syncResult.removed} precedenti rimosse` : ""}.
                </p>

                {syncResult.conflicts.length > 0 && (
                  <div className="rounded-md border border-red-400/60 bg-red-50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-red-700">
                      ⚠ {syncResult.conflicts.length} conflitt{syncResult.conflicts.length === 1 ? "o" : "i"} rilevat{syncResult.conflicts.length === 1 ? "o" : "i"} — gestione manuale richiesta
                    </p>
                    <p className="text-xs text-red-600">
                      Le notti seguenti sono prenotate sia su Airbnb che tramite l&apos;app. È necessario
                      contattare uno dei clienti per cancellare o spostare la prenotazione.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {syncResult.conflicts.map((c: SyncConflict) => (
                        <li key={c.date} className="text-xs text-red-700 font-mono">
                          {c.date}
                          {c.appNote ? ` · app: ${c.appNote}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Calendario</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Mostra il prezzo per i giorni liberi e i giorni già occupati. Clicca su un giorno per
              cambiarne lo stato (libero ↔ occupato).
            </p>
            <div className="mt-4 rounded-lg border border-gold/40 bg-card p-5">
              <AdminCalendar
                defaultPrice={defaultPrice}
                overrides={overrides}
                onToggleDay={toggleDay}
                onDeleteRun={deleteRun}
                onEditNote={editNote}
              />
            </div>
          </section>

          <section className="flex flex-col items-start gap-3">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveState === "saving" ? "Salvataggio..." : "Salva e pubblica"}
            </button>
            {saveState === "success" && (
              <p className="text-sm text-green-700">
                Salvato! Il sito di produzione si aggiornerà in pochi secondi.
              </p>
            )}
            {saveState === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
          </section>
      </div>
    </div>
  );
}
