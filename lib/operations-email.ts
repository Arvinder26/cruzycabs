import { setting, siteOrigin } from "./config";
import { getD1 } from "./d1";
import { queueEmail } from "./notifications";
import type { BookingRow } from "./bookings";
import type { QuoteInput } from "./pricing";

export type OperationsBooking = Pick<BookingRow, "id" | "reference" | "customer_name" | "customer_email" | "customer_phone" | "journey_json" | "requirements_json" | "vehicle_id" | "status" | "payment_state" | "price_cents" | "scheduled_at" | "created_at">;

export function operationsBookingEmail(row: OperationsBooking) {
  const journey = JSON.parse(row.journey_json) as QuoteInput;
  const requirements = JSON.parse(row.requirements_json) as { notes?: string; bookingForOther?: boolean };
  const scheduled = row.scheduled_at || journey.scheduledAt;
  const pickupTime = scheduled ? new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland", dateStyle: "full", timeStyle: "short",
  }).format(new Date(scheduled)) + " (New Zealand time)" : "As soon as possible";
  const text = [
    "Booking request — operations / driver allocation",
    `Reference: ${row.reference}`,
    `Status: ${row.status.replaceAll("_", " ")}`,
    `Received: ${row.created_at}`,
    "",
    `Passenger: ${row.customer_name}`,
    `Phone: ${row.customer_phone}`,
    `Email: ${row.customer_email}`,
    `Booked for someone else: ${requirements.bookingForOther ? "Yes" : "No"}`,
    "",
    `Pickup: ${journey.pickup}`,
    `Pickup time: ${pickupTime}`,
    `Destination: ${journey.destination}`,
    `Intermediate stops: ${journey.stops?.join(" → ") || "None"}`,
    `Vehicle: ${row.vehicle_id === "accessible" ? "Accessible taxi" : "Van"}`,
    `Passengers: ${journey.passengers}`,
    `Luggage: ${journey.luggage}`,
    `Wheelchair assistance: ${journey.accessible ? journey.wheelchair || "Required" : "No"}`,
    `Child seat: ${journey.childSeat ? "Required" : "No"}`,
    `Pet: ${journey.pet ? "Yes" : "No"}`,
    `Airport terminal: ${journey.airportTerminal || "Not supplied"}`,
    `Flight number: ${journey.flightNumber || "Not supplied"}`,
    `Passenger notes: ${requirements.notes || "None"}`,
    "",
    `Quoted fare: NZD ${(row.price_cents / 100).toFixed(2)}`,
    `Payment: ${row.payment_state.replaceAll("_", " ")}`,
    "Allocate a suitable driver. Payment is requested after driver confirmation.",
    `Dispatch workspace (staff sign-in required): ${siteOrigin()}/dispatch`,
  ].join("\n");
  return queueEmail(`operations-booking:${row.id}`, setting("OPERATIONS_EMAIL") || setting("SUPPORT_EMAIL") || "operations@cruzycabs.co.nz", `New booking ${row.reference} — driver required`, text);
}

// Recover active bookings created before operations notifications were enabled.
// The unique outbox key prevents repeated job runs or retries sending duplicates.
export async function recoverOperationsEmails() {
  const rows = await getD1().prepare(`SELECT b.*,d.price_cents,d.scheduled_at FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.status IN ('review','awaiting_dispatch','offered','accepted','awaiting_payment','arrived','on_trip') AND NOT EXISTS (SELECT 1 FROM app_outbox o WHERE o.dedupe_key='operations-booking:' || b.id) ORDER BY b.created_at LIMIT 100`).all<OperationsBooking>();
  if (rows.results?.length) await getD1().batch(rows.results.map(operationsBookingEmail));
}
