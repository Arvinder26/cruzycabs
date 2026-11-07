import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { business } from "../lib/business";
import { CookieSettingsButton } from "./CookieSettingsButton";
export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-brand">
      <Link className="brand brand-logo-backing" href="/" aria-label="cruzycabs home"><BrandLogo /></Link>
      <p className="footer-tagline">Be choosy. Ride Cruzy.</p>
      <p>Local rides, airport transfers and private North Island journeys, all in one place.</p>
    </div>
    <div><h3>Travel</h3><Link href="/#journey-form">Book a ride</Link><Link href="/auckland-rides">Auckland rides</Link><Link href="/north-island-transfers">North Island transfers</Link><Link href="/airport-transfers">Airport transfers</Link><Link href="/cruise-transfers">Cruise terminal transfers</Link><Link href="/hourly-van-hire">Hourly van &amp; driver hire</Link><Link href="/accessible-travel">Accessible travel</Link><Link href="/private-tours">Private tours</Link></div>
    <div><h3>Support</h3><Link href="/manage-booking">Manage booking</Link><Link href="/help">Help centre</Link><Link href="/lost-property">Lost property</Link><Link href="/complaints">Complaints</Link></div>
    <div><h3>About</h3><Link href="/safety">Safety</Link><Link href="/pricing">How pricing works</Link><Link href="/business-travel">Business travel</Link><Link href="/driver-application">Drive with us</Link><Link href="/partner-fleet-application">Fleet partnerships</Link></div>
    <div className="footer-bottom"><span>© 2026 cruzycabs · {business.bookingHours} · <a href={`mailto:${business.email}`}>{business.email}</a></span><span><Link href="/privacy">Privacy</Link><CookieSettingsButton /><Link href="/terms">Terms</Link><Link href="/accessibility-statement">Accessibility</Link></span></div>
  </footer>;
}

