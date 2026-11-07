import { requireChatGPTUser } from "../chatgpt-auth";
import { bookingStatusLabel } from "../../lib/journey-presentation";
import { SignOutButton } from "../SignOutButton";
import { SiteHeader } from "../SiteHeader";
import Link from "next/link";
import { getD1 } from "../../lib/d1";
import { ensurePlatform } from "../../lib/platform";
import { SavedPlaces } from "./SavedPlaces";
import type { Metadata } from "next";
export const metadata:Metadata={title:"Your account",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");
  await ensurePlatform();
  const bookings=await getD1().prepare(`SELECT b.reference,b.status,b.payment_state,b.journey_json,d.price_cents,d.receipt_url FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.customer_email=? ORDER BY b.created_at DESC LIMIT 100`).bind(user.email).all<{reference:string;status:string;payment_state:string;journey_json:string;price_cents:number;receipt_url:string|null}>();
  const places=await getD1().prepare(`SELECT id,label,address FROM app_saved_places WHERE email=? ORDER BY created_at DESC`).bind(user.email).all<{id:string;label:string;address:string}>();
  return <main className="content-page"><SiteHeader compact/><section className="account-shell"><div><span className="eyebrow">Customer account</span><h1>Your journeys.</h1><p>Signed in as {user.email}.</p><SignOutButton/></div><section><h2>Bookings and receipts</h2>{!bookings.results?.length&&<p>No bookings for this email yet.</p>}{bookings.results?.map(booking=>{const journey=JSON.parse(booking.journey_json);return <article className="utility-card" key={booking.reference}><h3>{journey.pickup} → {journey.destination}</h3><p>{booking.reference} · {bookingStatusLabel(booking.status,booking.payment_state)} · NZD {(booking.price_cents/100).toFixed(2)}</p><Link href={`/manage-booking?ref=${booking.reference}`}>Manage booking</Link>{booking.receipt_url&&<p><a href={booking.receipt_url} rel="noreferrer" target="_blank">View payment receipt</a></p>}</article>;})}</section><SavedPlaces places={places.results||[]}/></section></main>;
}
