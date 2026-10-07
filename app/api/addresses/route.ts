export const runtime = "nodejs";
import { localPreview,setting } from "../../../lib/config";
import { endpoint,HttpError,json } from "../../../lib/security";
import { rateLimit } from "../../../lib/platform";

const PHOTON_API = "https://photon.komoot.io/api";
const AUCKLAND = { latitude: -36.8485, longitude: 174.7633 };

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
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const streetAddress = uniqueParts([properties.housenumber, properties.street]).join(" ");
  const primary = streetAddress || properties.name || properties.street || properties.city;
  if (!primary) return null;

  const secondaryParts = uniqueParts([
    properties.name && properties.name.toLowerCase() !== primary.toLowerCase() ? properties.name : undefined,
    properties.locality,
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
  await rateLimit(request,"addresses",60);
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return Response.json({ error: "Enter at least 3 characters to search for an address." }, { status: 400 });
  }
  if (query.length > 100) {
    return Response.json({ error: "The address search is too long." }, { status: 400 });
  }

  const googleKey=setting("GOOGLE_MAPS_API_KEY");
  if(googleKey){
    const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");url.searchParams.set("address",query);url.searchParams.set("components","country:NZ");url.searchParams.set("key",googleKey);
    const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new HttpError("Address search unavailable.",502);
    const data=await r.json() as {status:string;results:{place_id:string;formatted_address:string;geometry:{location:{lat:number;lng:number}}}[]};
    if(!["OK","ZERO_RESULTS"].includes(data.status))throw new HttpError("Address search unavailable.",502);
    return json({suggestions:data.results.slice(0,6).map(place=>({id:place.place_id,label:place.formatted_address,primary:place.formatted_address,secondary:"New Zealand",latitude:place.geometry.location.lat,longitude:place.geometry.location.lng,source:"google"})),attribution:"Google Maps"});
  }
  const configured=setting("PHOTON_API_URL");if(!configured&&!localPreview())throw new HttpError("Address search is unavailable. You can enter your address manually.",503);
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
