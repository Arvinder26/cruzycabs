import { setting } from "./config";
import { HttpError } from "./security";
import { dispatchBase, type QuoteInput } from "./pricing";
type LatLng={latitude:number;longitude:number};
type RouteBody={routes?:{distanceMeters:number;duration:string;legs:{startLocation:{latLng:LatLng};endLocation:{latLng:LatLng}}[]}[]};
// Approximate Takanini depot coordinates, used only if the live positioning route is unavailable.
const dispatchBaseLatLng:LatLng={latitude:-37.0483,longitude:174.9007};
function computeRoute(key:string,body:Record<string,unknown>){
  return fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"routes.distanceMeters,routes.duration,routes.legs.startLocation,routes.legs.endLocation"},body:JSON.stringify({travelMode:"DRIVE",routingPreference:"TRAFFIC_AWARE",languageCode:"en-NZ",regionCode:"NZ",...body}),signal:AbortSignal.timeout(10000)});
}
function seconds(duration:string){return /^\d+(\.\d+)?s$/.test(duration)?Number(duration.slice(0,-1)):NaN;}
/** Straight-line fallback: 1.35 road factor at an average 60 km/h. */
function estimatedMinutes(from:LatLng,to:LatLng){const rad=Math.PI/180,dLat=(to.latitude-from.latitude)*rad,dLng=(to.longitude-from.longitude)*rad,a=Math.sin(dLat/2)**2+Math.cos(from.latitude*rad)*Math.cos(to.latitude*rad)*Math.sin(dLng/2)**2;return 6371*2*Math.asin(Math.sqrt(a))*1.35;}
async function positioningMinutes(key:string,input:QuoteInput):Promise<number|undefined>{
  try{
    const response=await computeRoute(key,{origin:{address:setting("DISPATCH_BASE_ADDRESS",dispatchBase+", New Zealand")},destination:{address:input.pickup},...(input.scheduledAt?{departureTime:input.scheduledAt}:{})});
    if(!response.ok)return undefined;
    const route=((await response.json()) as RouteBody).routes?.[0],value=route?seconds(route.duration):NaN;
    return Number.isFinite(value)?value/60:undefined;
  }catch{return undefined;}
}
export async function routeJourney(input:QuoteInput) {
  const key=setting("GOOGLE_MAPS_API_KEY");
  if(!key) throw new HttpError("Online route pricing is unavailable. Send a journey enquiry and our team will quote it.",503);
  const waypoint=(address:string)=>({address});
  const [response,positioning]=await Promise.all([computeRoute(key,{origin:waypoint(input.pickup),destination:waypoint(input.destination),intermediates:input.stops?.map(waypoint),...(input.scheduledAt?{departureTime:input.scheduledAt}:{})}),positioningMinutes(key,input)]);
  if(!response.ok) throw new HttpError("The routing provider could not price this journey. Please contact support.",503);
  const body=await response.json() as RouteBody;
  const route=body.routes?.[0]; if(!route || !Number.isFinite(route.distanceMeters) || !Number.isFinite(seconds(route.duration))) throw new HttpError("A road route could not be found.",422);
  if(route.legs.flatMap(l=>[l.startLocation.latLng,l.endLocation.latLng]).some(p=>p.latitude> -34 || p.latitude< -42 || p.longitude<172 || p.longitude>179)) throw new HttpError("This journey is outside our North Island service area.",422);
  const pickupPoint=route.legs[0]?.startLocation.latLng;
  return {distanceKm:route.distanceMeters/1000,durationMin:seconds(route.duration)/60,positioningMin:positioning??(pickupPoint?estimatedMinutes(dispatchBaseLatLng,pickupPoint):undefined)};
}
