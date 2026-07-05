import rawPolicies from "@/data/policies.json";
import type { OtaPlatform } from "@/data/availability";

export type CalendarUrls = Record<OtaPlatform, string>; // { airbnb, booking, vrbo }

export interface Policies {
  airbnbIcalUrl?: string; // legacy: singolo URL Airbnb (letto come calendars.airbnb)
  calendars?: Partial<CalendarUrls>;
  // Prenotazione esterna (bottone pubblico "Prenota su…"). L'URL annuncio Airbnb
  // resta in content.json (`airbnbUrl`); qui le altre piattaforme + il default.
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
}

export const POLICIES: Policies = rawPolicies as Policies;

// Risolve i 3 URL iCal dalle policy, con retrocompat dal vecchio `airbnbIcalUrl`.
export function calendarUrlsFromPolicies(p: Pick<Policies, "airbnbIcalUrl" | "calendars">): CalendarUrls {
  const c = p.calendars ?? {};
  return {
    airbnb: (c.airbnb ?? p.airbnbIcalUrl ?? "").trim(),
    booking: (c.booking ?? "").trim(),
    vrbo: (c.vrbo ?? "").trim(),
  };
}
