import Link from "next/link";
import { hourlyVanHire } from "../lib/business";
import { onlineVehicleClasses } from "../lib/config";
import { calculateQuote, type PricingRules } from "../lib/pricing";

const examples = [
  { label: "Short Auckland trip", distanceKm: 5, durationMin: 12, pickup: "Auckland CBD" },
  { label: "Cross-town Auckland trip", distanceKm: 20, durationMin: 35, pickup: "Auckland CBD" },
  { label: "Auckland Airport transfer", distanceKm: 20, durationMin: 35, pickup: "Auckland Airport" },
];

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PricingDetails({ rates }: { rates: PricingRules }) {
  const rows = [
    ["Base fare", dollars(rates.baseCents), "Applies to every trip"],
    ["Road distance", `${dollars(rates.cityKmCents)} / km`, "Trips up to 95 km"],
    ["Travel time", `${dollars(rates.cityMinuteCents)} / min`, "Trips up to 95 km"],
    ["Long-distance rates", `${dollars(rates.longKmCents)} / km + ${dollars(rates.longMinuteCents)} / min`,
      `Trips over 95 km also include a ${dollars(rates.returnKmCents)} / km driver return allowance and a 1.55× journey factor`],
    ["Scheduled booking", dollars(rates.scheduledCents), "When you book for a later time"],
    ["Airport allowance", dollars(rates.airportCents), "For airport pickups or drop-offs"],
    ["Child seat", dollars(rates.childSeatCents), "When requested"],
    ["Pet", dollars(rates.petCents), "When requested"],
    ["Driver travel to pickup", `${dollars(rates.positioningMinuteCents)} / min`,
      `When the pickup is ${rates.positioningThresholdMin} minutes or more from Takanini, charged for the full one-way drive`],
  ];
  const wheelchairOnline = onlineVehicleClasses().includes("accessible");

  return <section className="pricing-details section-pad" aria-labelledby="example-fares">
    <div className="section-heading split">
      <div><span className="eyebrow">Scheduled rides</span><h2 id="example-fares">Example fares</h2></div>
      <p>One fare for the whole vehicle, including GST. Your actual price depends on your addresses, travel time and any extras.</p>
    </div>
    <table className="pricing-examples" aria-labelledby="example-fares">
      <thead><tr><th scope="col">Example trip</th><th scope="col">Standard van</th><th scope="col">Wheelchair van</th></tr></thead>
      <tbody>{examples.map((route) => {
        const { vehicles } = calculateQuote({
          pickup: route.pickup, destination: "Auckland address", when: "schedule", passengers: 2, luggage: 1,
        }, route, rates);
        return <tr key={route.label}>
          <th scope="row">{route.label}<small>{route.distanceKm} km · {route.durationMin} min</small></th>
          {vehicles.map((vehicle) => <td key={vehicle.id}>{dollars(vehicle.priceCents)}</td>)}
        </tr>;
      })}</tbody>
    </table>
    <p className="pricing-note">The airport example includes the airport allowance. These examples assume no child seat, pet or driver travel fee. {wheelchairOnline ? "Operations confirms wheelchair van and equipment availability." : "For a wheelchair van, send an enquiry so operations can check availability."}</p>

    <div className="section-heading split pricing-rate-heading">
      <div><span className="eyebrow">Point-to-point rides</span><h2 id="ride-rates">How we calculate your fare</h2></div>
      <p>We apply the vehicle factor to the base fare, distance, time and applicable allowances. Pet and driver travel fees are added at the end.</p>
    </div>
    <div className="pricing-table" role="table" aria-labelledby="ride-rates">
      {rows.map(([label, amount, note]) => <div role="row" key={label}>
        <span role="rowheader">{label}</span><strong role="cell">{amount}</strong><small role="cell">{note}</small>
      </div>)}
    </div>
    <div className="vehicle-factors"><span>Standard van {(rates.vanPercent / 100).toFixed(2)}×</span><span>Wheelchair van {(rates.accessiblePercent / 100).toFixed(2)}×</span></div>
    <p className="pricing-note">All rates include GST. We don’t apply surge pricing. An online quote is held for five minutes. If you change your journey, get a fresh quote.</p>
    <p><Link href="/hourly-van-hire">Hourly van hire</Link> starts at NZ${hourlyVanHire.rateNZD} per van per hour with a {hourlyVanHire.minimumHours}-hour minimum. <Link href="/private-tours">Private tours</Link> are quoted for your itinerary.</p>
  </section>;
}
