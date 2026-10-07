import { setting } from "./config";
import { HttpError } from "./security";
import type { QuoteInput } from "./pricing";
export async function routeJourney(input:QuoteInput) {
  const key=setting("GOOGLE_MAPS_API_KEY");
  if(!key) throw new HttpError("Online route pricing is unavailable. Send a journey enquiry and our team will quote it.",503);
  const waypoint=(address:string)=>({address});
  const response=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"routes.distanceMeters,routes.duration,routes.legs.startLocation,routes.legs.endLocation"},body:JSON.stringify({origin:waypoint(input.pickup),destination:waypoint(input.destination),intermediates:input.stops?.map(waypoint),travelMode:"DRIVE",routingPreference:"TRAFFIC_AWARE",...(input.scheduledAt?{departureTime:input.scheduledAt}:{}),languageCode:"en-NZ",regionCode:"NZ"}),signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new HttpError("The routing provider could not price this journey. Please contact support.",503);
  const body=await response.json() as {routes?:{distanceMeters:number;duration:string;legs:{startLocation:{latLng:{latitude:number;longitude:number}};endLocation:{latLng:{latitude:number;longitude:number}}}[]}[]};
  const route=body.routes?.[0]; if(!route || !Number.isFinite(route.distanceMeters) || !/^\d+(\.\d+)?s$/.test(route.duration)) throw new HttpError("A road route could not be found.",422);
  if(route.legs.flatMap(l=>[l.startLocation.latLng,l.endLocation.latLng]).some(p=>p.latitude> -34 || p.latitude< -42 || p.longitude<172 || p.longitude>179)) throw new HttpError("This journey is outside our North Island service area.",422);
  return {distanceKm:route.distanceMeters/1000,durationMin:Number(route.duration.slice(0,-1))/60};
}
