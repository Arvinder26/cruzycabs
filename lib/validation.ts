import { HttpError, text } from "./security";
import type { QuoteInput } from "./pricing";

export function scheduledInstant(date: string,time: string,now=Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new HttpError("Choose a valid pickup date and time.");
  const target=Date.parse(`${date}T${time}:00Z`);
  if(!Number.isFinite(target) || new Date(target).toISOString().slice(0,16)!==`${date}T${time}`) throw new HttpError("Invalid pickup date or time.");
  // Resolve the wall clock in Pacific/Auckland, including daylight-saving transitions.
  const matches:number[]=[];
  for(const hours of [12,13]) { const candidate=target-hours*3600000; const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Pacific/Auckland",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(candidate); const p=Object.fromEntries(parts.map(v=>[v.type,v.value])); if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===`${date}T${time}`) matches.push(candidate); }
  if(matches.length!==1) throw new HttpError("This pickup time is ambiguous or unavailable during daylight saving. Choose another time.");
  if(matches[0]<now+15*60000 || matches[0]>now+90*86400000) throw new HttpError("Scheduled pickups must be at least 15 minutes ahead and within 90 days.");
  return new Date(matches[0]).toISOString();
}
export function validateJourney(body: Record<string,unknown>,now=Date.now()): QuoteInput {
  const pickup=text(body.pickup,"Pickup"),destination=text(body.destination,"Destination");
  if(pickup.toLowerCase()===destination.toLowerCase()) throw new HttpError("Pickup and destination must differ.");
  if(body.when!=="now" && body.when!=="schedule") throw new HttpError("Select immediate or scheduled pickup.");
  for(const [field,min,max] of [["passengers",1,7],["luggage",0,6]] as const) { const value=body[field]; if(typeof value!=="number" || !Number.isInteger(value) || value<min || value>max) throw new HttpError(`${field} must be between ${min} and ${max}.`); }
  for(const field of ["accessible","childSeat","pet"] as const) if(body[field]!==undefined && typeof body[field]!=="boolean") throw new HttpError(`Invalid ${field} preference.`);
  const stops=body.stops ?? []; if(!Array.isArray(stops) || stops.length>3) throw new HttpError("Up to three intermediate stops are supported.");
  const when=body.when;
  const date=text(body.date,"Date",10,when==="now"),time=text(body.time,"Time",5,when==="now");
  const scheduledAt=when==="schedule" ? scheduledInstant(date,time,now) : null;
  const wheelchair=body.accessible ? text(body.wheelchair,"Wheelchair assistance",50) : "";
  if(body.accessible && !["ramp","hoist","transfer"].includes(wheelchair)) throw new HttpError("Choose ramp, hoist or seat-transfer assistance.");
  return {pickup,destination,when,date,time,scheduledAt,passengers:body.passengers as number,luggage:body.luggage as number,accessible:Boolean(body.accessible),childSeat:Boolean(body.childSeat),pet:Boolean(body.pet),wheelchair,stops:stops.map(v=>text(v,"Stop")),airportTerminal:text(body.airportTerminal,"Terminal",30,true),flightNumber:text(body.flightNumber,"Flight",12,true)};
}
