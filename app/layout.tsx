import type { Metadata } from "next";
import { setting } from "../lib/config";
import "./globals.css";
import { SiteFooter } from "./SiteFooter";
import { MotionObserver } from "./MotionObserver";
import { OfflineSupport } from "./OfflineSupport";

export async function generateMetadata(): Promise<Metadata> {
  const origin = setting("SITE_URL","https://cruzycabs.co.nz");
  return {
    metadataBase: new URL(origin),
    title: {
      default: "cruzycabs | Be choosy. Ride Cruzy.",
      template: "%s | cruzycabs",
    },
    description:
      "Book Auckland rides, airport transfers and private North Island journeys with upfront prices and guest booking.",
    manifest: "/manifest.webmanifest",
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
      <body><MotionObserver /><OfflineSupport />{children}<SiteFooter /></body>
    </html>
  );
}
