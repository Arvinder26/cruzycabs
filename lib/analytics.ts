import { publicSlugs } from "./public-routes";

// This is a public measurement ID, supplied by the owner, not a credential.
export const GA_MEASUREMENT_ID = "G-1RCJ5G2SKB";
export const ANALYTICS_FRAME_PATH = "/analytics-frame";

export function isAnalyticsPage(path: string) {
  return path === "/" || publicSlugs.some(slug => path === `/${slug}`);
}

// Retain the external referring site, never a URL path, search term or token.
export function analyticsReferrer(value: string, origin: string) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.origin === new URL(origin).origin || url.username || url.password) return "";
    return url.origin;
  } catch { return ""; }
}

// Google Ads click identifiers: random, non-personal tokens Google adds to ad clicks.
export const AD_CLICK_PARAMS = ["gclid", "gbraid", "wbraid"] as const;
const AD_CLICK_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function adClickParams(search: string) {
  const source = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const name of AD_CLICK_PARAMS) {
    const value = source.get(name);
    if (value && AD_CLICK_ID.test(value)) kept.set(name, value);
  }
  return kept;
}

export function analyticsFramePath(path: string, referrer: string, origin: string, search = "") {
  if (!isAnalyticsPage(path)) return null;
  const query = new URLSearchParams({ page: path });
  const safeReferrer = analyticsReferrer(referrer, origin);
  if (safeReferrer) query.set("referrer", safeReferrer);
  for (const [name, value] of adClickParams(search)) query.set(name, value);
  return `${ANALYTICS_FRAME_PATH}?${query}`;
}

export const GOOGLE_ADS_ID = /^AW-\d{6,15}$/;
export const GOOGLE_ADS_LABEL = /^[A-Za-z0-9_-]{4,64}$/;

// Booking-request conversion: sends only the quoted NZD value, never the reference or passenger details.
export function bookingConversionFramePath(priceCents: number) {
  const value = Number.isFinite(priceCents) && priceCents > 0 ? (Math.round(priceCents) / 100).toFixed(2) : "0";
  return `${ANALYTICS_FRAME_PATH}?${new URLSearchParams({ conversion: "booking", value })}`;
}
