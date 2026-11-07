export const publicSlugs = [
  "airport-transfers", "auckland-rides", "north-island-transfers", "private-tours",
  "accessible-travel", "business-travel", "cruise-transfers", "hourly-van-hire",
  "pricing", "safety", "help", "lost-property", "complaints", "privacy", "terms",
  "accessibility-statement", "driver-application", "partner-fleet-application",
] as const;

// Existing useful destinations keep their URLs. Only duplicate aliases redirect.
export const pageAliases: Record<string, string> = {
  "local-auckland-taxis": "auckland-rides", "fare-estimate": "pricing",
  "how-pricing-works": "pricing", contact: "help", "telephone-booking": "help",
  "total-mobility": "accessible-travel", "family-and-child-seat-travel": "auckland-rides",
  "pet-friendly-rides": "auckland-rides", "corporate-accounts": "business-travel",
  "vehicle-options": "auckland-rides", "service-areas": "auckland-rides",
  "about-cruzycabs": "safety", "about-kauri-ride": "safety",
  "cancellation-and-refund-policy": "terms", "conditions-of-carriage": "terms",
  "cookie-settings": "privacy",
};
