import Link from "next/link";
type SiteHeaderProps = {
  activeSlug?: string;
  bookHref?: string;
  compact?: boolean;
};

const links = [
  { label: "Tours", href: "/private-tours", slug: "private-tours" },
  { label: "Airport", href: "/airport-transfers", slug: "airport-transfers" },
  { label: "North Island", href: "/north-island-transfers", slug: "north-island-transfers" },
  { label: "Accessibility", href: "/accessible-travel", slug: "accessible-travel" },
  { label: "Business", href: "/business-travel", slug: "business-travel" },
  { label: "Help", href: "/help", slug: "help" },
];

function Navigation({ activeSlug }: { activeSlug?: string }) {
  return <>{links.map((link) => <Link
    key={link.slug}
    href={link.href}
    className={activeSlug === link.slug ? "active" : ""}
    aria-current={activeSlug === link.slug ? "page" : undefined}
  >{link.label}</Link>)}</>;
}

export function SiteHeader({ activeSlug, bookHref = "/#journey-form", compact = false }: SiteHeaderProps) {
  return <header className={`site-header ${compact ? "compact-header" : ""}`}>
    <Link className="brand" href="/" aria-label="cruzycabs home">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>cruzycabs</span>
    </Link>
    <nav className="desktop-nav" aria-label="Main navigation"><Navigation activeSlug={activeSlug} /></nav>
    <div className="header-actions">
      <Link className="button button-ghost account-button" href="/account">Account</Link>
      <Link className="button button-primary" href={bookHref}>Book now</Link>
      <details className="mobile-nav">
        <summary aria-label="Open navigation"><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></summary>
        <nav aria-label="Mobile navigation"><Navigation activeSlug={activeSlug} /><Link href="/account">Account</Link></nav>
      </details>
    </div>
  </header>;
}

