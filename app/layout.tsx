import type { Metadata } from "next";
import { setting } from "../lib/config";
import { publicOrigin, siteIndexable } from "../lib/seo";
import "./globals.css";
import { SiteFooter } from "./SiteFooter";
import { MotionObserver } from "./MotionObserver";
import { OfflineSupport } from "./OfflineSupport";
import { Suspense } from "react";
import { CookieConsent } from "./CookieConsent";
import { analyticsEnabled } from "../lib/analytics-config";

export async function generateMetadata(): Promise<Metadata> {
  const origin = publicOrigin();
  return {
    metadataBase: new URL(origin),
    title: {
      default: "Auckland Rides, Airport Transfers & Private Tours | cruzycabs",
      template: "%s | cruzycabs",
    },
    description:
      "Book Auckland rides, airport transfers and private North Island journeys with upfront prices and guest booking.",
    manifest: "/manifest.webmanifest",
    // Public Search Console token for the https://cruzycabs.co.nz/ URL-prefix property (not a secret).
    verification: { google: setting("GOOGLE_SITE_VERIFICATION", "AmLleHrarLRPTcHz9B8c1HDaX0ffLEqFUCHSp_bEzv8") || undefined },
    ...(!siteIndexable() ? { robots: { index: false, follow: false } } : {}),
    icons: {icon:"/icon.svg",apple:"/app-icon-192.png"},
    openGraph: {
      type: "website",
      siteName: "cruzycabs",
      title: "cruzycabs | Be choosy. Ride Cruzy.",
      description: "Upfront pricing for Auckland rides and private North Island journeys.",
      ...(origin ? { images: [{ url: `${origin}/og.png`, width: 1733, height: 909, alt: "cruzycabs | Be choosy. Ride Cruzy." }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: "cruzycabs | Be choosy. Ride Cruzy.",
      description: "Upfront pricing for Auckland rides and private North Island journeys.",
      ...(origin ? { images: [`${origin}/og.png`] } : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NZ">
      <body><MotionObserver /><OfflineSupport />{children}<SiteFooter /><Suspense fallback={null}><CookieConsent analyticsEnabled={analyticsEnabled()} /></Suspense></body>
    </html>
  );
}
