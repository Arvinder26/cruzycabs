"use client";

import { bookingStatusLabel } from "../lib/journey-presentation";

export type RequestRow = {
  id: string; reference: string; kind: string; name: string; email: string; phone: string;
  data_json: string; state: string; created_at: string; booking_reference?: string | null;
  booking_status?: string | null; acceptance_email_state?: string | null;
};

type Action = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
type DriverChoice = { id: string; name: string; plate: string; status: string; approved: number; compliance_until: string | null; vehicle_compliance_until: string | null };
export function OperationsRequests({ requests, page, pageSize, total, requestStatus, setRequestStatus, setRequestPage, drivers, bookingsEnabled, cardPayments, disabled, admin, onAction, onFindBooking }: {
  requests: RequestRow[]; page: number; pageSize: number; total: number; requestStatus: string;
  setRequestStatus: (value: string) => void; setRequestPage: (value: number) => void;
  drivers: DriverChoice[]; bookingsEnabled: boolean; cardPayments: boolean; disabled: boolean; admin: boolean;
  onAction: Action; onFindBooking: (reference: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const availableDrivers = drivers.filter(driver => driver.approved && (driver.status === "available" || driver.status === "on_job") && driver.compliance_until && driver.vehicle_compliance_until && driver.compliance_until > today && driver.vehicle_compliance_until > today);
  return <section><h2>General enquiries and cases</h2><p>Journey enquiries have no saved quote. Accept one by entering the agreed GST-inclusive fare and selecting an approved driver. The customer’s submitted journey cannot be edited here.</p>
    <label>Case status<select value={requestStatus} onChange={event => { setRequestStatus(event.target.value); setRequestPage(1); }}><option value="active">Open and accepted</option><option value="all">All cases</option></select></label>
    <nav className="operations-pagination" aria-label="Case pages"><span>{total} matching cases · Page {page}</span><button type="button" className="button button-ghost" disabled={disabled || page <= 1} onClick={() => setRequestPage(page - 1)}>Previous cases</button><button type="button" className="button button-ghost" disabled={disabled || page * pageSize >= total} onClick={() => setRequestPage(page + 1)}>Next cases</button></nav>
    {requests.length === 0 && <p>No enquiries match this filter.</p>}
    {requests.map(request => {
      const details = (JSON.parse(request.data_json) as { details?: string }).details || "";
      const hasSubmittedJourney = details.startsWith("Journey request\n") || details.startsWith("Journey request\r\n");
      const received = new Date(request.created_at).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" });
      return <article className="ops-panel" key={request.id}>
        <h3>{request.reference} · {request.kind} · {request.state}</h3>
        <p><strong>Received:</strong> {received} NZ time</p>
        <p>{request.name} · <a href={`mailto:${request.email}`}>{request.email}</a> · <a href={`tel:${request.phone}`}>{request.phone}</a></p>
        <p className="request-details">{details}</p>
        {request.booking_reference && <p><strong>Booking offer:</strong> {request.booking_reference} · {bookingStatusLabel(request.booking_status || "", "", "staff")}. <button className="text-button" type="button" onClick={() => onFindBooking(request.booking_reference!)}>Find in Bookings</button></p>}
        {request.state === "accepted" && <p role="status">Customer email: {request.acceptance_email_state === "sent" ? "accepted by email provider" : request.acceptance_email_state === "failed" ? "delivery failed — retry needed" : "queued for delivery"}.</p>}
        {request.state === "accepted" && admin && request.acceptance_email_state !== "sent" && <button type="button" className="button button-ghost" disabled={disabled} onClick={() => void onAction({ action: "retry_request_email", id: request.id })}>Retry customer email</button>}
        {request.state === "open" && hasSubmittedJourney && ["journey", "accessibility", "tour", "corporate"].includes(request.kind) && <div className="panel-actions"><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const fare = String(form.get("fare") || ""); if (!/^\d+(?:\.\d{1,2})?$/.test(fare)) return; const priceCents = Math.round(Number(fare) * 100); void onAction({ action: "accept_request", id: request.id, priceCents, driverId: form.get("driverId"), paymentMethod: form.get("paymentMethod"), verified: form.get("verified") === "on" }); }}>
          <label>Agreed total, NZD including GST<input name="fare" type="number" min="1" max="100000" step="0.01" inputMode="decimal" required /></label>
          <label>Assign approved driver<select name="driverId" required><option value="">Choose a driver</option>{availableDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.plate}{driver.status === "on_job" ? " · has other bookings" : ""}</option>)}</select></label>
          {cardPayments && bookingsEnabled ? <fieldset className="payment-choice"><legend>How will the customer pay?</legend>
            <label className="toggle-line"><input type="radio" name="paymentMethod" value="in_person" defaultChecked required /> In person to the driver (cash or EFTPOS)</label>
            <label className="toggle-line"><input type="radio" name="paymentMethod" value="card" /> Card online through Stripe</label>
          </fieldset> : <><input type="hidden" name="paymentMethod" value="in_person" /><p>The customer pays the driver in person (cash or EFTPOS).</p></>}
          <label className="toggle-line"><input type="checkbox" name="verified" required /> I reviewed the customer’s journey, fare, driver suitability and service area.</label>
          <button type="submit" className="button button-primary" disabled={disabled || availableDrivers.length === 0}>Accept and email review link</button>
        </form><button type="button" className="button button-ghost" disabled={disabled} onClick={() => { const note = window.prompt("Reason for declining this journey enquiry:"); if (note?.trim()) void onAction({ action: "decline_request", id: request.id, note }); }}>Decline enquiry</button></div>}
        {request.state === "open" && <button disabled={disabled} className="button button-ghost" onClick={() => { const note = window.prompt("Resolution and follow-up notes:"); if (note) void onAction({ action: "resolve_request", id: request.id, note }); }}>Resolve case</button>}
      </article>;
    })}
  </section>;
}
