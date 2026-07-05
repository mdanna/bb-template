"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import type { CalendarSyncResult } from "@/app/api/admin/calendar-sync/route";
import type { OtaPlatform } from "@/data/availability";

type State = "idle" | "saving" | "success" | "error";

const PLATFORMS: OtaPlatform[] = ["airbnb", "booking", "vrbo"];
const PLATFORM_NAME: Record<OtaPlatform, string> = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo" };
const PLATFORM_COLOR: Record<OtaPlatform, string> = { airbnb: "#FF5A5F", booking: "#003580", vrbo: "#0D9488" };
const ICAL_PLACEHOLDER: Record<OtaPlatform, string> = {
  airbnb: "https://www.airbnb.com/calendar/ical/…",
  booking: "https://admin.booking.com/…/ical/…",
  vrbo: "http://www.vrbo.com/icalendar/…",
};

const LABELS = {
  it: {
    title: "Sincronizzazione calendari",
    desc: "Importa le prenotazioni da Airbnb, Booking e Vrbo tramite l'URL iCal di ciascuna piattaforma. Le date prenotate altrove bloccano il calendario così eviti le doppie prenotazioni.",
    icalUrl: "URL iCal",
    save: "Salva URL", saving: "Salvataggio…", saved: "URL salvati.", saveError: "Errore nel salvataggio.",
    syncNow: "Sincronizza ora", syncing: "Sincronizzazione…", syncError: "Sincronizzazione fallita.",
    imported: "importate", blocks: "bloccate", noneConfigured: "Inserisci almeno un URL iCal e salva.",
    conflicts: (n: number) => `⚠ ${n} ${n === 1 ? "conflitto rilevato" : "conflitti rilevati"} (overbooking) — controlla il calendario`,
    reverseTitle: "Da bloccare sulle altre piattaforme",
    reverseItem: (label: string, on: string) => `Blocca le notti di “${label}” su: ${on}`,
    bookingDisclaimer: "Nota: l'iCal di Booking spesso non distingue una prenotazione da un blocco, quindi alcuni conflitti che coinvolgono Booking potrebbero non essere rilevati automaticamente.",
    fetchError: (p: string) => `Impossibile scaricare il calendario ${p} — i dati precedenti sono stati mantenuti.`,
    changed: "Sincronizzazione completata — il sito si aggiornerà tra qualche secondo.",
    unchanged: "Sincronizzazione completata — nessuna modifica.",
    demo: "In demo la sincronizzazione non viene eseguita.",
  },
  en: {
    title: "Calendar sync",
    desc: "Import bookings from Airbnb, Booking and Vrbo via each platform's iCal URL. Dates booked elsewhere block your calendar so you avoid double bookings.",
    icalUrl: "iCal URL",
    save: "Save URLs", saving: "Saving…", saved: "URLs saved.", saveError: "Error saving.",
    syncNow: "Sync now", syncing: "Syncing…", syncError: "Sync failed.",
    imported: "imported", blocks: "blocked", noneConfigured: "Enter at least one iCal URL and save.",
    conflicts: (n: number) => `⚠ ${n} conflict${n === 1 ? "" : "s"} detected (overbooking) — check the calendar`,
    reverseTitle: "To block on the other platforms",
    reverseItem: (label: string, on: string) => `Block the nights of “${label}” on: ${on}`,
    bookingDisclaimer: "Note: Booking's iCal often doesn't distinguish a reservation from a block, so some conflicts involving Booking may not be detected automatically.",
    fetchError: (p: string) => `Couldn't download the ${p} calendar — previous data was kept.`,
    changed: "Sync complete — the site will update in a few seconds.",
    unchanged: "Sync complete — no changes.",
    demo: "In the demo, sync is not performed.",
  },
  es: {
    title: "Sincronización de calendarios",
    desc: "Importa las reservas de Airbnb, Booking y Vrbo mediante la URL iCal de cada plataforma. Las fechas reservadas en otro sitio bloquean tu calendario para evitar dobles reservas.",
    icalUrl: "URL iCal",
    save: "Guardar URLs", saving: "Guardando…", saved: "URLs guardadas.", saveError: "Error al guardar.",
    syncNow: "Sincronizar ahora", syncing: "Sincronizando…", syncError: "Sincronización fallida.",
    imported: "importadas", blocks: "bloqueadas", noneConfigured: "Introduce al menos una URL iCal y guarda.",
    conflicts: (n: number) => `⚠ ${n} conflicto${n === 1 ? "" : "s"} detectado${n === 1 ? "" : "s"} (overbooking) — revisa el calendario`,
    reverseTitle: "Para bloquear en las otras plataformas",
    reverseItem: (label: string, on: string) => `Bloquea las noches de «${label}» en: ${on}`,
    bookingDisclaimer: "Nota: el iCal de Booking a menudo no distingue una reserva de un bloqueo, por lo que algunos conflictos con Booking podrían no detectarse automáticamente.",
    fetchError: (p: string) => `No se pudo descargar el calendario ${p} — se mantuvieron los datos anteriores.`,
    changed: "Sincronización completa — el sitio se actualizará en unos segundos.",
    unchanged: "Sincronización completa — sin cambios.",
    demo: "En la demo la sincronización no se ejecuta.",
  },
  fr: {
    title: "Synchronisation des calendriers",
    desc: "Importez les réservations d'Airbnb, Booking et Vrbo via l'URL iCal de chaque plateforme. Les dates réservées ailleurs bloquent votre calendrier pour éviter les doubles réservations.",
    icalUrl: "URL iCal",
    save: "Enregistrer les URL", saving: "Enregistrement…", saved: "URL enregistrées.", saveError: "Erreur d'enregistrement.",
    syncNow: "Synchroniser", syncing: "Synchronisation…", syncError: "Échec de la synchronisation.",
    imported: "importées", blocks: "bloquées", noneConfigured: "Saisissez au moins une URL iCal et enregistrez.",
    conflicts: (n: number) => `⚠ ${n} conflit${n === 1 ? "" : "s"} détecté${n === 1 ? "" : "s"} (surréservation) — vérifiez le calendrier`,
    reverseTitle: "À bloquer sur les autres plateformes",
    reverseItem: (label: string, on: string) => `Bloquez les nuits de « ${label} » sur : ${on}`,
    bookingDisclaimer: "Remarque : l'iCal de Booking ne distingue souvent pas une réservation d'un blocage, donc certains conflits impliquant Booking peuvent ne pas être détectés automatiquement.",
    fetchError: (p: string) => `Impossible de télécharger le calendrier ${p} — les données précédentes ont été conservées.`,
    changed: "Synchronisation terminée — le site se mettra à jour dans quelques secondes.",
    unchanged: "Synchronisation terminée — aucun changement.",
    demo: "Dans la démo, la synchronisation n'est pas exécutée.",
  },
} as const;

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function SettingsManager() {
  const { locale } = useAdminLanguage();
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;

  const [urls, setUrls] = useState<Record<OtaPlatform, string>>({ airbnb: "", booking: "", vrbo: "" });
  const [saveState, setSaveState] = useState<State>("idle");
  const [syncState, setSyncState] = useState<State>("idle");
  const [syncError, setSyncError] = useState("");
  const [result, setResult] = useState<CalendarSyncResult | null>(null);
  const [demoDone, setDemoDone] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: { calendars?: Record<OtaPlatform, string> }) => {
        if (d.calendars) setUrls({ airbnb: d.calendars.airbnb ?? "", booking: d.calendars.booking ?? "", vrbo: d.calendars.vrbo ?? "" });
      })
      .catch(() => {});
  }, []);

  const anyUrl = PLATFORMS.some((p) => urls[p].trim());

  async function saveUrls() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendars: urls }),
      });
      if (!res.ok) throw new Error();
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch { setSaveState("error"); }
  }

  async function runSync() {
    setSyncState("saving");
    setSyncError("");
    setResult(null);
    setDemoDone(false);
    try {
      const res = await fetch("/api/admin/calendar-sync", { method: "POST" });
      const data = await res.json();
      if (data?.demo) { setDemoDone(true); setSyncState("success"); return; }
      if (!res.ok) throw new Error(data?.error ?? "");
      setResult(data as CalendarSyncResult);
      setSyncState("success");
    } catch (err) {
      setSyncError(err instanceof Error && err.message ? err.message : L.syncError);
      setSyncState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif-display text-2xl italic text-foreground">{L.title}</h2>
        <p className="mt-1 text-sm text-foreground/60">{L.desc}</p>
      </div>

      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
        {PLATFORMS.map((p) => (
          <div key={p}>
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground/50">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR[p] }} />
              {PLATFORM_NAME[p]} · {L.icalUrl}
            </label>
            <input
              type="url" value={urls[p]}
              onChange={(e) => { setUrls((u) => ({ ...u, [p]: e.target.value })); setSaveState("idle"); }}
              placeholder={ICAL_PLACEHOLDER[p]}
              className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold font-mono"
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={saveUrls} disabled={saveState === "saving"}
            className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50">
            {saveState === "saving" ? L.saving : L.save}
          </button>
          {saveState === "success" && <span className="text-xs text-green-700">{DEMO ? L.demo : L.saved}</span>}
          {saveState === "error" && <span className="text-xs text-red-600">{L.saveError}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
        <button onClick={runSync} disabled={syncState === "saving" || !anyUrl}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50 disabled:cursor-not-allowed">
          {syncState === "saving" ? L.syncing : L.syncNow}
        </button>
        {!anyUrl && <p className="text-xs text-foreground/50">{L.noneConfigured}</p>}
        {syncState === "error" && <p className="text-sm text-red-600">{syncError}</p>}
        {demoDone && <p className="text-sm text-foreground/70">{L.demo}</p>}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-green-700">{result.changed ? L.changed : L.unchanged}</p>

            <ul className="space-y-1 text-xs text-foreground/70">
              {result.perPlatform.map((p) => (
                <li key={p.platform} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR[p.platform] }} />
                  {PLATFORM_NAME[p.platform]}: {p.reservations} {L.imported} · {p.blocks} {L.blocks}
                </li>
              ))}
            </ul>

            {result.fetchErrors.map((e) => (
              <p key={e.platform} className="text-xs text-amber-700">{L.fetchError(PLATFORM_NAME[e.platform])}</p>
            ))}

            {result.conflicts.length > 0 && (
              <p className="rounded-md border border-red-400/60 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {L.conflicts(result.conflicts.length)}
              </p>
            )}

            {result.reverseGaps.length > 0 && (
              <div className="rounded-md border border-gold/40 bg-background p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold">{L.reverseTitle}</p>
                <ul className="space-y-1">
                  {result.reverseGaps.map((g, i) => (
                    <li key={i} className="text-xs text-foreground/70">
                      {L.reverseItem(g.label, g.missingOn.map((m) => PLATFORM_NAME[m]).join(", "))}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.bookingDisclaimer && (
              <p className="text-xs text-foreground/50">{L.bookingDisclaimer}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
