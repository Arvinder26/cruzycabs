import type { Metadata } from "next";
import { BookingThankYou } from "../BookingThankYou";
import { googleReviewUrl } from "../../lib/review-link";
import { analyticsEnabled } from "../../lib/analytics-config";
import { GOOGLE_ADS_ID, GOOGLE_ADS_LABEL } from "../../lib/analytics";
import { setting } from "../../lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thank you for choosing cruzycabs", robots: { index: false, follow: false } };

export default function ThankYouPage() {
  const adsConversion = analyticsEnabled() && GOOGLE_ADS_ID.test(setting("GOOGLE_ADS_ID", "").trim()) && GOOGLE_ADS_LABEL.test(setting("GOOGLE_ADS_BOOKING_LABEL", "").trim());
  return <BookingThankYou googleReviewUrl={googleReviewUrl()} adsConversion={adsConversion} />;
}
