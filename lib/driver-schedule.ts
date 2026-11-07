import { getD1 } from "./d1";
import { HttpError } from "./security";

// Drivers can hold several pre-booked jobs. "on_job" only means another booking is assigned,
// so a new job is refused only when its pickup is within this gap of one of the driver's other pickups.
export const assignableDriverStatuses = ["available", "on_job"];
export const pickupGapHours = 2;

export async function driverClash(driverId: string, bookingId: string, scheduledAt: string | null | undefined) {
  const target = scheduledAt ? Date.parse(scheduledAt) : Date.now(), gap = pickupGapHours * 3600000;
  const rows = await getD1().prepare("SELECT b.reference,a.state,COALESCE(d.scheduled_at,b.created_at) pickup FROM app_assignments a JOIN bookings b ON b.id=a.booking_id JOIN app_booking_details d ON d.booking_id=b.id WHERE a.driver_id=? AND a.booking_id<>? AND a.state IN ('offered','accepted','arrived','on_trip') AND b.status NOT IN ('cancelled','cancel_pending','completed','declined')").bind(driverId, bookingId).all<{ reference: string; state: string; pickup: string }>();
  // A trip under way blocks pickups until it should be finished, whatever its booked time was.
  return (rows.results || []).find(row => Math.abs((["arrived", "on_trip"].includes(row.state) ? Date.now() : Date.parse(row.pickup)) - target) < gap) || null;
}

export async function requireNoDriverClash(driverId: string, bookingId: string, scheduledAt: string | null | undefined) {
  const clash = await driverClash(driverId, bookingId, scheduledAt);
  if (clash) throw new HttpError(`This driver already has booking ${clash.reference} within ${pickupGapHours} hours of this pickup. Choose another driver or change a pickup time.`, 409);
}
