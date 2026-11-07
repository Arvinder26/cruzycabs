import { getD1 } from "./d1";
import { shortReference } from "./booking-reference";
import { requireNoDriverClash } from "./driver-schedule";
import { bookingsEnabled, cardPaymentsEnabled, setting } from "./config";
import { managementLink } from "./notifications";
import { HttpError, managementToken, sha, text } from "./security";
import { validateJourney } from "./validation";

export const convertibleEnquiryKinds = ["journey", "accessibility", "tour", "corporate"];

export function journeyFromEnquiry(details: string) {
  const lines = details.split(/\r?\n/);
  if (lines.shift()?.trim() !== "Journey request") throw new HttpError("This enquiry has no complete journey. Ask the customer to submit a new journey request.", 422);
  const fields = new Map<string, string>();
  for (const line of lines) {
    const match = /^([^:]+):(?: (.*))?$/.exec(line);
    if (!match) throw new HttpError("This journey request needs customer clarification before acceptance.", 422);
    const key = match[1], value = (match[2] || "").trim();
    if (fields.has(key)) throw new HttpError("This journey request contains repeated details. Ask the customer to clarify.", 422);
    fields.set(key, value);
  }
  const required = (key: string) => {
    const value = fields.get(key);
    if (!value || value === "To be arranged") throw new HttpError(`The customer must confirm ${key.toLowerCase()} before this enquiry can be accepted.`, 422);
    return value;
  };
  const pickupTime = required("Pickup time");
  const scheduled = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) New Zealand time$/.exec(pickupTime);
  if (!scheduled && pickupTime !== "As soon as available") throw new HttpError("The pickup time needs customer clarification before acceptance.", 422);
  const wheelchair = fields.get("Wheelchair assistance") || "No";
  const via = fields.get("Via") || "Direct";
  if (!["No", "ramp", "hoist", "transfer"].includes(wheelchair) || !["Yes", "No"].includes(required("Child seat")) || !["Yes", "No"].includes(required("Pet"))) throw new HttpError("This enquiry's equipment requirements need customer clarification.", 422);
  return validateJourney({
    pickup: required("Pickup"), destination: required("Destination"),
    when: scheduled ? "schedule" : "now", date: scheduled?.[1] || "", time: scheduled?.[2] || "",
    stops: via === "Direct" ? [] : via.split(" → "),
    passengers: Number(required("Passengers")), luggage: Number(required("Luggage")),
    accessible: wheelchair !== "No", wheelchair: wheelchair === "No" ? "" : wheelchair,
    childSeat: required("Child seat") === "Yes", pet: required("Pet") === "Yes",
    airportTerminal: fields.get("Terminal") === "Not supplied" ? "" : fields.get("Terminal") || "",
    flightNumber: fields.get("Flight") === "Not supplied" ? "" : fields.get("Flight") || "",
  });
}

type Enquiry = { id: string; reference: string; kind: string; name: string; email: string; phone: string; data_json: string; state: string; created_at: string };
type AcceptedBooking = { id: string; reference: string; status: string; fingerprint: string };

