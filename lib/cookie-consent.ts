export const CONSENT_COOKIE = "cc_cookie_consent";
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;
// Browser consent timestamps and hosted server clocks can differ slightly.
// This tolerance applies only to an explicit cookie choice, never authentication.
export const CONSENT_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const CONSENT_EVENT = "cruzycabs:cookie-consent";
export const SETTINGS_EVENT = "cruzycabs:cookie-settings";
export type ConsentChoice = "granted" | "denied";

export function readConsent(cookies: string, now = Date.now()): ConsentChoice | null {
  const value = cookies.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  const match = value?.match(/^v2\.(granted|denied)\.(\d{13})$/);
  if (!match) return null;
  const saved = Number(match[2]);
  return saved <= now + CONSENT_CLOCK_SKEW_MS && now - saved < CONSENT_MAX_AGE * 1000 ? match[1] as ConsentChoice : null;
}

export function consentCookie(choice: ConsentChoice, secure: boolean, now = Date.now()) {
  return `${CONSENT_COOKIE}=v2.${choice}.${now}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function isAnalyticsCookie(name: string) {
  return /^_ga(?:_|$)/.test(name) || /^_gcl_/.test(name) || /^_gid$/.test(name) || /^_gat(?:_|$)/.test(name);
}
