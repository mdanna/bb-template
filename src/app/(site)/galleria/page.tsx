"use client";

import Image from "next/image";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

const galleryPhotos = CONTENT.galleryImages.map((img) => `/images/${img}`);

export default function GalleriaPage() {
  const { t, locale } = useLanguage();
  // Un'immagine referenziata ma eliminata va in 404: la nascondiamo del tutto
  // invece di lasciare il riquadro vuoto col bordo.
  const [broken, setBroken] = useState<string[]>([]);
  const photos = galleryPhotos.filter((src) => !broken.includes(src));

  return (
    <section className="px-6 py-16">
      <h1 className="font-serif-display mb-2 text-center text-3xl italic text-foreground">
        {t.gallery.title}
      </h1>
      <div className="mx-auto mb-10 max-w-xs">
        <Diamond />
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((src) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-md border border-gold/40">
            <Image
              src={src}
              alt={CONTENT.siteTitle[locale] || CONTENT.siteTitle.it}
              fill
              className="object-cover"
              onError={() => setBroken((b) => (b.includes(src) ? b : [...b, src]))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
