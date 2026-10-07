"use client";

import { FormEvent, useMemo, useState, type CSSProperties } from "react";
import { AddressAutocomplete, type AddressSelection } from "./AddressAutocomplete";
import { EnquiryForm } from "./EnquiryForm";

type TourStop = {
  id: string;
  name: string;
  region: string;
  label: string;
  detail: string;
  time: string;
  latitude: number;
  longitude: number;
  visitHours: number;
};

const hotspots: TourStop[] = [
  { id: "hobbiton", name: "Hobbiton", region: "Waikato", label: "Step into Middle-earth", detail: "Rolling farmland and the famous movie set near Matamata.", time: "Half day", latitude: -37.8721, longitude: 175.6832, visitHours: 4 },
  { id: "waitomo", name: "Waitomo Caves", region: "Waikato", label: "Glow beneath the surface", detail: "An underground experience that pairs naturally with Hobbiton.", time: "Half day", latitude: -38.2607, longitude: 175.103, visitHours: 4 },
  { id: "rotorua", name: "Rotorua", region: "Bay of Plenty", label: "Feel the earth come alive", detail: "Geothermal valleys, lakes and Māori cultural experiences.", time: "Full day", latitude: -38.1368, longitude: 176.2497, visitHours: 7 },
  { id: "taupo", name: "Taupō and Huka Falls", region: "Central North Island", label: "Chase the lake and falls", detail: "A lakeside stop with the force of Huka Falls nearby.", time: "Half to full day", latitude: -38.6857, longitude: 176.0702, visitHours: 5 },
  { id: "tongariro", name: "Tongariro", region: "Ruapehu", label: "Walk the volcanic horizon", detail: "Dramatic alpine scenery with timing shaped around the season.", time: "Full day", latitude: -39.2727, longitude: 175.5802, visitHours: 7 },
  { id: "bay-of-islands", name: "Bay of Islands", region: "Northland", label: "Sail into living history", detail: "Island views, waterfront towns and time around Waitangi.", time: "1 to 2 days", latitude: -35.2822, longitude: 174.0913, visitHours: 9 },
  { id: "coromandel", name: "The Coromandel", region: "Waikato", label: "Escape to the coast", detail: "Forest roads, beach towns and a relaxed coastal pace.", time: "Full day", latitude: -36.8333, longitude: 175.7, visitHours: 7 },
  { id: "wellington", name: "Wellington", region: "Wellington", label: "Taste the creative capital", detail: "Food, culture and harbour views at the southern end of the island.", time: "1 to 2 days", latitude: -41.2866, longitude: 174.7756, visitHours: 10 },
];

const AUCKLAND = { latitude: -36.8485, longitude: 174.7633 };

function directDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radius = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function TourPlanner() {
  const [selected, setSelected] = useState<string[]>(["hobbiton", "rotorua"]);
  const [customStops, setCustomStops] = useState<AddressSelection[]>([]);
  const [customValue, setCustomValue] = useState("");
  const [customSelection, setCustomSelection] = useState<AddressSelection | null>(null);
  const [pace, setPace] = useState("Balanced");
  const [startDate, setStartDate] = useState("");
  const [passengers, setPassengers] = useState("2");
  const [pickup, setPickup] = useState("");
  const [notes, setNotes] = useState("");
  const [accessible, setAccessible] = useState(false);
  const [message, setMessage] = useState("");
  const [brief, setBrief] = useState("");

  const chosenHotspots = useMemo(
    () => selected.map((id) => hotspots.find((hotspot) => hotspot.id === id)).filter((stop): stop is TourStop => Boolean(stop)),
    [selected],
  );
  const destinationCount = chosenHotspots.length + customStops.length;
  const estimate = useMemo(() => {
    const knownStops = chosenHotspots.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude, visitHours: stop.visitHours }));
    const ownStops = customStops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude, visitHours: 4 }));
    const stops = [...knownStops, ...ownStops];
    if (!stops.length) return { days: 0, distanceKm: 0, drivingHours: 0, visitHours: 0 };

    let previous = AUCKLAND;
    let directKm = 0;
    let visitHours = 0;
    for (const stop of stops) {
      visitHours += stop.visitHours;
      if (stop.latitude !== null && stop.longitude !== null) {
        const next = { latitude: stop.latitude, longitude: stop.longitude };
        directKm += directDistanceKm(previous, next);
        previous = next;
      }
    }
    const distanceKm = Math.round((directKm * 1.24) / 10) * 10;
    const drivingHours = distanceKm / 72;
    const usableHours = pace === "Relaxed" ? 6.5 : pace === "See more each day" ? 10.5 : 8.5;
    return {
      days: Math.max(1, Math.ceil((drivingHours + visitHours) / usableHours)),
      distanceKm,
      drivingHours: Math.max(distanceKm ? 1 : 0, Math.round(drivingHours)),
      visitHours,
    };
  }, [chosenHotspots, customStops, pace]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setMessage("");
  }

  function addCustomStop() {
    if (!customSelection) {
      setMessage("Choose a destination from the search suggestions, or confirm the place as entered.");
      return;
    }
    if (customStops.some((stop) => stop.id === customSelection.id || stop.label === customSelection.label)) {
      setMessage("That destination is already in your tour brief.");
      return;
    }
    setCustomStops((current) => [...current, customSelection]);
    setCustomValue("");
    setCustomSelection(null);
    setMessage("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!destinationCount) {
      setMessage("Choose at least one destination so we can shape your route.");
      return;
    }
    const length = `${estimate.days} ${estimate.days === 1 ? "day" : "days"}`;
    setBrief(`Private tour enquiry\nPreferred start: ${startDate || "Flexible"}\nTravellers: ${passengers}\nPickup: ${pickup || "To be arranged"}\nStops: ${[...chosenHotspots.map(stop=>stop.name),...customStops.map(stop=>stop.label)].join(" → ")}\nPace: ${pace}\nAccessible assistance: ${accessible ? "Yes; please discuss equipment" : "No"}\nIndicative duration: ${length}; requires road route and operating review\nNotes: ${notes}`);
    setMessage("Your brief is ready. Complete your contact details below to send it to operations.");
  }

  return <section className="tour-planner section-pad" id="tour-planner">
    <div className="section-heading split">
      <div><span className="eyebrow">Build your private tour</span><h2>Start with the places you cannot miss.</h2></div>
      <p>Choose the moments that matter. We will shape a realistic private route around your group, pace and accommodation rather than forcing you into a fixed coach itinerary.</p>
    </div>
    <form onSubmit={submit}>
      <fieldset className="tour-stop-fieldset">
        <legend className="sr-only">Choose North Island tour stops</legend>
        <div className="tour-stop-grid">
          {hotspots.map((hotspot, index) => {
            const checked = selected.includes(hotspot.id);
            return <label className={`tour-stop ${checked ? "selected" : ""}`} key={hotspot.id} style={{ "--delay": `${index * 45}ms` } as CSSProperties}>
              <input type="checkbox" checked={checked} onChange={() => toggle(hotspot.id)} />
              <span className="tour-check" aria-hidden="true">{checked ? "✓" : "+"}</span>
              <small>{hotspot.region}</small>
              <strong>{hotspot.name}</strong>
              <em>{hotspot.label}</em>
              <p>{hotspot.detail}</p>
              <b>{hotspot.time}</b>
            </label>;
          })}
        </div>
        <div className="tour-custom-stop">
          <div><span className="kicker">Choose somewhere else</span><h3>Add your own destination.</h3><p>Search any New Zealand town, landmark, accommodation or address and add it to the same itinerary.</p></div>
          <div>
            <AddressAutocomplete
              label="Destination search"
              value={customValue}
              selection={customSelection}
              placeholder="Try Napier, Raglan or your own address"
              destination
              onChange={(value) => { setCustomValue(value); setCustomSelection(null); }}
              onSelect={(selection) => { setCustomValue(selection.label); setCustomSelection(selection); }}
            />
            <button className="button button-primary" type="button" disabled={!customSelection} onClick={addCustomStop}>Add destination</button>
          </div>
        </div>
      </fieldset>
      <div className="tour-brief">
        <div className="tour-brief-heading"><span className="kicker">Your tour brief</span><strong>{destinationCount} selected</strong></div>
        <div className="tour-selected" aria-live="polite">
          {destinationCount ? <>
            {chosenHotspots.map((stop, index) => <span key={stop.id}><b>{String(index + 1).padStart(2, "0")}</b>{stop.name}<button type="button" aria-label={`Remove ${stop.name}`} onClick={() => toggle(stop.id)}>×</button></span>)}
            {customStops.map((stop, index) => <span key={stop.id}><b>{String(chosenHotspots.length + index + 1).padStart(2, "0")}</b>{stop.primary}<button type="button" aria-label={`Remove ${stop.primary}`} onClick={() => setCustomStops((current) => current.filter((item) => item.id !== stop.id))}>×</button></span>)}
          </> : <p>No stops selected yet.</p>}
        </div>
        <div className="tour-estimate" aria-live="polite">
          <span>Suggested trip length</span>
          <strong>{estimate.days ? `${estimate.days} ${estimate.days === 1 ? "day" : "days"}` : "Choose a stop"}</strong>
          {estimate.days > 0 && <small>{estimate.distanceKm > 0 ? `About ${estimate.distanceKm} km driving, ` : ""}{estimate.visitHours} hours set aside for experiences. Final timing is route-checked by your planner.</small>}
        </div>
        <div className="tour-form-grid">
          <label>Tour pace<select value={pace} onChange={(event) => setPace(event.target.value)}><option>Relaxed</option><option>Balanced</option><option>See more each day</option></select></label>
          <label>Preferred start<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>Travellers<select value={passengers} onChange={(event) => setPassengers(event.target.value)}>{[1,2,3,4,5,6,7,8,9,10,11].map((number) => <option value={number} key={number}>{number}</option>)}</select></label>
        </div>
        <label>Pickup or accommodation<input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Auckland address, hotel or airport terminal" /></label>
        <label>What would make this trip special?<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Interests, celebrations, accommodation plans or places you would like to linger" /></label>
        <label className="tour-access"><input type="checkbox" checked={accessible} onChange={(event) => setAccessible(event.target.checked)} /> We need an accessible vehicle or extra assistance</label>
        {message && <div className={destinationCount ? "tour-message success" : "tour-message"} role="status">{message}</div>}
        <button className="button button-primary button-wide">Prepare my private tour brief <span aria-hidden="true">→</span></button>
        <p className="tour-assurance">No payment today. A planner confirms timing, inclusions and the final quote before you commit.</p>
      </div>
    </form>
    {brief && <EnquiryForm kind="tour" initialDetails={brief} title="Send your tour brief to operations" />}
  </section>;
}
