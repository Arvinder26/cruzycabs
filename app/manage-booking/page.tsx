import type { Metadata } from "next";
import { ManageBooking } from "../ManageBooking";

export const metadata: Metadata = { title: "Manage booking",robots:{index:false,follow:false} };

export default function ManageBookingPage() {
  return <ManageBooking />;
}
