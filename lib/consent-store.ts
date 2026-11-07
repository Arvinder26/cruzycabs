"use client";

import { CONSENT_EVENT, CONSENT_MAX_AGE, SETTINGS_EVENT, consentCookie, isAnalyticsCookie, readConsent, type ConsentChoice } from "./cookie-consent";

let memory: { choice: ConsentChoice; saved: number } | null = null;

export function consentSnapshot(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const saved = readConsent(document.cookie);
  if (saved) return saved;
  return memory && Date.now() - memory.saved < CONSENT_MAX_AGE * 1000 ? memory.choice : null;
}
export function serverConsentSnapshot() { return null; }

export function subscribeToConsent(callback: () => void) {
  const changed = () => callback();
  const focus = () => { memory = null; callback(); };
  window.addEventListener(CONSENT_EVENT, changed);
  window.addEventListener("focus", focus);
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cruzycabs-cookie-consent") : null;
  if (channel) channel.onmessage = () => { memory = null; callback(); };
  return () => { window.removeEventListener(CONSENT_EVENT, changed); window.removeEventListener("focus", focus); channel?.close(); };
}

export function clearAnalyticsCookies() {
  const names = document.cookie.split(";").map(cookie => cookie.trim().split("=")[0]).filter(isAnalyticsCookie);
  const domains = new Set(["", window.location.hostname, `.${window.location.hostname}`]);
  const labels = window.location.hostname.split(".");
  for (let index = 1; index < labels.length - 1; index++) {
    domains.add(labels.slice(index).join("."));
    domains.add(`.${labels.slice(index).join(".")}`);
  }
  for (const name of names) for (const domain of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}${window.location.protocol === "https:" ? "; Secure" : ""}; SameSite=Lax`;
  }
}

export function saveConsent(choice: ConsentChoice) {
  memory = { choice, saved: Date.now() };
  document.cookie = consentCookie(choice, window.location.protocol === "https:", memory.saved);
  if (choice === "denied") clearAnalyticsCookies();
  window.dispatchEvent(new Event(CONSENT_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("cruzycabs-cookie-consent");
    channel.postMessage("changed");
    channel.close();
  }
}

export function openCookieSettings() { window.dispatchEvent(new Event(SETTINGS_EVENT)); }
