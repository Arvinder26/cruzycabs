import { getD1 } from "./d1";
import { setting, siteOrigin } from "./config";
import { sha } from "./security";
import { queueEmail } from "./notifications";
import type { QuoteInput } from "./pricing";

// Drivers receive each assigned job as a calendar invite, so it lands in Google Calendar with the time and pickup address.
// The same event (one UID per booking) is updated when the time changes and cancelled when the job is cancelled or reassigned.

type JobRow = { id: string; reference: string; status: string; customer_name: string; customer_phone: string; journey_json: string; requirements_json: string; vehicle_id: string; payment_state: string; price_cents: number; scheduled_at: string | null; created_at: string; result_json: string | null; driver_email: string | null; driver_name: string | null; plate: string | null };
type InviteRow = { driver_email: string; sequence: number; fingerprint: string; cancelled: number };

const endedStatuses = ["cancelled", "cancel_pending", "declined"];

function escapeText(value: string) { return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function stamp(value: number) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
// RFC 5545 lines are folded at 75 octets; continuation lines start with a space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = []; let current = "", size = 0;
  for (const char of line) { const width = new TextEncoder().encode(char).length; if (size + width > (parts.length ? 74 : 75)) { parts.push(current); current = ""; size = 0; } current += char; size += width; }
  parts.push(current);
  return parts.join("\r\n ");
}
function senderAddress() { const from = setting("EMAIL_FROM"); return /<([^>]+)>/.exec(from)?.[1] || from || "operations@cruzycabs.co.nz"; }

export function jobDetails(row: JobRow) {
  const journey = JSON.parse(row.journey_json) as QuoteInput, requirements = JSON.parse(row.requirements_json) as { notes?: string };
  const start = Date.parse(row.scheduled_at || journey.scheduledAt || row.created_at);
  let minutes = 60;
  try { const quoted = Number((JSON.parse(row.result_json || "{}") as { durationMin?: number }).durationMin); if (quoted > 0) minutes = Math.max(30, Math.ceil(quoted) + 15); } catch { /* Fall back to an hour. */ }
  const when = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "full", timeStyle: "short" }).format(new Date(start));
  const lines = [
    `Booking: ${row.reference}`,
    `Pickup time: ${when} (New Zealand time)`,
    `Pickup: ${journey.pickup}`,
    ...(journey.stops?.length ? [`Stops: ${journey.stops.join(" → ")}`] : []),
    `Destination: ${journey.destination}`,
    `Passenger: ${row.customer_name} · ${row.customer_phone}`,
    `Passengers: ${journey.passengers}`,
    `Bags: ${journey.luggage}`,
    ...(journey.accessible ? [`Wheelchair assistance: ${journey.wheelchair || "Required"}`] : []),
    ...(journey.childSeat ? ["Child seat required"] : []),
    ...(journey.pet ? ["Travelling with a pet"] : []),
    ...(journey.flightNumber ? [`Flight: ${journey.flightNumber}${journey.airportTerminal ? ` · ${journey.airportTerminal}` : ""}`] : []),
    ...(requirements.notes ? [`Notes: ${requirements.notes}`] : []),
    `Fare: NZD ${(row.price_cents / 100).toFixed(2)}${row.payment_state === "in_person" ? " — collect in person (cash or EFTPOS)" : ""}`,
    `Driver workspace: ${siteOrigin()}/driver`,
  ];
  return { journey, start, end: start + minutes * 60000, when, text: lines.join("\n") };
}

