import { authorisedBooking } from "../../../../lib/bookings";
import { getD1 } from "../../../../lib/d1";
import { audit, rateLimit } from "../../../../lib/platform";
import { endpoint, HttpError, json, readObject, sameOrigin, sha, text } from "../../../../lib/security";

export const runtime = "nodejs";

export function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await rateLimit(request, "booking-review", 6, 600);
    const body = await readObject(request, 5000);
    const reference = text(body.reference, "Booking reference", 30).toUpperCase();
    const booking = await authorisedBooking(request, reference);
    if (typeof body.rating !== "number" || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      throw new HttpError("Choose a rating from 1 to 5 stars.");
    }
    const comment = text(body.comment, "Review", 2000, true);
    const experience = booking.status === "completed" ? "journey" : "booking";
    const id = await sha(`booking-review:${booking.id}`);
    const reviewReference = `CCQ-${id.slice(0, 10).toUpperCase()}`;
    // One private review per verified booking, including safe retries.
    const existing = await getD1().prepare("SELECT data_json FROM app_requests WHERE id=?").bind(id).first<{ data_json: string }>();
    if (existing) {
      const saved = JSON.parse(existing.data_json) as { rating: number; comment: string };
      if (saved.rating !== body.rating || saved.comment !== comment) throw new HttpError("Feedback has already been saved for this booking. Contact us if you would like to update it.", 409);
      return json({ reference: reviewReference });
    }
    const now = new Date().toISOString();
    const data = JSON.stringify({ bookingReference: reference, rating: body.rating, comment, experience,
      details: `${experience === "journey" ? "Journey" : "Booking"} experience · ${body.rating}/5 stars\n${comment || "No written comment."}\nBooking reference: ${reference}` });
    await getD1().batch([
      getD1().prepare("INSERT OR IGNORE INTO app_requests(id,reference,kind,name,email,phone,data_json,created_at,updated_at) VALUES(?,?,'review',?,?,?,?,?,?)")
        .bind(id, reviewReference, booking.customer_name, booking.customer_email, booking.customer_phone, data, now, now),
      audit("request", id, "review.created", "customer", { experience }),
    ]);
    // A concurrent submission may have won the unique booking-review ID.
    const persisted = await getD1().prepare("SELECT data_json FROM app_requests WHERE id=?").bind(id).first<{ data_json: string }>();
    const saved = persisted && JSON.parse(persisted.data_json) as { rating: number; comment: string } | null;
    if (!saved) throw new HttpError("Your review could not be saved. Please try again.", 503);
    if (saved.rating !== body.rating || saved.comment !== comment) throw new HttpError("Feedback has already been saved for this booking. Contact us if you would like to update it.", 409);
    return json({ reference: reviewReference }, 201);
  });
}
