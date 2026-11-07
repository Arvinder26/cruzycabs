import { type JourneyDetails } from "../lib/journey-presentation";

export function JourneySummary({journey,notes}:{journey:JourneyDetails;notes?:string}) {
  const assistance=({ramp:"Passenger remains seated — ramp",hoist:"Passenger remains seated — hoist",transfer:"Passenger transfers into vehicle seat"} as Record<string,string>)[journey.wheelchair||""];
  return <dl className="journey-details">
    <div><dt>Pickup</dt><dd>{journey.pickup}</dd></div>
    {journey.stops?.map((stop,index)=><div key={`${index}-${stop}`}><dt>Stop {index+1}</dt><dd>{stop}</dd></div>)}
    <div><dt>Destination</dt><dd>{journey.destination}</dd></div>
    <div><dt>Pickup time</dt><dd>{journey.when==="schedule"?`${journey.date} at ${journey.time}, New Zealand time (Pacific/Auckland)`:"As soon as a suitable driver is available"}</dd></div>
    {journey.passengers!==undefined&&<div><dt>Passengers / bags</dt><dd>{journey.passengers} passengers · {journey.luggage??0} bags</dd></div>}
    <div><dt>Access and equipment</dt><dd>{journey.accessible?(assistance||"Wheelchair assistance — review required"):"No wheelchair assistance requested"}{journey.childSeat?" · Child seat requested":""}{journey.pet?" · Pet travel requested":""}</dd></div>
    {journey.airportTerminal&&<div><dt>Airport terminal</dt><dd>{journey.airportTerminal}</dd></div>}
    {journey.flightNumber&&<div><dt>Flight</dt><dd>{journey.flightNumber}</dd></div>}
    {notes&&<div><dt>Pickup / assistance notes</dt><dd className="preserve-lines">{notes}</dd></div>}
  </dl>;
}
