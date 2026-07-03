"use client";

import { useEffect, useState, useRef } from "react";
import type { SiteContent } from "@/lib/siteContent";

interface ImageFile {
  name: string;
  sha: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";
type SaveState = "idle" | "saving" | "success" | "error";

const MAX_GALLERY = 12;

export default function ImageManager() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [heroImage, setHeroImage] = useState<string>("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [fullContent, setFullContent] = useState<SiteContent | null>(null);

  const [selectionDirty, setSelectionDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadImages() {
    const res = await fetch("/api/admin/images");
    const data = await res.json() as { files?: ImageFile[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Errore");
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
          setLoadError("Errore nel caricamento");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  function toggleHero(name: string) {
    setHeroImage(name);
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Errore");
      setFullContent(body);
      setSaveState("success");
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
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = () => reject(new Error("Lettura file fallita"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, base64, mimeType: file.type }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload fallito");
      setUploadState("success");
      await loadImages();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadState("idle"), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Errore upload");
      setUploadState("error");
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Eliminare l'immagine "${name}"?`)) return;
    setDeletingName(name);
    try {
      const res = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Errore");
      // Also remove from hero/gallery if it was selected
      if (heroImage === name) { setHeroImage(""); setSelectionDirty(true); }
      if (galleryImages.includes(name)) { setGalleryImages((prev) => prev.filter((n) => n !== name)); setSelectionDirty(true); }
      await loadImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore eliminazione");
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-foreground/50 italic">
        Le immagini caricate saranno disponibili automaticamente in 1–2 minuti.
      </p>

      {/* Section 1 — Libreria immagini */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground/80">
            Libreria immagini
            {!loading && (
              <span className="ml-2 text-xs text-foreground/40">
                Galleria ({galleryImages.length}/{MAX_GALLERY})
              </span>
            )}
          </h3>
          {selectionDirty && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSelection}
                disabled={saveState === "saving"}
                className="rounded-full bg-gold px-5 py-1.5 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:opacity-90 disabled:opacity-50"
              >
                {saveState === "saving" ? "Salvataggio…" : "Salva selezione"}
              </button>
              {saveState === "success" && (
                <span className="text-xs text-green-600">Salvato.</span>
              )}
              {saveState === "error" && (
                <span className="text-xs text-red-600">Errore nel salvataggio.</span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-foreground/60">Caricamento immagini…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : images.length === 0 ? (
          <p className="text-sm text-foreground/50">Nessuna immagine trovata.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img) => {
              const isHero = heroImage === img.name;
              const inGallery = galleryImages.includes(img.name);
              const galleryFull = galleryImages.length >= MAX_GALLERY && !inGallery;
              return (
                <div
                  key={img.name}
                  className="rounded-lg border border-gold/30 bg-card overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/${img.name}`}
                    alt={img.name}
                    className="h-28 w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="p-2 space-y-1.5">
                    <p className="truncate text-[11px] text-foreground/60" title={img.name}>
                      {img.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {/* Hero toggle */}
                      <button
                        onClick={() => toggleHero(img.name)}
                        title="Imposta come copertina"
                        className={`text-base leading-none transition ${isHero ? "text-yellow-500" : "text-foreground/30 hover:text-yellow-400"}`}
                      >
                        {isHero ? "★" : "☆"}
                      </button>
                      {/* Gallery checkbox */}
                      <label
                        className={`flex items-center gap-1 text-[11px] cursor-pointer ${galleryFull ? "opacity-40 cursor-not-allowed" : ""}`}
                        title={galleryFull ? `Galleria piena (max ${MAX_GALLERY})` : "Includi in galleria"}
                      >
                        <input
                          type="checkbox"
                          checked={inGallery}
                          disabled={galleryFull}
                          onChange={() => toggleGallery(img.name)}
                          className="accent-gold"
                        />
                        <span className="text-foreground/60">Galleria</span>
                      </label>
                    </div>
                    <button
                      onClick={() => handleDelete(img.name)}
                      disabled={deletingName === img.name}
                      className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingName === img.name ? "Eliminazione…" : "Elimina"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2 — Carica nuova immagine */}
      <div className="rounded-lg border border-gold/40 bg-background p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground/80">Carica nuova immagine</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploadState === "uploading"}
          className="block text-sm text-foreground/70 file:mr-4 file:rounded-full file:border file:border-gold/40 file:bg-gold/10 file:px-4 file:py-1.5 file:text-xs file:uppercase file:tracking-widest file:text-gold hover:file:bg-gold/20 disabled:opacity-50"
        />
        {uploadState === "uploading" && (
          <p className="text-xs text-foreground/60">Caricamento in corso…</p>
        )}
        {uploadState === "success" && (
          <p className="text-xs text-green-700">Immagine caricata con successo.</p>
        )}
        {uploadState === "error" && (
          <p className="text-xs text-red-600">{uploadError}</p>
        )}
      </div>
    </div>
  );
}
