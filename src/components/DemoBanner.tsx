import { DEMO_MODE } from "@/lib/demo";

// Barra fissa in cima all'istanza demo (pubblico + admin).
export default function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div className="w-full bg-gold px-4 py-1.5 text-center text-xs text-[#faf6ec]">
      Modalità demo · le modifiche non vengono salvate ·{" "}
      <a href="mailto:info@dimorasuite.com?subject=Vorrei%20un%20sito%20Dimora%20Suite" className="underline">
        Richiedi il tuo sito
      </a>
    </div>
  );
}
