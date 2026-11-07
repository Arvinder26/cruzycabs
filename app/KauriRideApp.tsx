"use client";
import Image from "next/image";
import Link from "next/link";


import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AddressAutocomplete, type AddressSelection } from "./AddressAutocomplete";
import { SiteHeader } from "./SiteHeader";
import { EnquiryForm } from "./EnquiryForm";
import { VehicleIcon, WheelchairIcon } from "./VehicleIcon";
import { JourneySummary } from "./JourneySummary";
import { business } from "../lib/business";
import { reviewReasons } from "../lib/journey-presentation";
import { thankYouPath } from "../lib/booking-links";
import { estimateDetails, type JourneyEstimate } from "../lib/journey-estimate";

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
  positioningFeeCents?: number;
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
  reviewReasons?: string[];
  distanceKm: number;
  durationMin: number;
  positioning?: { from: string; minutes: number; feeCents: number } | null;
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
  ["Cruise transfers", "Private Auckland cruise-terminal, airport and hotel transfers.", "07"],
  ["Hourly van hire", "A van and private driver for Auckland meetings or sightseeing.", "08"],
];

const vehiclePreviews = [
  ["Van", "1 to 10 people", "Groups and extra luggage"],
  ["Accessible", "Up to 4 passengers", "Wheelchair space and equipment reviewed"],
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

function AirportShortcuts({
  journey,
  onSelect,
}: {
  journey: Journey;
  onSelect: (terminal: (typeof airportTerminals)[number], target: "pickup" | "destination") => void;
}) {
  const chosen = [journey.pickupLocation, journey.destinationLocation].some((location) => airportTerminals.some((terminal) => terminal.selection.id === location?.id));
  return <details className="airport-picker" open={chosen || undefined}><summary><span className="airport-picker-label"><span className="airport-picker-tag" aria-hidden="true">AKL</span>Airport trip? Pick a terminal</span><span className="airport-picker-icon" aria-hidden="true">+</span></summary>
    <div className="airport-shortcuts">
      {(["pickup", "destination"] as const).map((target) => {
        const selectedLocation = target === "pickup" ? journey.pickupLocation : journey.destinationLocation;
        return <fieldset key={target}>
          <legend>{target === "pickup" ? "Pickup from" : "Drop-off at"}</legend>
          <div>
            {airportTerminals.map((terminal) => {
              const selectedTerminal = selectedLocation?.id === terminal.selection.id;
              return <button
                className={selectedTerminal ? "selected" : ""}
                type="button"
                key={`${target}-${terminal.value}`}
                aria-pressed={selectedTerminal}
                aria-label={`${target === "pickup" ? "Pickup from" : "Drop-off at"} Auckland Airport ${terminal.name}`}
                onClick={() => onSelect(terminal, target)}
              >{terminal.value}</button>;
            })}
          </div>
        </fieldset>;
      })}
    </div>
  </details>;
}

export function KauriRideApp({onlinePricingAvailable=false,requestSubmissionAvailable=true,vansOnly=false}:{onlinePricingAvailable?:boolean;requestSubmissionAvailable?:boolean;vansOnly?:boolean}) {
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
  const [enquiryEstimate, setEnquiryEstimate] = useState<JourneyEstimate | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const estimateRequest = useRef<AbortController | null>(null);
  const [booking, setBooking] = useState<{ reference: string; status: string; accessToken: string; paymentMessage?: string } | null>(null);

  const stepHeading=useRef<HTMLHeadingElement>(null),previousStep=useRef(step);
  const [clock,setClock]=useState(0);
  useEffect(()=>{if(previousStep.current!==step){previousStep.current=step;stepHeading.current?.focus();}},[step]);
  useEffect(()=>{if(!quote)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[quote]);
  const quoteExpired=Boolean(quote&&clock>=Date.parse(quote.lockedUntil));
  const secondsLeft=quote?Math.max(0,Math.ceil((Date.parse(quote.lockedUntil)-clock)/1000)):0;

  function terminalFor(selection:AddressSelection|null){return /domestic/i.test(selection?.label||"")?"Domestic":/international/i.test(selection?.label||"")?"International":"";}
  async function openEnquiry() {
    estimateRequest.current?.abort();
    const controller = new AbortController();
    estimateRequest.current = controller;
    setLoading(true);
    setEnquiry("");
    setEnquiryEstimate(null);
    setEstimateError("");
    let estimate: JourneyEstimate | null = null;
    try {
      const response = await fetch("/api/estimates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(journey), signal: controller.signal });
      const data = await response.json() as JourneyEstimate & { error?: string };
      if (!response.ok) throw new Error(data.error || "The route estimate is unavailable.");
      estimate = data;
    } catch (caught) {
      if (controller.signal.aborted) return;
      setEstimateError(caught instanceof Error ? caught.message : "The route estimate is unavailable.");
    } finally {
      if (estimateRequest.current === controller) setLoading(false);
    }
    if (controller.signal.aborted) return;
    setEnquiryEstimate(estimate);
    setEnquiry(["Journey request", "Pickup: "+(journey.pickup||"To be arranged"),"Destination: "+(journey.destination||"To be arranged"),"Via: "+(journey.stops.join(" → ")||"Direct"),"Pickup time: "+(journey.when==="now"?"As soon as available":journey.date+" "+journey.time+" New Zealand time"),"Passengers: "+journey.passengers,"Luggage: "+journey.luggage,"Wheelchair assistance: "+(journey.accessible?journey.wheelchair:"No"),"Child seat: "+(journey.childSeat?"Yes":"No"),"Pet: "+(journey.pet?"Yes":"No"),"Terminal: "+(journey.airportTerminal||"Not supplied"),"Flight: "+(journey.flightNumber||"Not supplied"),...(estimate ? estimateDetails(estimate) : []),"Notes: "+customer.notes].join("\n"));
    setTimeout(()=>{const heading=document.getElementById("enquiry-heading");heading?.focus();heading?.scrollIntoView({behavior:"smooth",block:"start"});},0);
  }
  function clearEnquiry() {
    estimateRequest.current?.abort();
    estimateRequest.current = null;
    setLoading(false);
    setEnquiry("");
    setEnquiryEstimate(null);
    setEstimateError("");
  }
  const recovery=<div className="booking-recovery"><button className="text-button" type="button" onClick={openEnquiry}>Send journey to operations</button><a href={"mailto:"+business.email}>Email operations</a></div>;

  const isAirport = useMemo(
    () => /airport|akl|terminal/i.test(`${journey.pickup} ${journey.destination}`),
    [journey.pickup, journey.destination],
  );

  function update<K extends keyof Journey>(key: K, value: Journey[K]) {
    clearEnquiry();
    setJourney((current) => ({ ...current, [key]: value }));
    setQuote(null);
    setStep("journey");
  }

  function updateAddress(key: "pickup" | "destination", value: string) {
    clearEnquiry();
    setJourney((current) => key === "pickup"
      ? { ...current, pickup: value, pickupLocation: null, airportTerminal: terminalFor(current.destinationLocation) }
      : { ...current, destination: value, destinationLocation: null, airportTerminal: terminalFor(current.pickupLocation) });
    setQuote(null);
    setStep("journey");
    setError("");
  }

  function selectAddress(key: "pickup" | "destination", selection: AddressSelection) {
    clearEnquiry();
    setJourney((current) => key === "pickup"
      ? { ...current, pickup: selection.label, pickupLocation: selection, airportTerminal: terminalFor(selection)||terminalFor(current.destinationLocation) }
      : { ...current, destination: selection.label, destinationLocation: selection, airportTerminal: terminalFor(current.pickupLocation)||terminalFor(selection) });
    setQuote(null);
    setStep("journey");
    setError("");
  }

  function selectAirportTerminal(terminal: (typeof airportTerminals)[number], target: "pickup" | "destination") {
    clearEnquiry();
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

  async function requestQuote(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    if (!journey.pickup.trim() || !journey.destination.trim()) {
      setError("Enter both a pickup and destination to see a price.");
      return;
    }
    if (onlinePricingAvailable && (!journey.pickupLocation || !journey.destinationLocation)) {
      setError("Choose each address from the suggestions, or select “Use this address” to confirm what you entered.");
      return;
    }
    if (journey.when === "schedule" && (!journey.date || !journey.time)) {
      setError("Choose a date and time for your scheduled ride.");
      return;
    }
    if(!onlinePricingAvailable){await openEnquiry();return;}
    setLoading(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(journey),
      });
      const data = (await response.json()) as Quote & { error?: string };
      if (!response.ok) throw new Error(data.error || "We couldn’t prepare this quote.");
      setClock(Date.now());
      setTermsAccepted(false);
      setQuote(data);
      setSelectedVehicle(data.vehicles[0]?.id ?? "");
      setStep("vehicle");

    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t prepare this quote.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking(event: FormEvent) {
    event.preventDefault();
    if (!quote || !selectedVehicle) return;
    if(Date.parse(quote.lockedUntil)<=Date.now()){setError("Your quote has expired. Refresh the price and review it before submitting.");return;}
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
          paymentMethod: "in_person",
          termsAccepted,
        }),
      });
      const data = (await response.json()) as { reference?: string; status?: string; error?: string; accessToken: string; checkoutUrl?: string; paymentMessage?: string };
      if (!response.ok || !data.reference) {
        if(response.status===409&&/quote.*expir/i.test(data.error||"")){setClock(Date.now());setQuote(current=>current?{...current,lockedUntil:new Date(Date.now()-1).toISOString()}:null);}
        throw new Error(data.error || "Booking could not be completed.");
      }
      try { sessionStorage.setItem(`cc:${data.reference}`, data.accessToken); } catch { /* The private fragment link also works without storage. */ }
      setBooking({ reference: data.reference, status: data.status || "Request recorded", accessToken: data.accessToken, paymentMessage: data.paymentMessage });
      setStep("confirmed");
      setTimeout(() => document.getElementById("confirmation")?.focus(), 50);
      window.location.assign(thankYouPath(data.reference, data.accessToken));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Booking could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function resetBooking() {
    clearEnquiry();
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
          <h1>Auckland rides.<br />Know the total.</h1>
          <p className="hero-intro">Local rides, airport transfers and private North Island journeys, with a professional driver and a clear price before you confirm.</p>
          <div className="availability-note">
            <span className="status-dot" aria-hidden="true" />
            <span>{onlinePricingAvailable?"Booking requests are open. Driver details are shared after confirmation.":requestSubmissionAvailable?"Journey enquiries are open. Operations will confirm availability and price.":"Online bookings are being activated. Contact operations for journey enquiries."}</span>
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
                <div><span className="kicker">Your journey</span><h2 ref={stepHeading} tabIndex={-1}>Where are you going?</h2></div>
                <span className="time-target">~60 sec</span>
              </div>
              <AirportShortcuts journey={journey} onSelect={selectAirportTerminal} />
              <AddressAutocomplete
                label="Pickup address"
                value={journey.pickup}
                selection={journey.pickupLocation}
                placeholder="Street, hotel, venue or airport"
                onChange={(value) => updateAddress("pickup", value)}
                onSelect={(selection) => selectAddress("pickup", selection)}
              />
              {journey.stops.map((stop,index) => <div className="form-row stop-row" key={index}><label>Stop {index+1}<input value={stop} onChange={e=>update("stops",journey.stops.map((value,i)=>i===index?e.target.value:value))} maxLength={250} required /></label><button type="button" className="text-button" onClick={()=>update("stops",journey.stops.filter((_,i)=>i!==index))}>Remove stop {index+1}</button></div>)}
              <button className="text-button add-stop" type="button" disabled={journey.stops.length>=3} onClick={() => update("stops", [...journey.stops, ""])}>+ Add stop</button>
              <AddressAutocomplete
                label="Destination"
                value={journey.destination}
                selection={journey.destinationLocation}
                placeholder="Where should we take you?"
                destination
                onChange={(value) => updateAddress("destination", value)}
                onSelect={(selection) => selectAddress("destination", selection)}
              />
              <div className="trip-row">
                <div className="trip-when">
                  <span className="field-label" id="pickup-time-label">Pickup time</span>
                  <div className="segmented" role="group" aria-labelledby="pickup-time-label">
                    <button type="button" className={journey.when === "now" ? "selected" : ""} aria-pressed={journey.when === "now"} onClick={() => update("when", "now")}>Now</button>
                    <button type="button" className={journey.when === "schedule" ? "selected" : ""} aria-pressed={journey.when === "schedule"} onClick={() => update("when", "schedule")}>Schedule</button>
                  </div>
                </div>
                <label>Passengers<select value={journey.passengers} onChange={(event) => update("passengers", Number(event.target.value))}>{[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label>Bags<select aria-label="Luggage" value={journey.luggage} onChange={(event) => update("luggage", Number(event.target.value))}>{[0,1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              </div>
              {journey.when === "schedule" && <div className="schedule-block reveal"><div className="form-row">
                <label>Date<input aria-describedby="schedule-guidance" type="date" value={journey.date} onChange={(event) => update("date", event.target.value)} /></label>
                <label>Time<input aria-describedby="schedule-guidance" type="time" value={journey.time} onChange={(event) => update("time", event.target.value)} /></label>
              </div><p id="schedule-guidance" className="schedule-guidance">New Zealand time. At least 15 minutes ahead, within 90 days.</p></div>}
              {vansOnly && <p className="review-notice vans-only">Vans only for now: up to 10 passengers and 6 bags.</p>}
              <div className="quick-needs" role="group" aria-label="Extra requirements">
                <label><input type="checkbox" checked={journey.accessible} onChange={(e) => update("accessible", e.target.checked)} /> Wheelchair</label>
                <label><input type="checkbox" checked={journey.childSeat} onChange={(e) => update("childSeat", e.target.checked)} /> Child seat</label>
                <label><input type="checkbox" checked={journey.pet} onChange={(e) => update("pet", e.target.checked)} /> Pet</label>
              </div>
              {journey.accessible && vansOnly && <p className="review-notice" role="status">We don’t have a wheelchair-accessible vehicle running right now. Send an enquiry and operations will tell you whether we can help.</p>}
              {journey.accessible && <label>Wheelchair assistance<select value={journey.wheelchair} onChange={e=>update("wheelchair",e.target.value)}><option value="ramp">Passenger remains seated · ramp required</option><option value="hoist">Passenger remains seated · hoist required</option><option value="transfer">Passenger transfers into vehicle seat</option></select></label>}
              {isAirport && <fieldset className="airport-fields reveal">
                <legend>Airport details</legend>
                <div className="form-row">
                  <label>Terminal<select value={journey.airportTerminal} onChange={(e) => update("airportTerminal", e.target.value)}><option value="">Choose terminal</option><option>Domestic</option><option>International</option></select></label>
                  <label>Flight number<input value={journey.flightNumber} onChange={(e) => update("flightNumber", e.target.value.toUpperCase())} placeholder="e.g. NZ123" pattern="[A-Z0-9]{2,8}" /></label>
                </div>
              </fieldset>}
              {error && <><div className="error-summary" role="alert">{error}</div>{recovery}</>}
              <button className="button button-primary button-wide" disabled={loading}>{loading ? "Checking your journey…" : onlinePricingAvailable ? "Get route price" : "Send a booking enquiry"}<span aria-hidden="true">→</span></button>
              <p className="assurance">{onlinePricingAvailable ? "Full price shown before confirmation. Guest booking available." : "See your estimated price, then send your enquiry. Operations confirms the final fare and availability."}</p>
            </form>
          )}

          {step === "vehicle" && quote && (
            <section id="quote-results" tabIndex={-1} aria-live="polite">
              <div className="form-heading compact"><div><span className="kicker">Price & vehicle</span><h2 ref={stepHeading} tabIndex={-1}>Choose what fits</h2></div><button className="text-button" onClick={() => setStep("journey")}>Edit journey</button></div>
              <div className="journey-summary"><strong>{journey.pickup}</strong><span>to</span><strong>{journey.destination}</strong><small>{journey.passengers} {journey.passengers === 1 ? "passenger" : "passengers"} · {journey.luggage} {journey.luggage === 1 ? "bag" : "bags"} · {quote.distanceKm} km · about {quote.durationMin} min · {quote.pricingVersion}</small></div>
              {(quote.positioning?.feeCents ?? 0) > 0 && <p className="positioning-note">Includes a {money(quote.positioning!.feeCents)} driver travel fee — your pickup is about {quote.positioning!.minutes} min from our {quote.positioning!.from.split(",")[0]} base.</p>}
              {vansOnly && <p className="review-notice vans-only">Only vans are running at the moment. The price is for the whole van, not per person.</p>}
              {quote.state === "manual_review" && <div className="review-notice">Operations needs to review {(quote.reviewReasons?.length?quote.reviewReasons:reviewReasons(journey,quote.distanceKm)).join(", ")||"your journey requirements"} before finding a suitable driver. No payment is due during review.</div>}
              <div className="vehicle-options">
                {quote.vehicles.map((vehicle) => <label className={`vehicle-option ${selectedVehicle === vehicle.id ? "chosen" : ""}`} key={vehicle.id}>
                  <input type="radio" name="vehicle" value={vehicle.id} checked={selectedVehicle === vehicle.id} onChange={() => setSelectedVehicle(vehicle.id)} />
                  <span className="vehicle-icon" aria-hidden="true">{vehicle.id === "accessible" ? "♿" : vehicle.id === "xl" ? "▰" : "◆"}</span>
                  <span className="vehicle-main"><span>{vehicle.name}{vehicle.badge && <em>{vehicle.badge}</em>}</span><small>Seats up to {vehicle.capacity} passengers · {vehicle.luggage} bags</small><small>{vehicle.note}</small></span>
                  <span className="vehicle-price"><strong>{money(vehicle.priceCents)}</strong><small>incl. GST</small></span>
                </label>)}
              </div>
              <button className="price-toggle" type="button" aria-expanded={expandedPrice} onClick={() => setExpandedPrice(!expandedPrice)}>What’s included in the total? <span>{expandedPrice ? "−" : "+"}</span></button>
              {expandedPrice && selected && <div className="breakdown reveal">
                {quote.breakdown.map((item) => <div key={item.label}><span>{item.label}</span><span>{money(item.amountCents)}</span></div>)}
                {selected.journeyMultiplier !== 1 && <div><span>Long-distance journey factor</span><span>{selected.journeyMultiplier}×</span></div>}
                {selected.multiplier !== 1 && <div><span>{selected.name} vehicle factor</span><span>{selected.multiplier}×</span></div>}
                {selected.petFeeCents > 0 && <div><span>Pet request</span><span>{money(selected.petFeeCents)}</span></div>}
                {(selected.positioningFeeCents ?? 0) > 0 && quote.positioning && <div><span>Driver travel to pickup ({quote.positioning.minutes} min from {quote.positioning.from.split(",")[0]})</span><span>{money(selected.positioningFeeCents ?? 0)}</span></div>}
                <div><span>{selected.gstLabel}</span><span>{money(selected.gstIncludedCents)}</span></div>
                <div className="breakdown-total"><strong>Selected total</strong><strong>{money(selected.priceCents)}</strong></div>
                <p>{quote.explanation}</p>
              </div>}
              <p className="quote-lock">{quoteExpired?"This five-minute quote has expired. Refresh the price before continuing.":"Quote held for "+Math.floor(secondsLeft/60)+":"+String(secondsLeft%60).padStart(2,"0")+" more. Expires at "+new Date(quote.lockedUntil).toLocaleTimeString("en-NZ",{timeZone:"Pacific/Auckland",hour:"numeric",minute:"2-digit"})+", New Zealand time. A changed or expired journey needs a new quote."}</p>{quoteExpired&&<button type="button" className="button button-ghost" disabled={loading} onClick={()=>void requestQuote()}>Refresh journey price</button>}
              {error && <><div className="error-summary" role="alert">{error}</div>{recovery}</>}
              <button className="button button-primary button-wide" onClick={() => setStep("details")} disabled={!selectedVehicle||quoteExpired}>Continue with {selected?.name}<span aria-hidden="true">→</span></button>
            </section>
          )}

          {step === "details" && quote && selected && (
            <form onSubmit={confirmBooking}>
              <div className="form-heading compact"><div><span className="kicker">Guest booking</span><h2 ref={stepHeading} tabIndex={-1}>Who is travelling?</h2></div><button className="text-button" type="button" onClick={() => setStep("vehicle")}>Back</button></div>
              <label className="toggle-line"><input type="checkbox" checked={bookingForOther} onChange={(e) => setBookingForOther(e.target.checked)} /> I’m booking for someone else</label>
              {bookingForOther && <p>Enter the passenger contact details below. Their email receives the private booking link and payment updates. Add coordinator instructions in the notes.</p>}
              <label>Passenger name<input required maxLength={100} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} autoComplete="name" /></label>
              <div className="form-row">
                <label>Mobile number<input required value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} type="tel" autoComplete="tel" placeholder="e.g. 027 123 4567" /><small className="phone-help">NZ numbers are welcome — no +64 needed.</small></label>
                <label>Email address<input required maxLength={254} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} type="email" autoComplete="email" /></label>
              </div>
              <label>Pickup or assistance notes <span className="optional">optional</span><textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="Entrance, landmark or anything that would make the trip easier" /></label>
              <section className="booking-review" aria-labelledby="booking-review-heading"><h3 id="booking-review-heading">Review your request</h3><JourneySummary journey={journey} notes={customer.notes}/><p>{customer.name||"Passenger name to be entered"} · {customer.phone||"Phone to be entered"} · {customer.email||"Email to be entered"}</p><button type="button" className="text-button" onClick={()=>setStep("journey")}>Edit journey and requirements</button><button type="button" className="text-button" onClick={()=>setStep("vehicle")}>Change vehicle</button></section>
              {quoteExpired&&<div className="error-summary" role="alert">Your five-minute quote has expired. Refresh the price and review it again.<button type="button" className="button button-ghost" disabled={loading} onClick={()=>void requestQuote()}>Refresh journey price</button></div>}
              <p className="payment-choices">No payment online. You pay your driver in person (cash or EFTPOS) for the journey. Contact operations for corporate arrangements.</p>
              <div className="review-total"><span>{selected.name}<small>{journey.when === "now" ? "Pickup requested now" : `${journey.date} at ${journey.time}`}</small></span><strong>{money(selected.priceCents)}<small>total NZD</small></strong></div>
              <p className="preview-truth">Your request is saved first. Operations reviews your quoted fare and assigns a suitable driver, then emails your confirmation. Cancel before your trip starts at no charge.</p>
              <label className="toggle-line"><input type="checkbox" required checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} /><span>I accept the <Link href="/terms">terms and cancellation policy</Link>.</span></label>
              {error && <><div className="error-summary" role="alert">{error}</div>{recovery}</>}
              <button className="button button-primary button-wide" disabled={loading||quoteExpired}>{loading ? "Preparing your request…" : "Submit booking request"}<span aria-hidden="true">→</span></button>
              <p className="terms">We use your contact details to fulfil this request; see our <Link href="/privacy">privacy policy</Link>.</p>
            </form>
          )}

          {step === "confirmed" && booking && (
            <section className="confirmation" id="confirmation" tabIndex={-1}>
              <span className="confirmation-mark" aria-hidden="true">✓</span>
              <p className="eyebrow">Awaiting availability confirmation</p>
              <h2>Your request is safely recorded.</h2>
              <p className="reference">Booking reference <strong>{booking.reference}</strong></p>
              {booking.paymentMessage && <p role="status">{booking.paymentMessage}</p>}
              <div className="confirmation-route"><span>{journey.pickup}</span><i /><span>{journey.destination}</span></div>
              <div className="truth-status"><strong>No driver assigned yet</strong><span>We are checking availability. Pay only after operations accepts your request and assigns a suitable driver.</span></div>
              <div className="confirmation-actions"><Link className="button button-primary" href={`/manage-booking?ref=${booking.reference}#token=${booking.accessToken}`}>Manage booking</Link><button className="button button-ghost" type="button" onClick={() => navigator.clipboard?.writeText(booking.reference)}>Copy reference</button></div>
              <button className="text-button" type="button" onClick={resetBooking}>Book another ride</button>
            </section>
          )}
        </div>
      </section>

      {enquiry && <EnquiryForm key={enquiry} kind="journey" initialDetails={enquiry} title="Send your journey to operations" initialContact={customer} submissionAvailable={requestSubmissionAvailable} estimate={enquiryEstimate} estimateError={estimateError} />}
      <section className="trust-strip" aria-label="Service commitments">
        <span><b>01</b> Driver checks required</span><span><b>02</b> Upfront total</span><span><b>03</b> Guest booking</span><span><b>04</b> Human support</span>
      </section>

      <section className="steps section-pad">
        <div className="section-heading"><span className="eyebrow">Simple by design</span><h2>From address to answer<br />in three clear steps.</h2></div>
        <div className="step-grid"><article><b>01</b><h3>Enter your journey</h3><p>Tell us where, when and how many people are travelling.</p></article><article><b>02</b><h3>Choose your vehicle</h3><p>Compare only vehicles that fit your trip and requirements.</p></article><article><b>03</b><h3>Confirm, then ride</h3><p>Submit your request for free. We email your confirmation after operations accepts and assigns a driver. Pay your driver in person.</p></article></div>
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
        <div className="vehicle-preview-grid">{vehiclePreviews.map(([name, capacity, note], index) => <article key={name}><VehicleIcon kind={(["van", "accessible"] as const)[index]} /><span>0{index + 1}</span><h3>{name}</h3><strong>{capacity}</strong><p>{vansOnly && index === 1 ? "Not available right now. Only vans are running." : note}</p></article>)}</div>
      </section>

      <section className="access-feature section-pad">
        <div className="access-intro"><span className="access-icon"><WheelchairIcon /></span><span className="eyebrow">Accessible travel</span><h2>A smoother trip,<br />built around you.</h2><p>Tell us what would make your journey easier. We’ll match the vehicle and assistance to your needs.</p></div>
        <div className="access-details"><h3>Plan your support before pickup</h3><ul><li>Ramp or hoist requirements</li><li>Passenger remaining in wheelchair</li><li>Service animals and support people</li><li>Extra boarding time and assistance</li></ul><Link href="#journey-form" className="button button-primary" onClick={() => update("accessible", true)}>{vansOnly ? "Ask about accessible travel" : "Book an accessible vehicle"} <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className="north-island section-pad">
        <div className="north-copy"><span className="eyebrow">Beyond Auckland</span><h2>One driver.<br />Your itinerary.</h2><p>Private transfers and tours across the North Island, shaped around your group, luggage, stops and pace.</p><div className="destination-list"><span>Hamilton</span><span>Rotorua</span><span>Taupō</span><span>Bay of Islands</span><span>Waitomo</span><span>Wellington</span></div><Link className="inline-link" href="/north-island-transfers">Plan a North Island journey <span>→</span></Link></div>
        <figure className="island-route"><Image unoptimized src="/images/north-island-map-clean.webp" alt="Illustrated North Island route from Auckland through Rotorua to Wellington" width={1122} height={1402} loading="lazy" decoding="async" /><span className="city auckland">Auckland</span><span className="city rotorua">Rotorua</span><span className="city wellington">Wellington</span></figure>
      </section>

      <section className="support section-pad"><div><span className="eyebrow amber">Prefer a person?</span><h2>Help for the journeys that need it.</h2></div><p>Booking support covers airport, accessible, family and complex North Island journeys.</p><Link href="/help">Open booking support <span>Visit the help centre</span></Link></section>

    </main>
  );
}

