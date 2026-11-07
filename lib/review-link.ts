import { setting } from "./config";
import { business } from "./business";

export function googleReviewUrl() {
  const value = setting("GOOGLE_REVIEW_URL", business.googleReviewUrl).trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const hosts = ["g.page", "maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "search.google.com", "maps.google.com", "www.google.co.nz", "maps.google.co.nz"];
    return url.protocol === "https:" && !url.username && !url.password && hosts.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
