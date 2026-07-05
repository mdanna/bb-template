import { CONTENT } from "@/lib/siteContent";
import { POLICIES } from "@/lib/policies";
import type { OtaPlatform } from "@/data/availability";

const PLATFORM_NAME: Record<OtaPlatform, string> = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo" };

export interface BookingLink {
  platform: OtaPlatform;
  url: string;
  name: string;
}

// Risolve il bottone "Prenota su…" pubblico: la piattaforma di default (con URL
// impostato) come `primary`, le altre configurate come `others` (per i link "anche su").
// L'URL Airbnb viene da content.json; Booking/Vrbo dalle policy (Impostazioni).
export function getBookingLinks(): { primary: BookingLink | null; others: BookingLink[] } {
  const urls: Record<OtaPlatform, string> = {
    airbnb: (CONTENT.airbnbUrl ?? "").trim(),
    booking: (POLICIES.bookingUrl ?? "").trim(),
    vrbo: (POLICIES.vrboUrl ?? "").trim(),
  };
  const order: OtaPlatform[] = ["airbnb", "booking", "vrbo"];
  const def = POLICIES.defaultBookingPlatform ?? "airbnb";
  const primaryPlatform: OtaPlatform | null = urls[def] ? def : (order.find((p) => urls[p]) ?? null);
  const primary: BookingLink | null = primaryPlatform
    ? { platform: primaryPlatform, url: urls[primaryPlatform], name: PLATFORM_NAME[primaryPlatform] }
    : null;
  const others: BookingLink[] = order
    .filter((p) => p !== primaryPlatform && urls[p])
    .map((p) => ({ platform: p, url: urls[p], name: PLATFORM_NAME[p] }));
  return { primary, others };
}
