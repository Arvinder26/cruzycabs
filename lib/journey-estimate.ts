export type JourneyEstimate = {
  estimateOnly: true;
  distanceKm: number;
  durationMin: number;
  pricingVersion: string;
  vehicles: { id: string; name: string; priceCents: number }[];
};

export function estimateDetails(estimate: JourneyEstimate) {
  return [
    ...estimate.vehicles.map(vehicle => `Estimated ${vehicle.name} total: NZD ${(vehicle.priceCents / 100).toFixed(2)} including GST (whole group; subject to operations confirmation)`),
    `Estimated route: ${estimate.distanceKm} km / ${estimate.durationMin} min`,
    `Estimate pricing version: ${estimate.pricingVersion}`,
  ];
}
