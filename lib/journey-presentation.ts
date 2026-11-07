export type JourneyDetails = {
  pickup: string; destination: string; when: string; date?: string; time?: string;
  stops?: string[]; passengers?: number; luggage?: number; accessible?: boolean;
  wheelchair?: string; childSeat?: boolean; pet?: boolean; airportTerminal?: string; flightNumber?: string;
};

export function vehicleName(id:string) { return ({xl:"Van",accessible:"Accessible"} as Record<string,string>)[id] || "Vehicle under review"; }
export function bookingStatusLabel(status:string,paymentState="",audience:"customer"|"staff"="customer") {
  const staff=audience==="staff";
  if(status==="pending_customer_confirmation"&&staff)return "Waiting for customer to confirm";
  if(status==="accepted"&&paymentState==="in_person")return staff?"Driver assigned — customer pays driver in person":"Driver assigned — pay your driver in person";
  return ({pending_customer_confirmation:"Waiting for your confirmation",review:"Awaiting operations decision",awaiting_dispatch:"Finding a suitable driver",offered:"Waiting for driver acceptance",awaiting_payment:"Driver assigned — payment due",accepted:"Driver assigned and payment received",arrived:"Driver has arrived",on_trip:"Journey in progress",completed:"Journey completed",cancel_pending:"Cancellation in progress",cancelled:"Booking cancelled",declined:"Booking request declined"} as Record<string,string>)[status] || "Contact operations for an update";
}
export function paymentStatusLabel(status:string) {
  return ({not_paid:"Not paid",in_person:"Pay driver in person",paid:"Payment received",refund_pending:"Refund processing",refunded:"Refund completed",refund_failed:"Refund needs operations attention",refund_action_required:"Refund needs further action"} as Record<string,string>)[status] || "Payment status under review";
}
export function reviewReasons(journey:Pick<JourneyDetails,"accessible"|"childSeat"|"pet">,distanceKm:number) {
  return [journey.accessible?"wheelchair equipment and boarding support":null,journey.childSeat?"child-seat requirements":null,journey.pet?"pet travel requirements":null,distanceKm>180?"the long-distance operating plan":null].filter((v):v is string=>Boolean(v));
}
