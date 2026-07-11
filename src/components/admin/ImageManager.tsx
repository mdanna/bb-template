"use client";

import { useEffect, useState, useRef } from "react";
import type { SiteContent } from "@/lib/siteContent";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

interface ImageFile {
  name: string;
  sha: string;
  url?: string; // in demo: data URL effimero dell'immagine caricata (non persiste)
}

type UploadState = "idle" | "uploading" | "success" | "error";
type SaveState = "idle" | "saving" | "success" | "error";

const MAX_GALLERY = 12;

export default function ImageManager() {
  const { t } = useAdminLanguage();
  const ti = t.images;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [heroImage, setHeroImage] = useState<string>("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [fullContent, setFullContent] = useState<SiteContent | null>(null);

  const [selectionDirty, setSelectionDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox: click sulla miniatura ingrandisce, click sull'ingrandita chiude.
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  async function loadImages() {
    const res = await fetch("/api/admin/images");
    const data = await res.json() as { files?: ImageFile[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? t.common.error);
    setImages(data.files ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/images").then((r) => r.json() as Promise<{ files?: ImageFile[]; error?: string }>),
      fetch("/api/admin/content").then((r) => r.json() as Promise<SiteContent>),
    ])
      .then(([imgData, contentData]) => {
        if (cancelled) return;
        setImages(imgData.files ?? []);
        setHeroImage(contentData.heroImage ?? "");
        setGalleryImages(contentData.galleryImages ?? []);
        setFullContent(contentData);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t.common.error);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleHero(name: string) {
    setHeroImage((prev) => (prev === name ? "" : name));
    setSelectionDirty(true);
    setSaveState("idle");
  }

  function toggleGallery(name: string) {
    setGalleryImages((prev) => {
      const inGallery = prev.includes(name);
      if (inGallery) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_GALLERY) return prev;
      return [...prev, name];
    });
    setSelectionDirty(true);
    setSaveState("idle");
  }

  function moveGallery(name: string, dir: -1 | 1) {
    setGalleryImages((prev) => {
      const i = prev.indexOf(name);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelectionDirty(true);
    setSaveState("idle");
  }

  async function handleSaveSelection() {
    if (!fullContent) return;
    setSaveState("saving");
    try {
      const body: SiteContent = { ...fullContent, heroImage, galleryImages };
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; commitSha?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setFullContent(body);
      setSaveState("success");
      if (data.commitSha) setDeploySha(data.commitSha);
      setSelectionDirty(false);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    setUploadError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(t.common.error));
        reader.readAsDataURL(file);
      });
      if (DEMO) {
        // Anteprima effimera: l'immagine appare subito ma non viene salvata
        // (nessuna scrittura su GitHub). Persa al refresh — coerente con la demo.
        const name = images.some((i) => i.name === file.name) ? `${Date.now()}-${file.name}` : file.name;
        setImages((prev) => [...prev, { name, sha: "demo", url: dataUrl }]);
        setUploadState("success");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setUploadState("idle"), 4000);
        return;
      }
      const base64 = dataUrl.split(",")[1] ?? "";
      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, base64, mimeType: file.type }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setUploadState("success");
      await loadImages();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadState("idle"), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.common.error);
      setUploadState("error");
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`${ti.delete} "${name}"?`)) return;
    if (DEMO) {
      setImages((prev) => prev.filter((i) => i.name !== name));
      if (heroImage === name) { setHeroImage(""); setSelectionDirty(true); }
      if (galleryImages.includes(name)) { setGalleryImages((prev) => prev.filter((n) => n !== name)); setSelectionDirty(true); }
      return;
    }
    setDeletingName(name);
    try {
      const res = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; contentUpdated?: boolean; commitSha?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      // Il server ha già rimosso i riferimenti da content.json: allinea lo stato
      // locale (hero, galleria e fullContent) senza marcare la selezione come
      // "da salvare" — non c'è nulla di pendente da salvare per questa delete.
      if (heroImage === name) setHeroImage("");
      if (galleryImages.includes(name)) setGalleryImages((prev) => prev.filter((n) => n !== name));
      setFullContent((prev) => prev ? {
        ...prev,
        heroImage: prev.heroImage === name ? "" : prev.heroImage,
        galleryImages: prev.galleryImages.filter((n) => n !== name),
      } : prev);
      if (data.commitSha) setDeploySha(data.commitSha);
      await loadImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDeletingName(null);
    }
  }

  const srcOf = (img: ImageFile) => img.url ?? `/images/${img.name}`;
  // Ordine di visualizzazione: prima le immagini in galleria (nel loro ordine, così
  // le frecce ◀▶ le spostano visibilmente), poi le altre nell'ordine dei file.
  const orderedImages: ImageFile[] = [
    ...galleryImages.map((n) => images.find((i) => i.name === n)).filter((i): i is ImageFile => !!i),
    ...images.filter((i) => !galleryImages.includes(i.name)),
  ];

  return (
    <div className="space-y-6">
      {/* Carica immagine: prima delle immagini (come il pannello portale) */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState === "uploading"}
          className="rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50"
        >
          {uploadState === "uploading" ? ti.uploading : ti.upload}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        {uploadState === "success" && <span className="text-xs text-green-700">{DEMO ? t.common.demoImage : t.common.success}</span>}
        {uploadState === "error" && <span className="text-xs text-red-600">{uploadError}</span>}
        {!loading && (
          <span className="ml-auto text-xs text-foreground/45">{ti.legend}</span>
        )}
      </div>

      {/* Libreria immagini: griglia con controlli nel footer (hero/galleria + ordina/elimina) */}
      {loading ? (
        <p className="text-sm text-foreground/60">{t.common.loading}</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-foreground/50">{ti.noImages}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {orderedImages.map((img) => {
            const isHero = heroImage === img.name;
            const inGallery = galleryImages.includes(img.name);
            const galleryFull = galleryImages.length >= MAX_GALLERY && !inGallery;
            const gi = galleryImages.indexOf(img.name);
            const src = srcOf(img);
            return (
              <div key={img.name} className={`overflow-hidden rounded-lg border ${isHero || inGallery ? "border-gold/50" : "border-gold/20"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={img.name}
                  onClick={() => setZoomSrc(src)}
                  className="h-36 w-full cursor-zoom-in object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="flex items-center justify-between gap-1 bg-card/60 px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleHero(img.name)}
                      title={ti.hero}
                      className={`rounded border px-1.5 text-base leading-none transition ${isHero ? "border-gold/50 text-yellow-400" : "border-gold/30 text-foreground/50 hover:text-yellow-400"}`}
                    >
                      {isHero ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => toggleGallery(img.name)}
                      disabled={galleryFull}
                      title={galleryFull ? `Max ${MAX_GALLERY}` : ti.gallery}
                      className={`rounded border px-1.5 text-sm leading-none transition disabled:opacity-30 ${inGallery ? "border-gold/50 text-gold" : "border-gold/30 text-foreground/50 hover:text-gold"}`}
                    >
                      {inGallery ? "▦" : "▢"}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {inGallery && (
                      <button onClick={() => moveGallery(img.name, -1)} disabled={gi === 0} aria-label={ti.moveLeft} className="rounded border border-gold/40 px-1.5 text-xs text-foreground/70 transition hover:bg-gold/15 hover:text-gold disabled:border-gold/10 disabled:text-foreground/20 disabled:hover:bg-transparent disabled:cursor-not-allowed">◀</button>
                    )}
                    <button onClick={() => handleDelete(img.name)} disabled={deletingName === img.name} aria-label={ti.delete} className="rounded border border-gold/30 px-1.5 text-xs text-foreground/60 disabled:opacity-40 hover:border-red-400 hover:text-red-600">✕</button>
                    {inGallery && (
                      <button onClick={() => moveGallery(img.name, 1)} disabled={gi === galleryImages.length - 1} aria-label={ti.moveRight} className="rounded border border-gold/40 px-1.5 text-xs text-foreground/70 transition hover:bg-gold/15 hover:text-gold disabled:border-gold/10 disabled:text-foreground/20 disabled:hover:bg-transparent disabled:cursor-not-allowed">▶</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Salvataggio della selezione (hero + galleria + ordine) */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSaveSelection}
          disabled={saveState === "saving" || !selectionDirty}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-40"
        >
          {saveState === "saving" ? t.contents.saving : t.contents.save}
        </button>
        {saveState === "success" && <span className="text-sm text-green-600">{DEMO ? t.common.demoSaved : t.contents.saved}</span>}
        {saveState === "error" && <span className="text-sm text-red-600">{t.common.error}</span>}
      </div>

      <DeployToast sha={deploySha} onDone={() => setDeploySha(null)} />

      {/* Lightbox */}
      {zoomSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoomSrc(null)} role="dialog" aria-label={ti.gallery}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomSrc} alt="" className="max-h-[90vh] max-w-[90vw] cursor-zoom-out object-contain" />
        </div>
      )}
    </div>
  );
}
