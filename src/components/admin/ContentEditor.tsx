"use client";

import { useEffect, useState } from "react";
import type { SiteContent, MapBookmark, Review, AreaPlace, L10n, Details } from "@/lib/siteContent";

type SaveState = "idle" | "saving" | "success" | "error";
type TranslateState = "idle" | "translating" | "done" | "error";
type SubTab = "struttura" | "testi" | "area" | "servizi" | "recensioni";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "struttura", label: "Struttura" },
  { id: "testi", label: "Testi" },
  { id: "area", label: "Area" },
  { id: "servizi", label: "Servizi" },
  { id: "recensioni", label: "Recensioni" },
];

const inputCls =
  "rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold";
const labelCls = "flex flex-col gap-1 text-sm";
const labelTextCls = "text-foreground/70";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={labelTextCls}>{children}</span>;
}

function SaveButton({
  saveState,
  onClick,
}: {
  saveState: SaveState;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-4 pt-6">
      <button
        onClick={onClick}
        disabled={saveState === "saving"}
        className="rounded-full bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:opacity-90 disabled:opacity-50"
      >
        {saveState === "saving" ? "Salvataggio…" : "Salva"}
      </button>
      {saveState === "success" && (
        <span className="text-sm text-green-600">Salvato. Il sito si aggiornerà automaticamente in 1–2 minuti.</span>
      )}
      {saveState === "error" && (
        <span className="text-sm text-red-600">Errore nel salvataggio.</span>
      )}
    </div>
  );
}

function LangBadge() {
  return (
    <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
      IT
    </span>
  );
}