export function calendarFile(row: JobRow, driverEmail: string, sequence: number, cancelled: boolean) {
  const details = jobDetails(row), method = cancelled ? "CANCEL" : "REQUEST";
  const lines = [
    "BEGIN:VCALENDAR", "PRODID:-//cruzycabs//driver jobs//EN", "VERSION:2.0", "CALSCALE:GREGORIAN", `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${row.id}@cruzycabs.co.nz`, `SEQUENCE:${sequence}`, `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(details.start)}`, `DTEND:${stamp(details.end)}`,
    `SUMMARY:${escapeText(`${cancelled ? "Cancelled: " : ""}cruzycabs ${row.reference}: ${details.journey.pickup} → ${details.journey.destination}`)}`,
    `LOCATION:${escapeText(details.journey.pickup)}`,
    `DESCRIPTION:${escapeText(details.text)}`,
    `ORGANIZER;CN=cruzycabs operations:mailto:${senderAddress()}`,
    `ATTENDEE;CN=${escapeText(row.driver_name || "Driver")};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${driverEmail}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`, "TRANSP:OPAQUE",
    ...(cancelled ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:cruzycabs pickup in 1 hour", "TRIGGER:-PT60M", "END:VALARM"]),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return { method, content: lines.map(fold).join("\r\n") + "\r\n", details };
}

function queueInvite(row: JobRow, driverEmail: string, sequence: number, cancelled: boolean, updated: boolean) {
  const file = calendarFile(row, driverEmail, sequence, cancelled), key = `calendar:${row.id}:${sequence}`;
  const subject = cancelled ? `Cancelled job ${row.reference} — ${file.details.when}` : `${updated ? "Updated job" : "New job"} ${row.reference} — ${file.details.when}`;
  const intro = cancelled ? "This job has been cancelled or moved to another driver. It has been removed from your calendar." : updated ? "This job has changed. Your calendar event has been updated with the details below." : "You have a new cruzycabs job. Add it to your Google Calendar from the invite in this email.";
  return [
    queueEmail(key, driverEmail, subject, `${intro}\n\n${file.details.text}`),
    getD1().prepare("INSERT OR IGNORE INTO app_outbox_attachments(outbox_key,filename,content_type,content) VALUES(?,?,?,?)").bind(key, "invite.ics", `text/calendar; charset=utf-8; method=${file.method}`, file.content),
  ];
}

// Brings the driver's calendar in line with the booking. Safe to call after any booking change: unchanged jobs send nothing.
export async function syncDriverCalendar(bookingIdOrReference: string) {
  try {
    const db = getD1();
    const row = await db.prepare(`SELECT b.id,b.reference,b.status,b.customer_name,b.customer_phone,b.journey_json,b.requirements_json,b.vehicle_id,b.payment_state,b.created_at,d.price_cents,d.scheduled_at,q.result_json,dr.email driver_email,dr.name driver_name,v.plate FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id LEFT JOIN quotes q ON q.id=d.quote_id LEFT JOIN app_assignments a ON a.booking_id=b.id AND a.state IN ('accepted','arrived','on_trip') LEFT JOIN app_drivers dr ON dr.id=a.driver_id LEFT JOIN app_vehicles v ON v.driver_id=dr.id WHERE b.id=? OR b.reference=? LIMIT 1`).bind(bookingIdOrReference, bookingIdOrReference).first<JobRow>();
    if (!row) return;
    const previous = await db.prepare("SELECT driver_email,sequence,fingerprint,cancelled FROM app_calendar_invites WHERE booking_id=?").bind(row.id).first<InviteRow>();
    const active = Boolean(row.driver_email) && !endedStatuses.includes(row.status);
    // Completed trips keep their calendar entry.
    if (!active && row.status === "completed") return;
    let sequence = previous ? previous.sequence : -1;
    const statements = [], now = new Date().toISOString();
    if (previous && !previous.cancelled && (!active || previous.driver_email !== row.driver_email)) statements.push(...queueInvite(row, previous.driver_email, ++sequence, true, true));
    let fingerprint = previous?.fingerprint || "", driverEmail = previous?.driver_email || "", cancelled = statements.length ? 1 : previous?.cancelled || 0;
    if (active && row.driver_email) {
      const details = jobDetails(row);
      fingerprint = await sha(JSON.stringify([row.driver_email, details.start, details.end, details.text]));
      if (!previous || previous.cancelled || previous.driver_email !== row.driver_email || previous.fingerprint !== fingerprint) {
        statements.push(...queueInvite(row, row.driver_email, ++sequence, false, Boolean(previous && !previous.cancelled && previous.driver_email === row.driver_email)));
        driverEmail = row.driver_email; cancelled = 0;
      }
    }
    if (!statements.length) return;
    statements.push(db.prepare("INSERT INTO app_calendar_invites(booking_id,driver_email,sequence,fingerprint,cancelled,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET driver_email=excluded.driver_email,sequence=excluded.sequence,fingerprint=excluded.fingerprint,cancelled=excluded.cancelled,updated_at=excluded.updated_at").bind(row.id, driverEmail, sequence, fingerprint, cancelled, now));
    await db.batch(statements);
  } catch (error) {
    // A calendar problem must never undo or block the booking change itself.
    console.error(JSON.stringify({ event: "calendar.sync_failed", booking: bookingIdOrReference, message: error instanceof Error ? error.message : "unknown" }));
  }
}
