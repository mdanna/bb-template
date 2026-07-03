import rawPolicies from "@/data/policies.json";

export interface Policies {
  airbnbIcalUrl: string;
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
