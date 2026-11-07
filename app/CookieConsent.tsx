"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { analyticsFramePath } from "../lib/analytics";
import { SETTINGS_EVENT, type ConsentChoice } from "../lib/cookie-consent";
import { clearAnalyticsCookies, consentSnapshot, saveConsent, serverConsentSnapshot, subscribeToConsent } from "../lib/consent-store";

export function CookieConsent({ analyticsEnabled }: { analyticsEnabled: boolean }) {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeToConsent, consentSnapshot, serverConsentSnapshot);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsSelected, setAnalyticsSelected] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    const open = () => { setAnalyticsSelected(consentSnapshot() === "granted"); setSettingsOpen(true); };
    window.addEventListener(SETTINGS_EVENT, open);
    if (consentSnapshot() !== "granted") clearAnalyticsCookies();
    return () => { clearTimeout(timer); window.removeEventListener(SETTINGS_EVENT, open); };
  }, []);
  useEffect(() => {
    if (settingsOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settingsOpen]);

  function choose(choice: ConsentChoice) {
    saveConsent(choice);
    setSettingsOpen(false);
  }
  const frameSrc = ready && analyticsEnabled && consent === "granted" && pathname
    ? analyticsFramePath(pathname, document.referrer, window.location.origin, window.location.search) : null;

  return <>
    {frameSrc && <iframe key={pathname} src={frameSrc} className="analytics-frame" data-analytics-frame title="Website analytics" aria-hidden="true" tabIndex={-1} referrerPolicy="no-referrer" />}
    {ready && consent === null && !settingsOpen && <section className="cookie-banner" aria-labelledby="cookie-banner-heading">
      <div><h2 id="cookie-banner-heading">Your cookie choice</h2><p>We use essential cookies to keep bookings and sign-in working. With your permission, Google Analytics helps us understand visits to our public pages, and Google Ads measures which of our ads lead to booking requests. You can decline and still use the website.</p><Link href="/privacy#cookies">Read about cookies</Link></div>
      <div className="cookie-banner-actions"><button className="button button-ghost" type="button" onClick={() => choose("granted")}>Accept analytics & ads measurement</button><button className="button button-ghost" type="button" onClick={() => choose("denied")}>Decline</button><button className="text-button" type="button" onClick={() => { setAnalyticsSelected(false); setSettingsOpen(true); }}>Customise cookies</button></div>
    </section>}
    <dialog ref={dialog} className="cookie-dialog" aria-labelledby="cookie-settings-heading" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)}>
      <div className="cookie-dialog-heading"><h2 id="cookie-settings-heading">Cookie settings</h2><button type="button" className="cookie-close" aria-label="Close cookie settings" onClick={() => setSettingsOpen(false)}>×</button></div>
      <p>Choose whether we use analytics and ads measurement. You can change your choice from the footer whenever you like.</p>
      <div className="cookie-category"><div><h3>Essential cookies</h3><p>Remember your cookie choice and support secure sign-in and booking access.</p></div><strong>Always active</strong></div>
      <label htmlFor="analytics-consent-choice" aria-label="Analytics cookies" className="cookie-category cookie-analytics"><span><strong>Analytics and ads measurement</strong><span className="cookie-category-description">Allow Google Analytics on public pages and Google Ads conversion measurement when you request a booking. Passenger details, addresses and booking references are never sent. No ad personalisation.</span></span><input id="analytics-consent-choice" type="checkbox" checked={analyticsSelected} onChange={event => setAnalyticsSelected(event.target.checked)} /></label>
      <p className="cookie-policy-link"><Link href="/privacy#cookies" onClick={() => setSettingsOpen(false)}>Cookie and privacy information</Link></p>
      <div className="cookie-dialog-actions"><button className="button button-primary" type="button" onClick={() => choose(analyticsSelected ? "granted" : "denied")}>Save my choice</button><button className="button button-ghost" type="button" onClick={() => choose("denied")}>Decline</button></div>
    </dialog>
  </>;
}
