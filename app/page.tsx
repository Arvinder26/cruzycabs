import type { Metadata } from "next";
import { KauriRideApp } from "./KauriRideApp";
import { setting } from "../lib/config";

export const metadata: Metadata = {
  title: "Book an Auckland ride",
  alternates: {canonical:"/"},
  description:
    "Upfront prices for Auckland rides, airport transfers, accessible travel and private North Island journeys. Guest booking available.",
};

export default function Home() {
  return <KauriRideApp onlinePricingAvailable={Boolean(setting("GOOGLE_MAPS_API_KEY"))} />;
}
