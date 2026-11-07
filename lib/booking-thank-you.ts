export type BookingSummary = {
  reference: string;
  customer_name: string;
  vehicle_id: string;
  status: string;
  payment_state: string;
  canPay: boolean;
  reviewSubmitted: boolean;
  price_cents: number;
  receipt_url: string | null;
  journey: { pickup: string; destination: string; when: string; date?: string; time?: string };
};

export function thankYouMessage(booking: Pick<BookingSummary, "status" | "payment_state" | "canPay">) {
  if (booking.status === "completed") return {
    heading: "Thank you for riding with cruzycabs.",
    label: "Journey completed",
    message: "We hope your journey went well. Your honest feedback helps us improve the next ride.",
  };
  if (["cancelled", "cancel_pending"].includes(booking.status)) return {
    heading: "Your booking update.", label: "Cancellation",
    message: "Check your booking for the latest cancellation and payment details. Contact us if you need help.",
  };
  if (booking.status === "declined") return {
    heading: "Your booking request was declined.", label: "Request declined",
    message: "No payment was taken. Contact operations if you need another journey arrangement.",
  };
  if (["accepted", "arrived", "on_trip"].includes(booking.status) && booking.payment_state === "paid") return {
    heading: "You're booked. Thank you.", label: "Booking confirmed · paid",
    message: "Operations assigned your driver and your payment is recorded. Keep your private booking link handy for driver details and journey updates.",
  };
  if (["accepted", "arrived", "on_trip"].includes(booking.status) && booking.payment_state === "in_person") return {
    heading: "You're booked. Thank you.", label: "Booking confirmed · pay driver",
    message: "Operations assigned your driver. Please pay your driver in person (cash or EFTPOS) for the journey. Keep your private booking link handy for driver details and journey updates.",
  };
  if (booking.canPay) return {
    heading: "Thank you. Your driver is assigned.", label: "Payment due before travel",
    message: "Operations accepted your request and assigned a suitable driver. Open your booking to pay securely before your journey.",
  };
  return {
    heading: "Thank you. Your request is received.", label: "Checking availability",
    message: "We are checking your journey and vehicle requirements. No payment is due yet. We will email you after operations accepts your request and assigns a suitable driver.",
  };
}
