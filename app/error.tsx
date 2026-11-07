"use client";

import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { business } from "../lib/business";

export default function PageError({retry}:{error:Error & {digest?:string};retry:()=>void}) {
  return <main className="utility-page"><SiteHeader compact/><section className="utility-shell"><div><h1>We couldn’t load this page.</h1><p>Please try again. If you were submitting a request or payment, check your private booking link before submitting again.</p></div><div className="utility-card"><button type="button" className="button button-primary" onClick={retry}>Try again</button><p><Link href="/manage-booking">Check an existing booking</Link> · <Link href="/help">Booking support</Link></p><p>Email <a href={`mailto:${business.email}`}>{business.email}</a>.</p></div></section></main>;
}
