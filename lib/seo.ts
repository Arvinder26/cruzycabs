import type { Metadata } from "next";
import { setting } from "./config";
import { business } from "./business";

export function publicOrigin() {
  const url = new URL(setting("SITE_URL", "https://cruzycabs.co.nz"));
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("SEO SITE_URL must be the public HTTPS origin without credentials.");
  }
  return url.origin;
}

export function siteIndexable() {
  return setting("SITE_INDEXABLE", "true") !== "false" && !["preview", "development"].includes(setting("VERCEL_ENV"));
}

export function organizationData() {
  return { "@type": "Organization", "@id": `${publicOrigin()}/#organization`,
    name: business.name, url: publicOrigin(), logo: `${publicOrigin()}/images/cruzycabs-logo.png`,
    email: business.email, slogan: "Be choosy. Ride Cruzy.",
    areaServed: [
      { "@type": "City", name: "Auckland", containedInPlace: { "@type": "Country", name: "New Zealand" } },
      { "@type": "Place", name: "North Island, New Zealand" },
    ],
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: business.email, areaServed: "NZ", availableLanguage: "en" } };
}

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: path === "/" ? { absolute: `${title} | cruzycabs` } : title, description,
    alternates: { canonical: `${publicOrigin()}${path}` },
    openGraph: {
      type: "website", locale: "en_NZ", siteName: "cruzycabs",
      title: `${title} | cruzycabs`, description, url: `${publicOrigin()}${path}`,
      images: [{ url: "/og.png", width: 1733, height: 909, alt: "cruzycabs Auckland rides and North Island travel" }],
    },
    twitter: { card: "summary_large_image", title: `${title} | cruzycabs`, description, images: ["/og.png"] },
  };
}

export const serviceTitles: Record<string, string> = {
  "airport-transfers": "Auckland Airport Transfers",
  "auckland-rides": "Auckland Rides & Scheduled Transport",
  "north-island-transfers": "Private North Island Transfers from Auckland",
  "private-tours": "Private North Island Tours from Auckland",
  "accessible-travel": "Wheelchair Accessible Transport in Auckland",
  "business-travel": "Corporate Transport & Business Travel in Auckland",
  "cruise-transfers": "Auckland Cruise Terminal Transfers",
  "hourly-van-hire": "Auckland Private Driver & Hourly Van Hire",
  pricing: "Auckland Ride Prices & Fare Estimates",
};
