export const runtime = "nodejs";
import { databaseConfigured,setting } from "../../../lib/config";
import { endpoint,HttpError,json } from "../../../lib/security";
import { rateLimit } from "../../../lib/platform";

const PHOTON_API = "https://photon.komoot.io/api";
const AUCKLAND = { latitude: -36.8485, longitude: 174.7633 };
// Address suggestions remain usable while booking storage is being configured.
let previewWindow = 0;
let previewSearches = 0;

type PhotonProperties = {
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
  osm_type?: string;
  osm_id?: number;
};

type PhotonFeature = {
  properties?: PhotonProperties;
  geometry?: { coordinates?: [number, number] };
};

function uniqueParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const normalized = part?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function formatFeature(feature: PhotonFeature) {
  const properties = feature.properties ?? {};
  if (properties.countrycode?.toUpperCase() !== "NZ" || properties.name?.toLowerCase() === "new zealand") return null;
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const streetAddress = uniqueParts([properties.housenumber, properties.street]).join(" ");
  const primary = streetAddress || properties.name || properties.street || properties.city;
  if (!primary) return null;

  const secondaryParts = uniqueParts([
    // Street suggestions need the postal address, without estate/building names
    // or smaller locality labels returned alongside the actual suburb.
    streetAddress ? undefined : properties.locality,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.postcode,
    properties.country,
  ]);
  const secondary = secondaryParts.join(", ");
  const label = uniqueParts([primary, ...secondaryParts]).join(", ");
  const [longitude, latitude] = coordinates;

  return {
    id: `${properties.osm_type ?? "place"}-${properties.osm_id ?? `${longitude}-${latitude}`}`,
    label,
    primary,
    secondary: secondary || "New Zealand",
    latitude,
    longitude,
    source: "photon" as const,
  };
}

export function GET(request: Request) { return endpoint(async () => {
  if (databaseConfigured()) await rateLimit(request,"addresses",60);
  else {
    const window = Math.floor(Date.now() / 60000);
    if (previewWindow !== window) { previewWindow = window; previewSearches = 0; }
    if (++previewSearches > 60) throw new HttpError("Too many address searches. Please try again shortly.", 429);
  }
  const params = new URL(request.url).searchParams;
  const googleKey = setting("GOOGLE_MAPS_API_KEY");
  const placeId = params.get("placeId");
  if (placeId) {
    if (!googleKey || placeId.length > 256) throw new HttpError("Place details unavailable.", 400);
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "location,addressComponents" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new HttpError("Place details unavailable.", 502);
    const place = await response.json() as { location?: { latitude: number; longitude: number }; addressComponents?: { types: string[]; shortText: string }[] };
    if (!place.addressComponents?.some(component => component.types.includes("country") && component.shortText === "NZ") || !place.location || !Number.isFinite(place.location.latitude) || !Number.isFinite(place.location.longitude)) throw new HttpError("Choose a New Zealand location.", 422);
    return json(place.location);
  }
  const query = params.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return Response.json({ error: "Enter at least 3 characters to search for an address." }, { status: 400 });
  }
  if (query.length > 100) {
    return Response.json({ error: "The address search is too long." }, { status: 400 });
  }

  if(googleKey){
    try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey },
      body: JSON.stringify({ input: query, includedRegionCodes: ["nz"], regionCode: "nz", languageCode: "en", locationBias: { circle: { center: AUCKLAND, radius: 50000 } } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new HttpError("Address suggestions are unavailable. You can enter your NZ address manually.", 502);
    type Prediction = { placeId: string; types?: string[]; text: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } };
    const data = await response.json() as { suggestions?: { placePrediction?: Prediction }[] };
    const suggestions = (data.suggestions ?? []).flatMap(({ placePrediction: place }) => {
      if (!place || place.types?.includes("country") || place.text.text.trim().toLowerCase() === "new zealand") return [];
      return [{ id: place.placeId, label: place.text.text, primary: place.structuredFormat?.mainText?.text || place.text.text, secondary: place.structuredFormat?.secondaryText?.text || "New Zealand", latitude: null, longitude: null, source: "google" }];
    });
    return json({ suggestions, attribution: "Google Maps" });
    } catch {
      // Keep autocomplete available if Places has not yet been enabled for the key.
    }
  }
  const configured=setting("PHOTON_API_URL");
  const endpoint = new URL(configured || PHOTON_API);
  if(endpoint.protocol!=="https:")throw new HttpError("Address provider must use HTTPS.",503);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "6");
  endpoint.searchParams.set("lang", "en");
  endpoint.searchParams.set("countrycode", "NZ");
  endpoint.searchParams.set("lat", String(AUCKLAND.latitude));
  endpoint.searchParams.set("lon", String(AUCKLAND.longitude));
  endpoint.searchParams.set("zoom", "11");
  endpoint.searchParams.set("location_bias_scale", "0.35");

  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);

    const data = (await response.json()) as { features?: PhotonFeature[] };
    const seenLabels = new Set<string>();
    const suggestions = (data.features ?? [])
      .map(formatFeature)
      .filter((suggestion): suggestion is NonNullable<ReturnType<typeof formatFeature>> => Boolean(suggestion))
      .filter((suggestion) => {
        const normalized = suggestion.label.toLowerCase();
        if (seenLabels.has(normalized)) return false;
        seenLabels.add(normalized);
        return true;
      })
      .slice(0, 6);

    return Response.json(
      { suggestions,attribution:"Photon · © OpenStreetMap contributors" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Address suggestions are temporarily unavailable. You can still use the address as entered." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
});}
