import { POLICIES } from "@/lib/policies";
import { listingUrls } from "@/lib/bookingLinks";
import PrenotaClient from "./PrenotaClient";

export default function PrenotaPage() {
  return (
    <PrenotaClient
      airbnbUrl={listingUrls().airbnb}
      minAdvanceDays={POLICIES.minAdvanceBookingDays}
    />
  );
}
