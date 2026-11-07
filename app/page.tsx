import type { Metadata } from "next";
import { pageMetadata, publicOrigin, organizationData } from "../lib/seo";
import { StructuredData } from "./StructuredData";
import { KauriRideApp } from "./KauriRideApp";
import { setting,databaseConfigured,bookingsEnabled,onlineVehicleClasses } from "../lib/config";

export const metadata: Metadata = pageMetadata(
  "Auckland Rides, Airport Transfers & Private Tours",
  "Book Auckland rides and airport transfers with upfront NZD prices. Request accessible transport, business travel and private North Island tours.",
  "/",
);

export default function Home() {
  return <><StructuredData data={{
    "@context": "https://schema.org", "@graph": [
      organizationData(),
      { "@type": "WebSite", "@id": `${publicOrigin()}/#website`, name: "cruzycabs", url: publicOrigin(), inLanguage: "en-NZ", publisher: { "@id": `${publicOrigin()}/#organization` } },
    ],
  }} /><KauriRideApp onlinePricingAvailable={bookingsEnabled()&&databaseConfigured()&&Boolean(setting("GOOGLE_MAPS_API_KEY"))} requestSubmissionAvailable={databaseConfigured()} vansOnly={!onlineVehicleClasses().includes("accessible")} /></>;
}
