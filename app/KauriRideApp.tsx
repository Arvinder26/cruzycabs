"use client";
import Image from "next/image";
import Link from "next/link";


import { FormEvent, useMemo, useState } from "react";
import { AddressAutocomplete, type AddressSelection } from "./AddressAutocomplete";
import { SiteHeader } from "./SiteHeader";
import { EnquiryForm } from "./EnquiryForm";
import { VehicleIcon, WheelchairIcon } from "./VehicleIcon";

type QuoteVehicle = {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  luggage: number;
  note: string;
  availability: string;
  multiplier: number;
  journeyMultiplier: number;
  petFeeCents: number;
  gstLabel: string;
  gstIncludedCents: number;
  badge?: string;
};

type Quote = {
  id: string;
  accessToken: string;
  state: "quoted" | "manual_review";
  currency: "NZD";
  pricingVersion: string;
  lockedUntil: string;
  distanceKm: number;
  durationMin: number;
  vehicles: QuoteVehicle[];
  breakdown: { label: string; amountCents: number }[];
  explanation: string;
};

type Journey = {
  pickup: string;
  destination: string;
  pickupLocation: AddressSelection | null;
  destinationLocation: AddressSelection | null;
  when: "now" | "schedule";
  date: string;
  time: string;
  passengers: number;
  luggage: number;
  accessible: boolean;
  childSeat: boolean;
  pet: boolean;
  airportTerminal: string;
  airline: string;
  flightNumber: string;
  wheelchair: string;
  stops: string[];
};

const initialJourney: Journey = {
  pickup: "",
  destination: "",
  pickupLocation: null,
  destinationLocation: null,
  when: "now",
  date: "",
  time: "",
  passengers: 1,
  luggage: 0,
  accessible: false,
  childSeat: false,
  pet: false,
  airportTerminal: "",
  airline: "",
  flightNumber: "",
  wheelchair: "ramp",
  stops: [],
};

const services = [
  ["Auckland rides", "Clear local fares for trips across the Auckland region.", "01"],
  ["Airport transfers", "Terminal-aware pickups, flight details and all known fees included.", "02"],
  ["Accessible travel", "Structured vehicle and assistance requirements before payment.", "03"],
  ["North Island transfers", "Private point-to-point journeys with operational review when needed.", "04"],
  ["Private tours", "Flexible day and multi-day itineraries built around your group.", "05"],
  ["Business travel", "Arrange recurring travel and corporate billing with operations.", "06"],
];

const vehiclePreviews = [
  ["Car", "1 to 4 people", "Comfortable everyday travel"],
  ["Van", "1 to 7 people", "Groups and extra luggage"],
  ["Accessible", "Up to 4 + wheelchair", "Ramp or hoist matched"],
  ["Executive", "1 to 3 people", "Business and private transfers"],
];

const airportTerminals: { name: string; value: string; selection: AddressSelection }[] = [
  {
    name: "Domestic terminal",
    value: "Domestic",
    selection: {
      id: "akl-domestic-terminal",
      label: "Auckland Airport Domestic Terminal, Ray Emery Drive, Māngere, Auckland 2022, New Zealand",
      primary: "Auckland Airport Domestic Terminal",
      secondary: "Ray Emery Drive, Māngere, Auckland",
      latitude: -37.0082,
      longitude: 174.7917,
      source: "manual",
    },
  },
  {
    name: "International terminal",
    value: "International",
    selection: {
      id: "akl-international-terminal",
      label: "Auckland Airport International Terminal, Ray Emery Drive, Māngere, Auckland 2022, New Zealand",
      primary: "Auckland Airport International Terminal",
      secondary: "Ray Emery Drive, Māngere, Auckland",
      latitude: -37.0072,
      longitude: 174.785,
      source: "manual",
    },
  },
];

function money(cents: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
}

