import { calculateQuote } from "../../../lib/pricing";
import { activePricing } from "../../../lib/pricing-store";
import { validateJourney } from "../../../lib/validation";
import { onlineVehicleClasses } from "../../../lib/config";
import { routeJourney } from "../../../lib/routing";
import { rateLimit } from "../../../lib/platform";
import { endpoint, HttpError, json, readObject, sameOrigin } from "../../../lib/security";

export const runtime = "nodejs";

// Indicative pricing remains available while new online bookings are paused.
// No bookable quote, booking, payment or notification is created here.
export function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await rateLimit(request, "estimates", 15);
    const input = validateJourney(await readObject(request));
    const [route, rules] = await Promise.all([routeJourney(input), activePricing()]);
    const calculation = calculateQuote(input, route, rules, onlineVehicleClasses());
    if (!calculation.vehicles.length) throw new HttpError("Operations needs to confirm a suitable vehicle and price for these requirements. You can still send your enquiry.", 422);
    return json({ ...calculation, estimateOnly: true });
  });
}
