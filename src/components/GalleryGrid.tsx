"use client";

import Image from "next/image";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

export default function GalleryGrid({ photos }: { photos: string[] }) {
  const { t, locale } = useLanguage();
  // Rete di sicurezza a runtime: nel caso normale l'elenco è già filtrato a
  // build-time (le immagini eliminate non arrivano qui), ma se un file
  // risultasse comunque non caricabile lo togliamo invece di lasciare il box.
  const [broken, setBroken] = useState<string[]>([]);
  const visible = photos.filter((src) => !broken.includes(src));

  return (
    <section className="px-6 py-16">
      <h1 className="font-serif-display mb-2 text-center text-3xl italic text-foreground">
        {t.gallery.title}
      </h1>
      <div className="mx-auto mb-10 max-w-xs">
        <Diamond />
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((src) => (
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