function AirportShortcutCards({
  label,
  target,
  journey,
  onSelect,
}: {
  label: string;
  target: "pickup" | "destination";
  journey: Journey;
  onSelect: (terminal: (typeof airportTerminals)[number], target: "pickup" | "destination") => void;
}) {
  const selectedLocation = target === "pickup" ? journey.pickupLocation : journey.destinationLocation;
  return <details className="airport-picker"><summary>{label}<span aria-hidden="true">+</span></summary><fieldset className="airport-shortcuts">
    <legend>{label}</legend>
    <div>
      {airportTerminals.map((terminal) => {
        const selectedTerminal = selectedLocation?.id === terminal.selection.id;
        return <button
          className={selectedTerminal ? "selected" : ""}
          type="button"
          key={`${target}-${terminal.value}`}
          aria-pressed={selectedTerminal}
          onClick={() => onSelect(terminal, target)}
        >
          <span>AKL</span>
          <strong>{terminal.name}</strong>
          <small>{selectedTerminal ? `${target === "pickup" ? "Pickup" : "Destination"} selected` : `Use as ${target}`}</small>
        </button>;
      })}
    </div>
  </fieldset></details>;
}

export function KauriRideApp({onlinePricingAvailable=false,requestSubmissionAvailable=true}:{onlinePricingAvailable?:boolean;requestSubmissionAvailable?:boolean}) {
  const [journey, setJourney] = useState(initialJourney);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<"journey" | "vehicle" | "details" | "confirmed">("journey");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedPrice, setExpandedPrice] = useState(false);
  const [bookingForOther, setBookingForOther] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [enquiry,setEnquiry] = useState("");
  const [booking, setBooking] = useState<{ reference: string; status: string; accessToken: string; paymentMessage?: string } | null>(null);

  const isAirport = useMemo(
    () => /airport|akl|terminal/i.test(`${journey.pickup} ${journey.destination}`),
    [journey.pickup, journey.destination],
  );

  function update<K extends keyof Journey>(key: K, value: Journey[K]) {
    setJourney((current) => ({ ...current, [key]: value }));
    setQuote(null);
    setStep("journey");
  }

  function updateAddress(key: "pickup" | "destination", value: string) {
    setJourney((current) => key === "pickup"
      ? { ...current, pickup: value, pickupLocation: null, airportTerminal: "" }
      : { ...current, destination: value, destinationLocation: null, airportTerminal: "" });
    setQuote(null);
    setStep("journey");
    setError("");
  }

  function selectAddress(key: "pickup" | "destination", selection: AddressSelection) {
    setJourney((current) => key === "pickup"
      ? { ...current, pickup: selection.label, pickupLocation: selection }
      : { ...current, destination: selection.label, destinationLocation: selection, airportTerminal: "" });
    setQuote(null);
    setStep("journey");
    setError("");
  }

  function selectAirportTerminal(terminal: (typeof airportTerminals)[number], target: "pickup" | "destination") {
    setJourney((current) => target === "pickup" ? {
      ...current,
      pickup: terminal.selection.label,
      pickupLocation: terminal.selection,
      airportTerminal: terminal.value,
    } : {
      ...current,
      destination: terminal.selection.label,
      destinationLocation: terminal.selection,
      airportTerminal: terminal.value,
    });
    setQuote(null);
    setStep("journey");
    setError("");
  }

  async function requestQuote(event: FormEvent) {
    event.preventDefault();
    setError("");
    if(!onlinePricingAvailable){setEnquiry(`Journey request\nPickup: ${journey.pickup || "To be arranged"}\nDestination: ${journey.destination || "To be arranged"}\nVia: ${journey.stops.join(" → ") || "Direct"}\nPickup time: ${journey.when === "now" ? "As soon as available" : `${journey.date} ${journey.time} NZ time`}\nPassengers: ${journey.passengers}\nLuggage: ${journey.luggage}\nWheelchair assistance: ${journey.accessible ? journey.wheelchair : "No"}\nChild seat: ${journey.childSeat ? "Yes" : "No"}\nPet: ${journey.pet ? "Yes" : "No"}`);setTimeout(()=>document.getElementById("enquiry")?.scrollIntoView({behavior:"smooth"}),0);return;}
    if (!journey.pickup.trim() || !journey.destination.trim()) {
      setError("Enter both a pickup and destination to see a price.");
      return;
    }
    if (!journey.pickupLocation || !journey.destinationLocation) {
      setError("Choose each address from the suggestions, or select “Use this address” to confirm what you entered.");
      return;
    }
    if (journey.when === "schedule" && (!journey.date || !journey.time)) {
      setError("Choose a date and time for your scheduled ride.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(journey),
      });
      const data = (await response.json()) as Quote & { error?: string };
      if (!response.ok) throw new Error(data.error || "We couldn’t prepare this quote.");
      setQuote(data);
      setSelectedVehicle(data.vehicles[0]?.id ?? "");
      setStep("vehicle");
      setTimeout(() => document.getElementById("quote-results")?.focus(), 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t prepare this quote.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking(event: FormEvent) {
    event.preventDefault();
    if (!quote || !selectedVehicle) return;
    setError("");
    if (!customer.name || !customer.email || !customer.phone) {
      setError("Enter the passenger’s name, email and mobile number.");
      return;
    }
    setLoading(true);
    try {
      const idempotencyKey = `cc-${quote.id}`;
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey, authorization: `Bearer ${quote.accessToken}` },
        body: JSON.stringify({
          quoteId: quote.id,
          vehicleId: selectedVehicle,
          customer,
          bookingForOther,
          paymentMethod: "card",
          termsAccepted,
        }),
      });
      const data = (await response.json()) as { reference?: string; status?: string; error?: string; accessToken: string; checkoutUrl?: string; paymentMessage?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Booking could not be completed.");
      sessionStorage.setItem(`cc:${data.reference}`, data.accessToken);
      if (data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
      setBooking({ reference: data.reference, status: data.status || "Request recorded", accessToken: data.accessToken, paymentMessage: data.paymentMessage });
      setStep("confirmed");
      setTimeout(() => document.getElementById("confirmation")?.focus(), 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Booking could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function resetBooking() {
    setJourney(initialJourney);
    setQuote(null);
    setBooking(null);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
    setStep("journey");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selected = quote?.vehicles.find((vehicle) => vehicle.id === selectedVehicle);

  return (
    <main>
      <Link className="skip-link" href="#journey-form">Skip to booking</Link>
      <SiteHeader bookHref="#journey-form" />

      <section className="hero" id="booking">
        <div className="hero-copy">
          <p className="eyebrow">Be choosy. Ride Cruzy.</p>
          <h1>Book the ride.<br />Know the total.</h1>
          <p className="hero-intro">Local rides, airport transfers and private North Island journeys, with a professional driver and a clear price before you confirm.</p>
          <div className="availability-note">
            <span className="status-dot" aria-hidden="true" />
            <span>{requestSubmissionAvailable?"Booking requests are open. Driver details are shared after confirmation.":"Online bookings are being activated. Contact operations for journey enquiries."}</span>
          </div>
          <a className="button button-light hero-book-link" href="#journey-form">Start my booking <span aria-hidden="true">↓</span></a>
          <div className="route-art" aria-hidden="true">
            <Image unoptimized src="/images/kauri-route-panorama.webp" alt="" width={1774} height={887} decoding="async" />
            <span className="route-label start">AKL</span>
            <span className="route-line" />
            <span className="route-label end">NI</span>
          </div>
          <div className="hero-proof-grid" aria-label="What to expect when booking">
            <div><span>01</span><strong>Upfront total</strong><small>Shown before you confirm</small></div>
            <div><span>02</span><strong>Vehicle matched</strong><small>To people, luggage and access</small></div>
            <div><span>03</span><strong>Driver details</strong><small>Shared after acceptance</small></div>
          </div>
        </div>

        <div className="booking-card" id="journey-form">
          <div className="card-stepper" aria-label={`Booking step: ${step}`}>
            <span className={step === "journey" ? "active" : "done"}>1 Journey</span>
            <span className={step === "vehicle" ? "active" : step === "details" || step === "confirmed" ? "done" : ""}>2 Vehicle</span>
            <span className={step === "details" ? "active" : step === "confirmed" ? "done" : ""}>3 Confirm</span>
          </div>

          {step === "journey" && (
            <form onSubmit={requestQuote} noValidate>
              <div className="form-heading">
                <div><span className="kicker">Your journey</span><h2>Where are you going?</h2></div>
                <span className="time-target">About 60 sec</span>
              </div>
              <AirportShortcutCards label="Quick airport pickup" target="pickup" journey={journey} onSelect={selectAirportTerminal} />
              <AddressAutocomplete
                label="Pickup address"
                value={journey.pickup}
                selection={journey.pickupLocation}
                placeholder="Street, hotel, venue or airport"
                onChange={(value) => updateAddress("pickup", value)}
                onSelect={(selection) => selectAddress("pickup", selection)}
              />
              {journey.stops.map((stop,index) => <div className="form-row" key={index}><label>Stop {index+1}<input value={stop} onChange={e=>update("stops",journey.stops.map((value,i)=>i===index?e.target.value:value))} maxLength={250} required /></label><button type="button" className="text-button" onClick={()=>update("stops",journey.stops.filter((_,i)=>i!==index))}>Remove stop {index+1}</button></div>)}
              <button className="text-button" type="button" disabled={journey.stops.length>=3} onClick={() => update("stops", [...journey.stops, ""])}>+ Add stop</button>
              <AirportShortcutCards label="Quick airport destination" target="destination" journey={journey} onSelect={selectAirportTerminal} />
              <AddressAutocomplete
                label="Destination"
                value={journey.destination}
                selection={journey.destinationLocation}
                placeholder="Where should we take you?"
                destination
                onChange={(value) => updateAddress("destination", value)}
                onSelect={(selection) => selectAddress("destination", selection)}
              />
              <div className="segmented" aria-label="Pickup time">
                <button type="button" className={journey.when === "now" ? "selected" : ""} onClick={() => update("when", "now")}>Now</button>
                <button type="button" className={journey.when === "schedule" ? "selected" : ""} onClick={() => update("when", "schedule")}>Schedule</button>
              </div>
              {journey.when === "schedule" && <div className="form-row reveal">
                <label>Date<input type="date" value={journey.date} onChange={(event) => update("date", event.target.value)} /></label>
                <label>Time<input type="time" value={journey.time} onChange={(event) => update("time", event.target.value)} /></label>
              </div>}
              <div className="form-row counts">
                <label>Passengers<select value={journey.passengers} onChange={(event) => update("passengers", Number(event.target.value))}>{[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label>Luggage<select value={journey.luggage} onChange={(event) => update("luggage", Number(event.target.value))}>{[0,1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              </div>
              <div className="quick-needs">
                <label><input type="checkbox" checked={journey.accessible} onChange={(e) => update("accessible", e.target.checked)} /> Wheelchair-accessible</label>
                <label><input type="checkbox" checked={journey.childSeat} onChange={(e) => update("childSeat", e.target.checked)} /> Child seat</label>
                <label><input type="checkbox" checked={journey.pet} onChange={(e) => update("pet", e.target.checked)} /> Pet-friendly</label>
              </div>
              {journey.accessible && <label>Wheelchair assistance<select value={journey.wheelchair} onChange={e=>update("wheelchair",e.target.value)}><option value="ramp">Passenger remains seated · ramp required</option><option value="hoist">Passenger remains seated · hoist required</option><option value="transfer">Passenger transfers into vehicle seat</option></select></label>}
              {isAirport && <fieldset className="airport-fields reveal">
                <legend>Airport details</legend>
                <div className="form-row">
                  <label>Terminal<select value={journey.airportTerminal} onChange={(e) => update("airportTerminal", e.target.value)}><option value="">Choose terminal</option><option>Domestic</option><option>International</option></select></label>
                  <label>Flight number<input value={journey.flightNumber} onChange={(e) => update("flightNumber", e.target.value.toUpperCase())} placeholder="e.g. NZ123" pattern="[A-Z0-9]{2,8}" /></label>
                </div>
              </fieldset>}
              {error && <div className="error-summary" role="alert">{error}</div>}
              <button className="button button-primary button-wide" disabled={loading}>{loading ? "Checking your journey…" : onlinePricingAvailable ? "Get route price" : "Send a booking enquiry"}<span aria-hidden="true">→</span></button>
              <p className="assurance">{onlinePricingAvailable ? "Full price shown before confirmation. Guest booking available." : "Operations will confirm your route, availability and fare before payment."}</p>
            </form>
          )}

          {step === "vehicle" && quote && (
            <section id="quote-results" tabIndex={-1} aria-live="polite">
              <div className="form-heading compact"><div><span className="kicker">Price & vehicle</span><h2>Choose what fits</h2></div><button className="text-button" onClick={() => setStep("journey")}>Edit journey</button></div>
              <div className="journey-summary"><strong>{journey.pickup}</strong><span>to</span><strong>{journey.destination}</strong><small>{quote.distanceKm} km · about {quote.durationMin} min · {quote.pricingVersion}</small></div>
              {quote.state === "manual_review" && <div className="review-notice">This North Island journey needs availability confirmation. You can submit it for operational review.</div>}
              <div className="vehicle-options">
                {quote.vehicles.map((vehicle) => <label className={`vehicle-option ${selectedVehicle === vehicle.id ? "chosen" : ""}`} key={vehicle.id}>
                  <input type="radio" name="vehicle" value={vehicle.id} checked={selectedVehicle === vehicle.id} onChange={() => setSelectedVehicle(vehicle.id)} />
                  <span className="vehicle-icon" aria-hidden="true">{vehicle.id === "accessible" ? "♿" : vehicle.id === "xl" ? "▰" : "◆"}</span>
                  <span className="vehicle-main"><span>{vehicle.name}{vehicle.badge && <em>{vehicle.badge}</em>}</span><small>{vehicle.capacity} passengers · {vehicle.luggage} bags</small><small>{vehicle.note}</small></span>
                  <span className="vehicle-price"><strong>{money(vehicle.priceCents)}</strong><small>incl. GST</small></span>
                </label>)}
              </div>
              <button className="price-toggle" type="button" aria-expanded={expandedPrice} onClick={() => setExpandedPrice(!expandedPrice)}>What’s included in the total? <span>{expandedPrice ? "−" : "+"}</span></button>
              {expandedPrice && selected && <div className="breakdown reveal">
                {quote.breakdown.map((item) => <div key={item.label}><span>{item.label}</span><span>{money(item.amountCents)}</span></div>)}
                {selected.journeyMultiplier !== 1 && <div><span>Long-distance journey factor</span><span>{selected.journeyMultiplier}×</span></div>}
                {selected.multiplier !== 1 && <div><span>{selected.name} vehicle factor</span><span>{selected.multiplier}×</span></div>}
                {selected.petFeeCents > 0 && <div><span>Pet request</span><span>{money(selected.petFeeCents)}</span></div>}
                <div><span>{selected.gstLabel}</span><span>{money(selected.gstIncludedCents)}</span></div>
                <div className="breakdown-total"><strong>Selected total</strong><strong>{money(selected.priceCents)}</strong></div>
                <p>{quote.explanation}</p>
              </div>}
              <p className="quote-lock">Quote held until {new Date(quote.lockedUntil).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}. It changes only if you change the journey.</p>
              {error && <div className="error-summary" role="alert">{error}</div>}
              <button className="button button-primary button-wide" onClick={() => setStep("details")} disabled={!selectedVehicle}>Continue with {selected?.name}<span aria-hidden="true">→</span></button>
            </section>
          )}

          {step === "details" && quote && selected && (
            <form onSubmit={confirmBooking}>
              <div className="form-heading compact"><div><span className="kicker">Guest booking</span><h2>Who is travelling?</h2></div><button className="text-button" type="button" onClick={() => setStep("vehicle")}>Back</button></div>
              <label className="toggle-line"><input type="checkbox" checked={bookingForOther} onChange={(e) => setBookingForOther(e.target.checked)} /> I’m booking for someone else</label>
              {bookingForOther && <p>Enter the passenger contact details below. Their email receives the private booking link and payment updates. Add coordinator instructions in the notes.</p>}
              <label>Passenger name<input required maxLength={100} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} autoComplete="name" /></label>
              <div className="form-row">
                <label>Mobile number<input required value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} type="tel" autoComplete="tel" placeholder="e.g. 027 123 4567" /><small className="phone-help">NZ numbers are welcome — no +64 needed.</small></label>
                <label>Email address<input required maxLength={254} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} type="email" autoComplete="email" /></label>
              </div>
              <label>Pickup or assistance notes <span className="optional">optional</span><textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="Entrance, landmark or anything that would make the trip easier" /></label>
              <p className="payment-choices">Card payments are handled securely by Stripe. Contact operations for cash or corporate arrangements.</p>
              <div className="review-total"><span>{selected.name}<small>{journey.when === "now" ? "Pickup requested now" : `${journey.date} at ${journey.time}`}</small></span><strong>{money(selected.priceCents)}<small>total NZD</small></strong></div>
              <p className="preview-truth">{quote.state === "manual_review" ? "Operations reviews your requirements before requesting payment." : "Payment records your request. Travel is confirmed after a suitable driver accepts."} Cancel before your trip starts for a full refund.</p>
              <label className="toggle-line"><input type="checkbox" required checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} /><span>I accept the <Link href="/terms">terms and cancellation policy</Link>.</span></label>
              {error && <div className="error-summary" role="alert">{error}</div>}
              <button className="button button-primary button-wide" disabled={loading}>{loading ? "Preparing your request…" : quote.state === "manual_review" ? "Request availability review" : "Continue to secure payment"}<span aria-hidden="true">→</span></button>
              <p className="terms">Your card details stay with Stripe. We use your contact details to fulfil this request; see our <Link href="/privacy">privacy policy</Link>.</p>
            </form>
          )}

          {step === "confirmed" && booking && (
            <section className="confirmation" id="confirmation" tabIndex={-1}>
              <span className="confirmation-mark" aria-hidden="true">✓</span>
              <p className="eyebrow">{booking.status}</p>
              <h2>Your request is safely recorded.</h2>
              <p className="reference">Booking reference <strong>{booking.reference}</strong></p>
              {booking.paymentMessage && <p role="status">{booking.paymentMessage}</p>}
              <div className="confirmation-route"><span>{journey.pickup}</span><i /><span>{journey.destination}</span></div>
              <div className="truth-status"><strong>No driver assigned yet</strong><span>Driver matching follows operational checks. We won’t claim assignment until a driver accepts.</span></div>
              <div className="confirmation-actions"><Link className="button button-primary" href={`/manage-booking?ref=${booking.reference}#token=${booking.accessToken}`}>Manage booking</Link><button className="button button-ghost" type="button" onClick={() => navigator.clipboard?.writeText(booking.reference)}>Copy reference</button></div>
              <button className="text-button" type="button" onClick={resetBooking}>Book another ride</button>
            </section>
          )}
        </div>
      </section>

      {enquiry && <EnquiryForm kind="journey" initialDetails={enquiry} title="Send your journey to operations" submissionAvailable={requestSubmissionAvailable} />}
      <section className="trust-strip" aria-label="Service commitments">
        <span><b>01</b> Driver checks required</span><span><b>02</b> Upfront total</span><span><b>03</b> Guest booking</span><span><b>04</b> Human support</span>
      </section>

      <section className="steps section-pad">
        <div className="section-heading"><span className="eyebrow">Simple by design</span><h2>From address to answer<br />in three clear steps.</h2></div>
        <div className="step-grid"><article><b>01</b><h3>Enter your journey</h3><p>Tell us where, when and how many people are travelling.</p></article><article><b>02</b><h3>Choose your vehicle</h3><p>Compare only vehicles that fit your trip and requirements.</p></article><article><b>03</b><h3>Confirm and track</h3><p>Book as a guest, then manage the ride through a secure link.</p></article></div>
      </section>

      <section className="services section-pad" id="services">
        <div className="section-heading split"><div><span className="eyebrow">One dependable service</span><h2>The right kind of ride,<br />without the guesswork.</h2></div><p>Every option starts with the same promise: a suitable vehicle, a clear total and honest status updates.</p></div>
        <div className="service-grid">{services.map(([title, text, number]) => <Link href={`/${title.toLowerCase().replaceAll(" ", "-")}`} key={title}><span>{number}</span><h3>{title}</h3><p>{text}</p><i aria-hidden="true">↗</i></Link>)}</div>
      </section>

      <section className="airport-feature section-pad">
        <div className="terminal-board" aria-label="Auckland Airport booking guide">
          <div className="board-head"><span>AKL PICKUP GUIDE</span><span>CHOOSE YOUR TERMINAL</span></div>
          <div className="board-row"><span>DOM</span><strong>Domestic terminal</strong><em>One-tap pickup or destination</em></div>
          <div className="board-row"><span>INT</span><strong>International terminal</strong><em>One-tap pickup or destination</em></div>
          <div className="board-row"><span>CHECK</span><strong>Booking details</strong><em>Driver and vehicle shown</em></div>
          <p>Choose a terminal in the booking card to load the correct Auckland Airport pickup or destination.</p>
        </div>
        <div className="feature-copy"><span className="eyebrow amber">Airport journeys</span><h2>Less uncertainty<br />at the terminal.</h2><p>Terminal selection, flight details and known airport charges become part of the booking, not an afterthought.</p><ul><li>Flight number captured with the request</li><li>One-tap terminal pickup or destination</li><li>Accessible routes and luggage options</li><li>Airport fees included in the total</li></ul><Link href="/airport-transfers" className="inline-link">Plan an airport ride <span>→</span></Link></div>
      </section>

      <section className="vehicles section-pad">
        <div className="section-heading split"><div><span className="eyebrow">Matched to the journey</span><h2>Space, access and comfort<br />made clear.</h2></div><p>Capacity means real passengers and practical luggage, not optimistic marketing.</p></div>
        <div className="vehicle-preview-grid">{vehiclePreviews.map(([name, capacity, note], index) => <article key={name}><VehicleIcon kind={(["car", "van", "accessible", "executive"] as const)[index]} /><span>0{index + 1}</span><h3>{name}</h3><strong>{capacity}</strong><p>{note}</p></article>)}</div>
      </section>

      <section className="access-feature section-pad">
        <div className="access-intro"><span className="access-icon"><WheelchairIcon /></span><span className="eyebrow">Accessible travel</span><h2>A smoother trip,<br />built around you.</h2><p>Tell us what would make your journey easier. We’ll match the vehicle and assistance to your needs.</p></div>
        <div className="access-details"><h3>Plan your support before pickup</h3><ul><li>Ramp or hoist requirements</li><li>Passenger remaining in wheelchair</li><li>Service animals and support people</li><li>Extra boarding time and assistance</li></ul><Link href="#journey-form" className="button button-primary" onClick={() => update("accessible", true)}>Book an accessible vehicle <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className="north-island section-pad">
        <div className="north-copy"><span className="eyebrow">Beyond Auckland</span><h2>One driver.<br />Your itinerary.</h2><p>Private transfers and tours across the North Island, shaped around your group, luggage, stops and pace.</p><div className="destination-list"><span>Hamilton</span><span>Rotorua</span><span>Taupō</span><span>Bay of Islands</span><span>Waitomo</span><span>Wellington</span></div><Link className="inline-link" href="/north-island-transfers">Plan a North Island journey <span>→</span></Link></div>
        <figure className="island-route"><Image unoptimized src="/images/north-island-map-clean.webp" alt="Illustrated North Island route from Auckland through Rotorua to Wellington" width={1122} height={1402} loading="lazy" decoding="async" /><span className="city auckland">Auckland</span><span className="city rotorua">Rotorua</span><span className="city wellington">Wellington</span></figure>
      </section>

      <section className="support section-pad"><div><span className="eyebrow amber">Prefer a person?</span><h2>Help for the journeys that need it.</h2></div><p>Booking support covers airport, accessible, family and complex North Island journeys.</p><Link href="/help">Open booking support <span>Visit the help centre</span></Link></section>

    </main>
  );
}

