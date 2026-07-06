import rawPolicies from "@/data/policies.json";
import type { OtaPlatform } from "@/data/availability";

export type CalendarUrls = Record<OtaPlatform, string>; // { airbnb, booking, vrbo }

export interface Policies {
  airbnbIcalUrl?: string; // legacy: singolo URL Airbnb (letto come calendars.airbnb)
  calendars?: Partial<CalendarUrls>;
  // Prenotazione esterna (bottone pubblico "Prenota su…"): URL degli annunci sulle
  // OTA + piattaforma di default. `airbnbUrl` legge in fallback il vecchio
  // `content.airbnbUrl` finché non viene salvato qui (vedi bookingLinks.ts).
  airbnbUrl?: string;
  bookingUrl?: string;
  vrboUrl?: string;
  defaultBookingPlatform?: OtaPlatform;
  cityTaxPerPersonPerNight: number;
  cityTaxMaxNights: number;
  defaultDepositRate: number;
  minDepositRate: number;
  balanceDueDays: number;
  cancelFullRefundDays: number;
  cancelHalfRefundDays: number;
  cancelPartialRefundPct: number;
  cancelFeePercent: number;
  minAdvanceBookingDays: number;
  minNights: number;
  maxNights: number;
  maxGuests: number;
  balanceReminderDaysFirst: number;
  balanceReminderDaysSecond: number;
  checkinTime: string;
  checkoutTime: string;
  // Lingua del pannello di amministrazione: scelta in configurazione, modificabile
  // in Impostazioni. Default "it". (Il sito pubblico resta multilingua a parte.)
  adminLocale?: "it" | "en" | "es" | "fr";
}

export const POLICIES: Policies = rawPolicies as Policies;

export const ADMIN_LOCALES = ["it", "en", "es", "fr"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];

/** Lingua del pannello admin dalle policy, con default "it". */
export function resolveAdminLocale(): AdminLocale {
  const l = POLICIES.adminLocale;
  return l && (ADMIN_LOCALES as readonly string[]).includes(l) ? (l as AdminLocale) : "it";
}

// Risolve i 3 URL iCal dalle policy, con retrocompat dal vecchio `airbnbIcalUrl`.
export function calendarUrlsFromPolicies(p: Pick<Policies, "airbnbIcalUrl" | "calendars">): CalendarUrls {
  const c = p.calendars ?? {};
  return {
    airbnb: (c.airbnb ?? p.airbnbIcalUrl ?? "").trim(),
    booking: (c.booking ?? "").trim(),
    vrbo: (c.vrbo ?? "").trim(),
  };
}
