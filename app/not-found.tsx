import Link from "next/link";
import { SiteHeader } from "./SiteHeader";

export default function NotFound() {
  return <main className="utility-page"><SiteHeader compact/><section className="utility-shell"><div><h1>We couldn’t find that page.</h1><p>The address may have changed. You can start a booking or get help below.</p></div><div className="utility-card"><Link className="button button-primary" href="/#journey-form">Start a booking</Link><p><Link href="/manage-booking">Manage an existing booking</Link> · <Link href="/help">Get help</Link></p></div></section></main>;
}