export default function ContentEditor() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<SubTab>("struttura");

  // Translation states
  const [textsTranslateState, setTextsTranslateState] = useState<TranslateState>("idle");
  const [textsTranslateError, setTextsTranslateError] = useState("");
  const [textsTranslatePreview, setTextsTranslatePreview] = useState<Record<string, string> | null>(null);
  const [showTextsPreview, setShowTextsPreview] = useState(false);

  const [areaDescTranslateState, setAreaDescTranslateState] = useState<TranslateState>("idle");
  const [areaDescTranslateError, setAreaDescTranslateError] = useState("");

  const [placesTranslateState, setPlacesTranslateState] = useState<TranslateState>("idle");
  const [placesTranslateError, setPlacesTranslateError] = useState("");

  const [amenitiesTranslateState, setAmenitiesTranslateState] = useState<TranslateState>("idle");
  const [amenitiesTranslateError, setAmenitiesTranslateError] = useState("");

  const [reviewsTranslateState, setReviewsTranslateState] = useState<TranslateState>("idle");
  const [reviewsTranslateError, setReviewsTranslateError] = useState("");

  const [detailsTranslateState, setDetailsTranslateState] = useState<TranslateState>("idle");
  const [detailsTranslateError, setDetailsTranslateError] = useState("");

  const [allTranslateState, setAllTranslateState] = useState<TranslateState>("idle");
  const [allTranslateError, setAllTranslateError] = useState("");

  useEffect(() => {
    fetch("/api/admin/content")
      .then((r) => r.json())
      .then(setContent)
      .catch(() => setLoadError("Errore nel caricamento"));
  }, []);

  async function handleSave() {
    if (!content) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Errore");
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  }

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setContent((c) => (c ? { ...c, [key]: value } : c));
  }

  function setL10nField(key: keyof SiteContent, lang: string, value: string) {
    setContent((c) => {
      if (!c) return c;
      const prev = c[key] as L10n;
      return { ...c, [key]: { ...prev, [lang]: value } };
    });
  }

  async function handleTranslateTexts() {
    if (!content) return;
    setTextsTranslateState("translating");
    setTextsTranslateError("");
    setTextsTranslatePreview(null);
    try {
      const paragraphTexts: Record<string, string> = {};
      content.storyParagraphs.forEach((p, i) => { paragraphTexts[`storyP${i}`] = p.it; });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: {
            siteTitle: content.siteTitle.it,
            heroSubtitle: content.heroSubtitle.it,
            storyTitle: content.storyTitle.it,
            ...paragraphTexts,
          },
        }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const merge = (field: L10n, key: string): L10n => (!tr[key] ? field : { ...field, ...tr[key] });
        const storyParagraphs = c.storyParagraphs.map((p, i) =>
          tr[`storyP${i}`] ? { ...p, ...tr[`storyP${i}`] } : p
        );
        return {
          ...c,
          siteTitle: merge(c.siteTitle, "siteTitle"),
          heroSubtitle: merge(c.heroSubtitle, "heroSubtitle"),
          storyTitle: merge(c.storyTitle, "storyTitle"),
          storyParagraphs,
        };
      });
      // Preview EN
      const preview: Record<string, string> = {
        siteTitle: tr.siteTitle?.en ?? "",
        heroSubtitle: tr.heroSubtitle?.en ?? "",
        storyTitle: tr.storyTitle?.en ?? "",
      };
      content.storyParagraphs.forEach((_, i) => { preview[`storyP${i}`] = tr[`storyP${i}`]?.en ?? ""; });
      setTextsTranslatePreview(preview);
      setTextsTranslateState("done");
    } catch (e) {
      setTextsTranslateError(e instanceof Error ? e.message : "Errore");
      setTextsTranslateState("error");
    }
  }

  async function handleTranslateAreaDesc() {
    if (!content) return;
    setAreaDescTranslateState("translating");
    setAreaDescTranslateError("");
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: { areaDescription: content.areaDescription.it } }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
      const tr = data.translations.areaDescription ?? {};
      setContent((c) => c ? { ...c, areaDescription: { ...c.areaDescription, ...tr } } : c);
      setAreaDescTranslateState("done");
    } catch (e) {
      setAreaDescTranslateError(e instanceof Error ? e.message : "Errore");
      setAreaDescTranslateState("error");
    }
  }

  async function handleTranslatePlaces() {
    if (!content) return;
    setPlacesTranslateState("translating");
    setPlacesTranslateError("");
    try {
      // Build a flat texts object: place_0_name, place_0_distance, place_1_name, ...
      const texts: Record<string, string> = {};
      content.areaPlaces.forEach((p, i) => {
        texts[`place_${i}_name`] = p.name.it;
        texts[`place_${i}_comment`] = p.comment.it;
      });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const updated = c.areaPlaces.map((p, i) => ({
          name: { ...p.name, ...(tr[`place_${i}_name`] ?? {}) },
          comment: { ...p.comment, ...(tr[`place_${i}_comment`] ?? {}) },
        }));
        return { ...c, areaPlaces: updated };
      });
      setPlacesTranslateState("done");
    } catch (e) {
      setPlacesTranslateError(e instanceof Error ? e.message : "Errore");
      setPlacesTranslateState("error");
    }
  }

  async function handleTranslateAmenities() {
    if (!content) return;
    setAmenitiesTranslateState("translating");
    setAmenitiesTranslateError("");
    try {
      const texts: Record<string, string> = {};
      content.amenities.forEach((a, i) => { texts[`amenity_${i}`] = a.it; });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const updated = c.amenities.map((a, i) => ({ ...a, ...(tr[`amenity_${i}`] ?? {}) }));
        return { ...c, amenities: updated };
      });
      setAmenitiesTranslateState("done");
    } catch (e) {
      setAmenitiesTranslateError(e instanceof Error ? e.message : "Errore");
      setAmenitiesTranslateState("error");
    }
  }

  async function handleTranslateReviews() {
    if (!content) return;
    setReviewsTranslateState("translating");
    setReviewsTranslateError("");
    try {
      const texts: Record<string, string> = {};
      content.reviews.forEach((r, i) => { texts[`review_${i}`] = (r.text as L10n).it; });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const updated = c.reviews.map((r, i) => ({
          ...r,
          text: { ...(r.text as L10n), ...(tr[`review_${i}`] ?? {}) },
        }));
        return { ...c, reviews: updated };
      });
      setReviewsTranslateState("done");
    } catch (e) {
      setReviewsTranslateError(e instanceof Error ? e.message : "Errore");
      setReviewsTranslateState("error");
    }
  }

  async function handleTranslateDetails() {
    if (!content) return;
    setDetailsTranslateState("translating");
    setDetailsTranslateError("");
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: {
            entirePlace: content.details.entirePlace.it,
            quietCourtyard: content.details.quietCourtyard.it,
            roomInfo: content.details.roomInfo.it,
            maxGuests: content.details.maxGuests.it,
            neighborhood: content.details.neighborhood.it,
          },
        }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const merge = (field: L10n, key: string): L10n => {
          if (!tr[key]) return field;
          return { ...field, ...tr[key] };
        };
        return {
          ...c,
          details: {
            entirePlace: merge(c.details.entirePlace, "entirePlace"),
            quietCourtyard: merge(c.details.quietCourtyard, "quietCourtyard"),
            roomInfo: merge(c.details.roomInfo, "roomInfo"),
            maxGuests: merge(c.details.maxGuests, "maxGuests"),
            neighborhood: merge(c.details.neighborhood, "neighborhood"),
          },
        };
      });
      setDetailsTranslateState("done");
    } catch (e) {
      setDetailsTranslateError(e instanceof Error ? e.message : "Errore");
      setDetailsTranslateState("error");
    }
  }

  async function handleTranslateAll() {
    if (!content) return;
    setAllTranslateState("translating");
    setAllTranslateError("");
    try {
      // Batch A: short fields (titles, details, amenities, area places)
      const batchA: Record<string, string> = {
        siteTitle: content.siteTitle.it,
        heroSubtitle: content.heroSubtitle.it,
        storyTitle: content.storyTitle.it,
        areaDescription: content.areaDescription.it,
        entirePlace: content.details.entirePlace.it,
        quietCourtyard: content.details.quietCourtyard.it,
        roomInfo: content.details.roomInfo.it,
        maxGuests: content.details.maxGuests.it,
        neighborhood: content.details.neighborhood.it,
      };
      content.amenities.forEach((a, i) => { batchA[`amenity_${i}`] = a.it; });
      content.areaPlaces.forEach((p, i) => {
        batchA[`place_${i}_name`] = p.name.it;
        batchA[`place_${i}_comment`] = p.comment.it;
      });

      // Batch B: long fields (story paragraphs + reviews)
      const batchB: Record<string, string> = {};
      content.storyParagraphs.forEach((p, i) => { batchB[`storyP${i}`] = p.it; });
      content.reviews.forEach((r, i) => { batchB[`review_${i}`] = (r.text as L10n).it; });

      const translate = async (texts: Record<string, string>) => {
        const res = await fetch("/api/admin/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts }),
        });
        const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
        if (!res.ok || !data.translations) throw new Error(data.error ?? "Errore");
        return data.translations;
      };

      const [trA, trB] = await Promise.all([translate(batchA), translate(batchB)]);
      const tr = { ...trA, ...trB };
      const merge = (field: L10n, key: string): L10n => (!tr[key] ? field : { ...field, ...tr[key] });

      setContent((c) => {
        if (!c) return c;
        return {
          ...c,
          siteTitle: merge(c.siteTitle, "siteTitle"),
          heroSubtitle: merge(c.heroSubtitle, "heroSubtitle"),
          storyTitle: merge(c.storyTitle, "storyTitle"),
          storyParagraphs: c.storyParagraphs.map((p, i) =>
            tr[`storyP${i}`] ? { ...p, ...tr[`storyP${i}`] } : p
          ),
          areaDescription: merge(c.areaDescription, "areaDescription"),
          areaPlaces: c.areaPlaces.map((p, i) => ({
            name: { ...p.name, ...(tr[`place_${i}_name`] ?? {}) },
            comment: { ...p.comment, ...(tr[`place_${i}_comment`] ?? {}) },
          })),
          amenities: c.amenities.map((a, i) => ({ ...a, ...(tr[`amenity_${i}`] ?? {}) })),
          reviews: c.reviews.map((r, i) => ({
            ...r,
            text: { ...(r.text as L10n), ...(tr[`review_${i}`] ?? {}) },
          })),
          details: {
            entirePlace: merge(c.details.entirePlace, "entirePlace"),
            quietCourtyard: merge(c.details.quietCourtyard, "quietCourtyard"),
            roomInfo: merge(c.details.roomInfo, "roomInfo"),
            maxGuests: merge(c.details.maxGuests, "maxGuests"),
            neighborhood: merge(c.details.neighborhood, "neighborhood"),
          },
        };
      });
      setAllTranslateState("done");
      setTimeout(() => setAllTranslateState("idle"), 4000);
    } catch (e) {
      setAllTranslateError(e instanceof Error ? e.message : "Errore");
      setAllTranslateState("error");
    }
  }

  if (!content) {
    return <p className="text-sm text-foreground/60">{loadError || "Caricamento…"}</p>;
  }

  // ---- Sub-tab renders ----

  function renderStruttura() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        {/* Struttura card */}
        <div className="rounded-lg border border-gold/30 bg-background p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">Struttura</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {(
              [
                ["Posizione (visualizzata)", "locationDisplay"],
                ["Città", "city"],
                ["Indirizzo", "address"],
                ["Telefono", "phone"],
                ["Email contatto", "email"],
                ["Email prenotazioni", "bookingEmail"],
                ["Partita IVA / Codice fiscale host", "vatNumber"],
                ["CIN (Codice Identificativo Nazionale)", "cin"],
                ["Nome host", "hostName"],
              ] as [string, keyof SiteContent][]
            ).map(([label, key]) => (
              <label key={key} className={labelCls}>
                <FieldLabel>{label}</FieldLabel>
                <input
                  type="text"
                  value={(content[key] as string) ?? ""}
                  onChange={(e) => set(key, e.target.value as SiteContent[typeof key])}
                  className={inputCls}
                />
              </label>
            ))}
            <p className="col-span-full text-xs text-foreground/40 -mt-2">Visualizzato nella pagina Privacy come titolare del trattamento dati.</p>
            <label className={`${labelCls} col-span-full`}>
              <FieldLabel>Meta description (SEO)</FieldLabel>
              <textarea
                rows={2}
                value={content.metaDescription ?? ""}
                onChange={(e) => set("metaDescription", e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {/* Airbnb card */}
        <div className="rounded-lg border border-gold/30 bg-background p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">Airbnb</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={`${labelCls} sm:col-span-3`}>
              <FieldLabel>URL Airbnb</FieldLabel>
              <input
                type="text"
                value={content.airbnbUrl}
                onChange={(e) => set("airbnbUrl", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              <FieldLabel>Rating</FieldLabel>
              <input
                type="number"
                step="0.01"
                value={content.airbnbRating}
                onChange={(e) => set("airbnbRating", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              <FieldLabel>Numero recensioni</FieldLabel>
              <input
                type="number"
                value={content.airbnbReviewCount}
                onChange={(e) => set("airbnbReviewCount", Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {/* Dettagli card */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Dettagli</h3>
          {(
            [
              { key: "entirePlace", label: "Tipo di alloggio" },
              { key: "quietCourtyard", label: "Caratteristiche" },
              { key: "roomInfo", label: "Composizione" },
              { key: "maxGuests", label: "Capacità" },
              { key: "neighborhood", label: "Zona" },
            ] as { key: keyof Details; label: string }[]
          ).map(({ key, label }) => (
            <label key={key} className={labelCls}>
              <span className={labelTextCls}>{label} <LangBadge /></span>
              <input
                type="text"
                value={content.details[key].it}
                onChange={(e) =>
                  setContent((c) =>
                    c ? { ...c, details: { ...c.details, [key]: { ...c.details[key], it: e.target.value } } } : c
                  )
                }
                className={inputCls}
              />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              onClick={handleTranslateDetails}
              disabled={detailsTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {detailsTranslateState === "translating" ? "Traduzione in corso…" : "Traduci dettagli"}
            </button>
            {detailsTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Tradotto</span>
            )}
            {detailsTranslateState === "error" && (
              <span className="text-xs text-red-600">{detailsTranslateError}</span>
            )}
          </div>
        </div>

        <SaveButton saveState={saveState} onClick={handleSave} />
      </div>
    );
  }

  function renderTesti() {
    if (!content) return null;
    const MAX_PARAGRAPHS = 5;

    function addParagraph() {
      const empty: L10n = { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" };
      set("storyParagraphs", [...content!.storyParagraphs, empty]);
    }

    function removeParagraph(idx: number) {
      set("storyParagraphs", content!.storyParagraphs.filter((_, i) => i !== idx));
    }

    function setParagraphIt(idx: number, value: string) {
      const updated = content!.storyParagraphs.map((p, i) => i === idx ? { ...p, it: value } : p);
      set("storyParagraphs", updated);
    }

    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-5">
          {/* Titolo struttura */}
          <label className={labelCls}>
            <span className={labelTextCls}>Titolo struttura <LangBadge /></span>
            <input type="text" value={content.siteTitle.it}
              onChange={(e) => setL10nField("siteTitle", "it", e.target.value)} className={inputCls} />
          </label>
          {/* Sottotitolo hero */}
          <label className={labelCls}>
            <span className={labelTextCls}>Sottotitolo hero <LangBadge /></span>
            <input type="text" value={content.heroSubtitle.it}
              onChange={(e) => setL10nField("heroSubtitle", "it", e.target.value)} className={inputCls} />
          </label>
          {/* Titolo racconto */}
          <label className={labelCls}>
            <span className={labelTextCls}>Titolo racconto <LangBadge /></span>
            <input type="text" value={content.storyTitle.it}
              onChange={(e) => setL10nField("storyTitle", "it", e.target.value)} className={inputCls} />
          </label>
        </div>

        {/* Paragrafi racconto */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">
              Paragrafi racconto <LangBadge />
              <span className="ml-2 text-foreground/40 normal-case font-normal">
                ({content.storyParagraphs.length}/{MAX_PARAGRAPHS})
              </span>
            </h3>
            {content.storyParagraphs.length < MAX_PARAGRAPHS && (
              <button
                onClick={addParagraph}
                className="rounded-full border border-gold/50 px-3 py-1 text-xs text-gold hover:bg-gold/10 transition"
              >
                + Aggiungi paragrafo
              </button>
            )}
          </div>
          {content.storyParagraphs.map((p, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <textarea
                rows={4}
                value={p.it}
                onChange={(e) => setParagraphIt(idx, e.target.value)}
                placeholder={`Paragrafo ${idx + 1}…`}
                className={`${inputCls} flex-1`}
              />
              {content.storyParagraphs.length > 1 && (
                <button
                  onClick={() => removeParagraph(idx)}
                  title="Rimuovi paragrafo"
                  className="mt-1 text-foreground/30 hover:text-red-500 transition text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Translate button */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleTranslateTexts}
            disabled={textsTranslateState === "translating"}
            className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
          >
            {textsTranslateState === "translating" ? "Traduzione in corso…" : "Traduci automaticamente"}
          </button>
          {textsTranslateState === "done" && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Tradotto</span>
          )}
          {textsTranslateState === "error" && (
            <span className="text-xs text-red-600">{textsTranslateError}</span>
          )}
          {textsTranslatePreview && (
            <button
              onClick={() => setShowTextsPreview((v) => !v)}
              className="text-xs text-foreground/50 underline"
            >
              {showTextsPreview ? "Nascondi" : "Vedi traduzioni (EN)"}
            </button>
          )}
        </div>

        {showTextsPreview && textsTranslatePreview && (
          <div className="rounded-lg border border-gold/20 bg-card p-4 space-y-3 text-sm">
            {Object.entries(textsTranslatePreview).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">{k}</p>
                <p className="mt-1 text-foreground/80">{v}</p>
              </div>
            ))}
          </div>
        )}

        <SaveButton saveState={saveState} onClick={handleSave} />
      </div>
    );
  }

  function renderArea() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        {/* Descrizione */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Descrizione area</h3>
          <label className={labelCls}>
            <span className={labelTextCls}>
              Descrizione <LangBadge />
            </span>
            <textarea
              rows={3}
              value={content.areaDescription.it}
              onChange={(e) => setL10nField("areaDescription", "it", e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleTranslateAreaDesc}
              disabled={areaDescTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {areaDescTranslateState === "translating" ? "Traduzione in corso…" : "Traduci"}
            </button>
            {areaDescTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Tradotto</span>
            )}
            {areaDescTranslateState === "error" && (
              <span className="text-xs text-red-600">{areaDescTranslateError}</span>
            )}
          </div>
        </div>

        {/* Coordinate */}
        <div className="rounded-lg border border-gold/30 bg-background p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">
            Coordinate appartamento
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelCls}>
              <FieldLabel>Latitudine</FieldLabel>
              <input
                type="number"
                step="any"
                value={content.mapLat}
                onChange={(e) => set("mapLat", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              <FieldLabel>Longitudine</FieldLabel>
              <input
                type="number"
                step="any"
                value={content.mapLng}
                onChange={(e) => set("mapLng", Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {/* Segnalibri mappa */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Segnalibri mappa (max 5)</h3>
          {content.mapBookmarks.map((bm, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm flex-1 min-w-24">
                <FieldLabel>Lat</FieldLabel>
                <input
                  type="number"
                  step="any"
                  value={bm.lat}
                  onChange={(e) => {
                    const updated: MapBookmark[] = content.mapBookmarks.map((b, j) =>
                      j === i ? { ...b, lat: Number(e.target.value) } : b
                    );
                    set("mapBookmarks", updated);
                  }}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm flex-1 min-w-24">
                <FieldLabel>Lng</FieldLabel>
                <input
                  type="number"
                  step="any"
                  value={bm.lng}
                  onChange={(e) => {
                    const updated: MapBookmark[] = content.mapBookmarks.map((b, j) =>
                      j === i ? { ...b, lng: Number(e.target.value) } : b
                    );
                    set("mapBookmarks", updated);
                  }}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm flex-1 min-w-40">
                <FieldLabel>Etichetta</FieldLabel>
                <input
                  type="text"
                  value={bm.label}
                  onChange={(e) => {
                    const updated: MapBookmark[] = content.mapBookmarks.map((b, j) =>
                      j === i ? { ...b, label: e.target.value } : b
                    );
                    set("mapBookmarks", updated);
                  }}
                  className={inputCls}
                />
              </label>
              <button
                onClick={() => set("mapBookmarks", content.mapBookmarks.filter((_, j) => j !== i))}
                className="text-xs text-red-500 hover:text-red-700 pb-2"
              >
                Rimuovi
              </button>
            </div>
          ))}
          {content.mapBookmarks.length < 5 && (
            <button
              onClick={() =>
                set("mapBookmarks", [...content.mapBookmarks, { lat: 0, lng: 0, label: "" }])
              }
              className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
            >
              Aggiungi segnalibro
            </button>
          )}
        </div>

        {/* Punti di interesse */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Punti di interesse</h3>
          {content.areaPlaces.map((place, i) => (
            <div key={i} className="rounded-lg border border-gold/20 bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    <span className={labelTextCls}>
                      Nome <LangBadge />
                    </span>
                    <input
                      type="text"
                      value={place.name.it}
                      onChange={(e) => {
                        const updated: AreaPlace[] = content.areaPlaces.map((p, j) =>
                          j === i ? { ...p, name: { ...p.name, it: e.target.value } } : p
                        );
                        set("areaPlaces", updated);
                      }}
                      className={inputCls}
                    />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>
                      Commento <LangBadge />
                    </span>
                    <input
                      type="text"
                      value={place.comment.it}
                      onChange={(e) => {
                        const updated: AreaPlace[] = content.areaPlaces.map((p, j) =>
                          j === i ? { ...p, comment: { ...p.comment, it: e.target.value } } : p
                        );
                        set("areaPlaces", updated);
                      }}
                      className={inputCls}
                    />
                  </label>
                </div>
                <button
                  onClick={() => set("areaPlaces", content.areaPlaces.filter((_, j) => j !== i))}
                  className="ml-3 text-xs text-red-500 hover:text-red-700 mt-6"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              set("areaPlaces", [
                ...content.areaPlaces,
                {
                  name: { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" },
                  comment: { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" },
                },
              ])
            }
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
          >
            Aggiungi punto
          </button>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={handleTranslatePlaces}
              disabled={placesTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {placesTranslateState === "translating" ? "Traduzione in corso…" : "Traduci punti di interesse"}
            </button>
            {placesTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Tradotto</span>
            )}
            {placesTranslateState === "error" && (
              <span className="text-xs text-red-600">{placesTranslateError}</span>
            )}
          </div>
        </div>

        <SaveButton saveState={saveState} onClick={handleSave} />
      </div>
    );
  }

  function renderServizi() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-2">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/50">
            Servizi
          </h3>
          {content.amenities.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={(item as L10n).it}
                onChange={(e) => {
                  const updated = content.amenities.map((a, j) =>
                    j === i ? { ...(a as L10n), it: e.target.value } : a
                  );
                  set("amenities", updated);
                }}
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={() => set("amenities", content.amenities.filter((_, j) => j !== i))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() =>
                set("amenities", [
                  ...content.amenities,
                  { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" },
                ])
              }
              className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
            >
              Aggiungi servizio
            </button>
            <button
              onClick={handleTranslateAmenities}
              disabled={amenitiesTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {amenitiesTranslateState === "translating" ? "Traduzione in corso…" : "Traduci servizi"}
            </button>
            {amenitiesTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Tradotto</span>
            )}
            {amenitiesTranslateState === "error" && (
              <span className="text-xs text-red-600">{amenitiesTranslateError}</span>
            )}
          </div>
        </div>
        <SaveButton saveState={saveState} onClick={handleSave} />
      </div>
    );
  }

  function renderRecensioni() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {content.reviews.map((review, i) => (
            <div key={i} className="rounded-lg border border-gold/30 bg-background p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <FieldLabel>Autore</FieldLabel>
                  <input
                    type="text"
                    value={review.author}
                    onChange={(e) => {
                      const updated: Review[] = content.reviews.map((r, j) =>
                        j === i ? { ...r, author: e.target.value } : r
                      );
                      set("reviews", updated);
                    }}
                    className={inputCls}
                  />
                </label>
                <button
                  onClick={() => set("reviews", content.reviews.filter((_, j) => j !== i))}
                  className="mt-5 text-xs text-red-500 hover:text-red-700"
                >
                  Elimina
                </button>
              </div>
              <label className={labelCls}>
                <span className={labelTextCls}>
                  Testo recensione <LangBadge />
                </span>
                <textarea
                  rows={4}
                  value={(review.text as L10n).it}
                  onChange={(e) => {
                    const updated: Review[] = content.reviews.map((r, j) =>
                      j === i ? { ...r, text: { ...(r.text as L10n), it: e.target.value } } : r
                    );
                    set("reviews", updated);
                  }}
                  className={inputCls}
                />
              </label>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() =>
                set("reviews", [
                  ...content.reviews,
                  { text: { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" }, author: "" },
                ])
              }
              className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
            >
              Aggiungi recensione
            </button>
            <button
              onClick={handleTranslateReviews}
              disabled={reviewsTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {reviewsTranslateState === "translating" ? "Traduzione in corso…" : "Traduci recensioni"}
            </button>
            {reviewsTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Tradotto</span>
            )}
            {reviewsTranslateState === "error" && (
              <span className="text-xs text-red-600">{reviewsTranslateError}</span>
            )}
          </div>
        </div>
        <SaveButton saveState={saveState} onClick={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Traduci tutto */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
        <button
          onClick={handleTranslateAll}
          disabled={allTranslateState === "translating"}
          className="rounded-full bg-gold px-5 py-1.5 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:opacity-90 disabled:opacity-50"
        >
          {allTranslateState === "translating" ? "Traduzione in corso…" : "Traduci tutto"}
        </button>
        <p className="text-xs text-foreground/50">
          Traduce automaticamente tutti i contenuti in 8 lingue con un solo clic, poi salva.
        </p>
        {allTranslateState === "done" && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
            Traduzione completata — ricordati di salvare.
          </span>
        )}
        {allTranslateState === "error" && (
          <span className="text-xs text-red-600">{allTranslateError}</span>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-6 border-b border-gold/20">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm transition ${
              activeTab === tab.id
                ? "border-b border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === "struttura" && renderStruttura()}

        {activeTab === "testi" && renderTesti()}
        {activeTab === "area" && renderArea()}
        {activeTab === "servizi" && renderServizi()}
        {activeTab === "recensioni" && renderRecensioni()}
      </div>
    </div>
  );
}
