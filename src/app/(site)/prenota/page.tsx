import { CONTENT } from "@/lib/siteContent";
import { POLICIES } from "@/lib/policies";
import PrenotaClient from "./PrenotaClient";

export default function PrenotaPage() {
  return (
    <PrenotaClient
      airbnbUrl={CONTENT.airbnbUrl}
      airbnbRating={CONTENT.airbnbRating}
      minAdvanceDays={POLICIES.minAdvanceBookingDays}
    />
  );
}
