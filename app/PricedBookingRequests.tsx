"use client";

import { vehicleName } from "../lib/journey-presentation";
import { JourneySummary } from "./JourneySummary";

export type PricedRequestRow = {
  id: string; reference: string; customer_name: string; customer_email: string; customer_phone: string;
  vehicle_id: string; journey_json: string; requirements_json: string; created_at: string; price_cents: number;
};

type DriverChoice = { id: string; name: string; plate: string; class: string; status: string; approved: number; passengers: number; luggage: number; capabilities: string; compliance_until: string | null; vehicle_compliance_until: string | null };
type Action = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;

export function PricedBookingRequests({ requests, page, pageSize, total, setPage, drivers, disabled, bookingsEnabled, onAction }: {
  requests: PricedRequestRow[]; page: number; pageSize: number; total: number; setPage: (value: number) => void;
  drivers: DriverChoice[]; disabled: boolean; bookingsEnabled: boolean; onAction: Action;
}) {
  return <section>
    <h2>Priced booking requests</h2>
    <p>The customer submitted these journey details and the quoted total. Accept with a suitable approved driver, or decline. The fare and journey cannot be edited here.</p>
    {!bookingsEnabled && <p role="status">Online booking decisions are paused until operations activates bookings.</p>}
    <nav className="operations-pagination" aria-label="Priced request pages"><span>{total} awaiting a decision · Page {page}</span><button type="button" className="button button-ghost" disabled={disabled || page <= 1} onClick={() => setPage(page - 1)}>Previous bookings</button><button type="button" className="button button-ghost" disabled={disabled || page * pageSize >= total} onClick={() => setPage(page + 1)}>Next bookings</button></nav>
    {requests.length === 0 && <p>No priced bookings are waiting for a decision.</p>}
    {requests.map(request => {
      const journey = JSON.parse(request.journey_json);
      const requirements = JSON.parse(request.requirements_json) as { notes?: string };
      const today = new Date().toISOString().slice(0, 10);
      const choices = drivers.filter(driver => {
        if (!["available", "on_job"].includes(driver.status) || !driver.approved || driver.class !== request.vehicle_id || !driver.compliance_until || !driver.vehicle_compliance_until || driver.compliance_until <= today || driver.vehicle_compliance_until <= today || driver.passengers < journey.passengers || driver.luggage < journey.luggage) return false;
        try {
          const capabilities = JSON.parse(driver.capabilities || "[]") as string[];
          return Array.isArray(capabilities) && (!journey.accessible || capabilities.includes(journey.wheelchair)) && (!journey.childSeat || capabilities.includes("child-seat")) && (!journey.pet || capabilities.includes("pet"));
        } catch { return false; }
      });
      const requested = new Date(request.created_at).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" });
      return <article className="ops-panel" key={request.id}>
        <div className="panel-head"><strong>{request.reference}</strong><span>Awaiting decision</span></div>
        <p><strong>Requested:</strong> {requested} NZ time</p>
        <p>{request.customer_name} · <a href={`mailto:${request.customer_email}`}>{request.customer_email}</a> · <a href={`tel:${request.customer_phone}`}>{request.customer_phone}</a></p>
        <p><strong>Customer quoted total:</strong> NZD {(request.price_cents / 100).toFixed(2)} including GST · {vehicleName(request.vehicle_id)}</p>
        <JourneySummary journey={journey} notes={requirements.notes} />
        <div className="panel-actions">
          <form onSubmit={event => { event.preventDefault(); const driverId = new FormData(event.currentTarget).get("driverId"); void onAction({ action: "accept_booking", reference: request.reference, driverId }); }}>
            <label>Assign approved driver<select name="driverId" required><option value="">Choose a driver</option>{choices.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.plate}</option>)}</select></label>
            <button className="button button-primary" disabled={disabled || !bookingsEnabled || choices.length === 0}>Accept and email booking link</button>
          </form>
          <button className="button button-ghost" type="button" disabled={disabled || !bookingsEnabled} onClick={() => { const note = window.prompt("Reason for declining this quoted booking:"); if (note?.trim()) void onAction({ action: "decline_booking", reference: request.reference, note }); }}>Decline booking</button>
        </div>
        <p>The customer sees the assigned driver on their private booking page and pays the driver in person (cash or EFTPOS).</p>
      </article>;
    })}
  </section>;
}
