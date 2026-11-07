"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { bookingConversionFramePath } from "../lib/analytics";
import { consentSnapshot, serverConsentSnapshot, subscribeToConsent } from "../lib/consent-store";
import { paymentStatusLabel } from "../lib/journey-presentation";
import { business } from "../lib/business";
import { thankYouMessage, type BookingSummary } from "../lib/booking-thank-you";
import { BookingReview } from "./BookingReview";
import { SiteHeader } from "./SiteHeader";

type View = { booking: BookingSummary | null; access: string; error: string; loaded: boolean };
const CONVERSION_STATUSES = new Set(["review", "pending_customer_confirmation", "awaiting_dispatch", "offered", "awaiting_payment", "accepted"]);
export function BookingThankYou({ googleReviewUrl, adsConversion = false }: { googleReviewUrl: string | null; adsConversion?: boolean }) {
  const [view, setView] = useState<View>({ booking: null, access: "", error: "", loaded: false });
  const consent = useSyncExternalStore(subscribeToConsent, consentSnapshot, serverConsentSnapshot);
  const [conversionSrc, setConversionSrc] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load(attempt = 0) {
      const query = new URLSearchParams(window.location.search);
      const reference = query.get("ref") || "";
      let access = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      try {
        if (access) {
          sessionStorage.setItem(`cc:${reference}`, access);
          history.replaceState(null, "", window.location.pathname + window.location.search);
        } else access = sessionStorage.getItem(`cc:${reference}`) || "";
      } catch { /* A fragment link still works if browser storage is unavailable. */ }
      try {
        if (!reference) { await Promise.resolve(); if (!controller.signal.aborted) setView({ booking: null, access: "", error: "", loaded: true }); return; }
        const response = await fetch(`/api/bookings?reference=${encodeURIComponent(reference)}`, { headers: access ? { Authorization: `Bearer ${access}` } : {}, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "We could not load your booking.");
        if (controller.signal.aborted) return;
        setView({ booking: data, access, error: "", loaded: true });
        if (query.get("payment") === "return" && data.payment_state === "not_paid" && data.status === "awaiting_payment" && attempt < 4) {
          timer = setTimeout(() => void load(attempt + 1), 2000);
        }
      } catch (caught) {
        if (!controller.signal.aborted) setView({ booking: null, access, error: caught instanceof Error ? caught.message : "We could not load your booking.", loaded: true });
      }
    }
    void load();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [refresh]);

  const booking = view.booking;
  // Count each new booking request once per browser as a Google Ads conversion (consent required).
  useEffect(() => {
    if (!adsConversion || consent !== "granted" || !booking || !CONVERSION_STATUSES.has(booking.status)) return;
    const key = `cc:ads:${booking.reference}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
    const timer = setTimeout(() => setConversionSrc(bookingConversionFramePath(booking.price_cents)), 0);
    return () => clearTimeout(timer);
  }, [adsConversion, consent, booking]);
  const copy = booking ? thankYouMessage(booking) : { heading: "Thank you for choosing cruzycabs.", label: "Your next journey", message: "Open the private link from your booking email to see your latest status, manage your journey and share feedback." };
  const manageHref = booking ? `/manage-booking?ref=${encodeURIComponent(booking.reference)}${view.access ? `#token=${encodeURIComponent(view.access)}` : ""}` : "/manage-booking";
  return <main className="thank-you-page"><SiteHeader compact />
    {conversionSrc && <iframe src={conversionSrc} className="analytics-frame" title="Ads measurement" aria-hidden="true" tabIndex={-1} referrerPolicy="no-referrer" />}
    <div className="thank-you-shell">
      <section className="thank-you-summary" aria-busy={!view.loaded} aria-labelledby="thank-you-heading">
        <span className="thank-you-mark" aria-hidden="true">✓</span>
        <span className="eyebrow">{!view.loaded ? "Checking your booking" : copy.label}</span>
        <h1 id="thank-you-heading">{!view.loaded ? "One moment…" : copy.heading}</h1>
        <p>{!view.loaded ? "Loading your latest booking details securely." : copy.message}</p>
        {view.error && <p className="error-summary" role="alert">{view.error}</p>}
        {booking && <>
          <div className="thank-you-reference"><span>Booking reference</span><strong>{booking.reference}</strong></div>
          <dl className="thank-you-details"><div><dt>Pickup</dt><dd>{booking.journey.pickup}</dd></div><div><dt>Destination</dt><dd>{booking.journey.destination}</dd></div>{booking.journey.when === "schedule" && <div><dt>Pickup time</dt><dd>{booking.journey.date} at {booking.journey.time}, New Zealand time</dd></div>}<div><dt>Journey total</dt><dd>{(booking.price_cents / 100).toLocaleString("en-NZ", { style: "currency", currency: "NZD" })}</dd></div><div><dt>Payment</dt><dd>{paymentStatusLabel(booking.payment_state)}</dd></div></dl>
          <p className="thank-you-next">{booking.status === "completed" ? "Your journey is complete. You can still open your booking and receipt below." : "Keep your confirmation email and private booking link. Check the assigned driver and vehicle before boarding."}</p>
        </>}
        <div className="thank-you-actions"><Link className="button button-primary" prefetch={false} href={manageHref}>{booking?.canPay ? "Open booking & pay securely" : "Manage my booking"}</Link><Link className="button button-ghost" href="/#journey-form">Book another ride</Link>{booking?.receipt_url && <a className="inline-link" href={booking.receipt_url} target="_blank" rel="noopener noreferrer">View payment receipt ↗</a>}</div>
        {view.loaded && <button className="text-button" onClick={() => setRefresh(value => value + 1)}>Refresh booking status</button>}
        <p className="thank-you-help">Need a hand? <a href={`mailto:${business.email}`}>Email operations</a> · <Link href="/help">Booking support</Link></p>
      </section>
      {view.loaded && <BookingReview key={booking?.reference || "guest"} reference={booking?.reference || ""} access={view.access} submitted={booking?.reviewSubmitted} googleReviewUrl={googleReviewUrl} />}
    </div>
  </main>;
}