export async function acceptEnquiryAsBooking(body: Record<string, unknown>, actor: string) {
  const paymentMethod = body.paymentMethod === undefined ? "card" : body.paymentMethod;
  if (paymentMethod !== "card" && paymentMethod !== "in_person") throw new HttpError("Choose card payment online or payment to the driver in person.");
  const inPerson = paymentMethod === "in_person";
  if (!setting("RESEND_API_KEY") || !setting("EMAIL_FROM")) throw new HttpError("Email must be ready before accepting this enquiry.", 503);
  if (!inPerson && (!cardPaymentsEnabled() || !bookingsEnabled() || !setting("STRIPE_SECRET_KEY") || !setting("STRIPE_WEBHOOK_SECRET"))) throw new HttpError("Online card payment is not available. Choose payment to the driver in person instead.", 503);
  const requestId = text(body.id, "Enquiry", 64);
  const enquiry = await getD1().prepare("SELECT id,reference,kind,name,email,phone,data_json,state,created_at FROM app_requests WHERE id=?").bind(requestId).first<Enquiry>();
  if (!enquiry) throw new HttpError("Enquiry not found.", 404);
  if (!convertibleEnquiryKinds.includes(enquiry.kind)) throw new HttpError("This kind of enquiry cannot become a journey booking.", 422);
  if (enquiry.state === "accepted") {
    const accepted = await getD1().prepare("SELECT b.reference,b.status,d.price_cents,a.driver_id FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id JOIN app_assignments a ON a.booking_id=b.id AND a.state='accepted' WHERE b.idempotency_key=?").bind(`enquiry:${requestId}`).first<{reference:string;status:string;price_cents:number;driver_id:string}>();
    if (accepted && accepted.driver_id === body.driverId && accepted.price_cents === body.priceCents) return { reference: accepted.reference, status: accepted.status, emailState: await acceptanceEmailState(requestId) };
    throw new HttpError("This enquiry has already been accepted with a different fare or driver. Open its booking record.", 409);
  }
  const details = JSON.parse(enquiry.data_json) as { details?: string };
  const journey = journeyFromEnquiry(details.details || "");
  const driverId = text(body.driverId, "Driver", 64);
  const now = new Date().toISOString();
  const driver = await getD1().prepare("SELECT d.name,d.email,d.compliance_until,v.class,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_expiry,v.plate,v.description FROM app_drivers d JOIN app_vehicles v ON v.driver_id=d.id WHERE d.id=? AND d.approved=1 AND d.status IN ('available','on_job') AND v.active=1").bind(driverId).first<{name:string;email:string;compliance_until:string;class:string;passengers:number;luggage:number;capabilities:string;vehicle_expiry:string;plate:string;description:string}>();
  let capabilities: string[] = [];
  try { const parsed = JSON.parse(driver?.capabilities || "[]"); if (Array.isArray(parsed)) capabilities = parsed; } catch { /* Reject invalid driver capabilities below. */ }
  if (!driver || !driver.compliance_until || !driver.vehicle_expiry || driver.compliance_until <= now.slice(0,10) || driver.vehicle_expiry <= now.slice(0,10) || driver.passengers < journey.passengers || driver.luggage < journey.luggage || (journey.accessible && !capabilities.includes(journey.wheelchair || "")) || (journey.childSeat && !capabilities.includes("child-seat")) || (journey.pet && !capabilities.includes("pet"))) throw new HttpError("The selected driver or vehicle cannot meet this journey's capacity, equipment and compliance requirements.", 422);
  const vehicleId = driver.class;
  if (!["xl", "accessible"].includes(vehicleId) || (journey.accessible && vehicleId !== "accessible")) throw new HttpError("This driver has an unsuitable vehicle class.", 422);
  const priceCents = body.priceCents;
  if (typeof priceCents !== "number" || !Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) throw new HttpError("Enter a proposed total between NZ$1 and NZ$100,000.");
  if (body.verified !== true) throw new HttpError("Confirm that the journey, vehicle suitability, service area and proposed fare were reviewed.");
  if (enquiry.state !== "open" && enquiry.state !== "accepted") throw new HttpError("Only an open enquiry can become a booking offer.", 409);

  const quoteId = await sha(`enquiry-quote:${requestId}`), bookingId = await sha(`enquiry-booking:${requestId}`);
  await requireNoDriverClash(driverId, bookingId, journey.scheduledAt);
  const reference = shortReference(bookingId);
  const idempotencyKey = `enquiry:${requestId}`;
  // Card offers keep their original fingerprint shape so earlier acceptances still retry safely.
  const fingerprint = await sha(JSON.stringify(inPerson ? { requestId, journey, vehicleId, driverId, priceCents, paymentMethod } : { requestId, journey, vehicleId, driverId, priceCents }));
  const existing = await getD1().prepare("SELECT b.id,b.reference,b.status,d.fingerprint FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.idempotency_key=?").bind(idempotencyKey).first<AcceptedBooking>();
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new HttpError("This enquiry already has a different booking offer. Open its booking record instead.", 409);
    if (enquiry.state !== "accepted") throw new HttpError("This enquiry has an incomplete booking offer. Contact operations before retrying.", 409);
    return { reference: existing.reference, status: existing.status, emailState: await acceptanceEmailState(requestId) };
  }
  if (enquiry.state !== "open") throw new HttpError("This enquiry was already accepted. Refresh to see its booking.", 409);

  const requirements = JSON.stringify({ notes: details.details?.match(/(?:^|\n)Notes: ?([^\n]*)/)?.[1] || "", originalEnquiry: details.details || "", bookingForOther: false, enquiryReference: enquiry.reference, enquiryCreatedAt: enquiry.created_at });
  const quoteResult = JSON.stringify({ state: "manual_review", currency: "NZD", vehicles: [{ id: vehicleId, priceCents }] });
  const privateLink = managementLink(reference, await managementToken(bookingId));
  const pickupTime = journey.when === "schedule" ? `${journey.date} at ${journey.time} New Zealand time` : "As soon as available";
  const emailText = [
    `Hello ${enquiry.name},`, "",
    `We have reviewed enquiry ${enquiry.reference} and prepared a provisional booking offer ${reference}.`, "",
    `Pickup: ${journey.pickup}`, `Destination: ${journey.destination}`,
    `Via: ${journey.stops?.join(" → ") || "Direct"}`, `Pickup time: ${pickupTime}`,
    `Vehicle: ${vehicleId === "accessible" ? "Accessible" : "Van"}`,
    `Proposed total: NZD ${(priceCents / 100).toFixed(2)} including GST`,
    `Assigned driver: ${driver.name}, ${driver.description} (${driver.plate})`, "",
    "Review the full details and our terms and cancellation policy, then confirm using this private link:",
    privateLink, "",
    inPerson
      ? "Confirm the offer and terms on that page. Payment is made to your driver in person (cash or EFTPOS) for the journey. If any detail or the fare is wrong, do not confirm; reply to operations instead."
      : "Confirm the offer and terms on that page, then pay securely by card through Stripe. The journey cannot start until payment is confirmed. If any detail or the fare is wrong, do not confirm; reply to operations instead.",
  ].join("\n");
  const eventId = await sha(`enquiry-booking-event:${requestId}`), auditId = await sha(`enquiry-booking-audit:${requestId}`);
  const outboxId = await sha(`enquiry-booking-email:${requestId}`), outboxKey = `enquiry-accepted:${requestId}`;
  await getD1().batch([
    getD1().prepare("INSERT INTO quotes(id,input_json,result_json,pricing_version,state,locked_until,created_at) SELECT ?,?,?,'operator-entered','manual_review',?,? WHERE EXISTS(SELECT 1 FROM app_requests WHERE id=? AND state='open') AND NOT EXISTS(SELECT 1 FROM quotes WHERE id=?)")
      .bind(quoteId, JSON.stringify(journey), quoteResult, new Date(Date.now() + 90 * 86400000).toISOString(), now, requestId, quoteId),
    getD1().prepare("INSERT INTO bookings(id,reference,quote_id,idempotency_key,vehicle_id,customer_name,customer_email,customer_phone,journey_json,requirements_json,payment_method,payment_state,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,'pending_customer_confirmation',?,? WHERE EXISTS(SELECT 1 FROM app_requests WHERE id=? AND state='open') AND EXISTS(SELECT 1 FROM quotes WHERE id=?) AND EXISTS(SELECT 1 FROM app_drivers WHERE id=? AND approved=1 AND status='available') AND NOT EXISTS(SELECT 1 FROM app_assignments WHERE driver_id=? AND state IN ('accepted','arrived','on_trip')) AND NOT EXISTS(SELECT 1 FROM bookings WHERE idempotency_key=?)")
      .bind(bookingId, reference, quoteId, idempotencyKey, vehicleId, enquiry.name, enquiry.email, enquiry.phone, JSON.stringify(journey), requirements, paymentMethod, inPerson ? "in_person" : "not_paid", now, now, requestId, quoteId,driverId,driverId, idempotencyKey),
    getD1().prepare("INSERT INTO app_booking_details(booking_id,quote_id,fingerprint,price_cents,scheduled_at,terms_version,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=?) AND NOT EXISTS(SELECT 1 FROM app_booking_details WHERE booking_id=?)")
      .bind(bookingId, quoteId, fingerprint, priceCents, journey.scheduledAt || null, "pending_customer_confirmation", now, bookingId, bookingId),
    getD1().prepare("INSERT INTO app_assignments(id,booking_id,driver_id,state,created_at,updated_at) SELECT ?,?,?,'accepted',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='pending_customer_confirmation') AND EXISTS(SELECT 1 FROM app_drivers WHERE id=? AND approved=1 AND status IN ('available','on_job')) RETURNING id")
      .bind(await sha(`enquiry-assignment:${requestId}`),bookingId,driverId,now,now,bookingId,driverId),
    getD1().prepare("UPDATE app_drivers SET status='on_job' WHERE id=? AND EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND driver_id=? AND state='accepted')").bind(driverId,bookingId,driverId),
    getD1().prepare("UPDATE app_requests SET state='accepted',updated_at=? WHERE id=? AND state='open' AND EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND driver_id=? AND state='accepted')").bind(now, requestId, bookingId,driverId),
    getD1().prepare("INSERT OR IGNORE INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) SELECT ?,?,'pending_customer_confirmation','staff','Provisional offer prepared; customer confirmation required',? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=?)").bind(eventId, bookingId, now, bookingId),
    getD1().prepare("INSERT OR IGNORE INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) SELECT ?,'request',?,'request.accepted',?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=?)")
      .bind(auditId, requestId, actor, JSON.stringify({ bookingReference: reference, vehicleId, driverId, priceCents, paymentMethod }), now, bookingId),
    getD1().prepare("INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_requests WHERE id=? AND state='accepted')")
      .bind(outboxId, outboxKey, enquiry.email, `Review your cruzycabs booking offer ${reference}`, emailText, now, now, requestId),
    getD1().prepare("INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND driver_id=? AND state='accepted')")
      .bind(await sha(`enquiry-driver-email:${requestId}`),`enquiry-driver:${requestId}`,driver.email,`Assigned cruzycabs enquiry ${reference}`,`Operations assigned ${reference} to you. Review it in your driver workspace: ${setting("SITE_URL","https://cruzycabs.co.nz")}/driver. ${inPerson ? "Wait for customer confirmation before starting. Collect the fare in person (cash or EFTPOS)." : "Wait for customer confirmation and payment before starting."}`,now,now,bookingId,driverId),
  ]);
  const saved = await getD1().prepare("SELECT b.id,b.reference,b.status,d.fingerprint FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id JOIN app_requests r ON r.id=? AND r.state='accepted' WHERE b.idempotency_key=?").bind(requestId,idempotencyKey).first<AcceptedBooking>();
  if (!saved || saved.fingerprint !== fingerprint) throw new HttpError("The enquiry changed while accepting it. Refresh before retrying.", 409);
  return { reference: saved.reference, status: saved.status, emailState: await acceptanceEmailState(requestId), dispatchPaused: !bookingsEnabled() };
}

export async function acceptanceEmailState(requestId: string) {
  const row = await getD1().prepare("SELECT state FROM app_outbox WHERE dedupe_key=?").bind(`enquiry-accepted:${requestId}`).first<{ state: string }>();
  return row?.state || "missing";
}

export function isManualEnquiryBooking(requirements: string) {
  try { return Boolean((JSON.parse(requirements) as { enquiryReference?: string }).enquiryReference); } catch { return false; }
}

export function customerConfirmationNeeded(status: string) { return status === "pending_customer_confirmation"; }
