import Link from "next/link";
export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-brand">
      <Link className="brand light" href="/" aria-label="cruzycabs home"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>cruzycabs</span></Link>
      <p>Local rides, airport transfers and private North Island journeys, all in one place.</p>
    </div>
    <div><h3>Travel</h3><Link href="/#journey-form">Book a ride</Link><Link href="/airport-transfers">Airport transfers</Link><Link href="/accessible-travel">Accessible travel</Link><Link href="/private-tours">Private tours</Link></div>
    <div><h3>Support</h3><Link href="/manage-booking">Manage booking</Link><Link href="/help">Help centre</Link><Link href="/lost-property">Lost property</Link><Link href="/complaints">Complaints</Link></div>
    <div><h3>About</h3><Link href="/safety">Safety</Link><Link href="/pricing">How pricing works</Link><Link href="/business-travel">Business travel</Link><Link href="/driver-application">Drive with us</Link></div>
    <div className="footer-bottom"><span>© 2026 cruzycabs · Open 24/7 · <Link href="mailto:operations@cruzycabs.co.nz">operations@cruzycabs.co.nz</Link></span><span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/accessibility-statement">Accessibility</Link></span></div>
  </footer>;
}

