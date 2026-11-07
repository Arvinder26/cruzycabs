import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AirportGuide } from "../AirportGuide";
import { SiteHeader } from "../SiteHeader";
import { TourPlanner } from "../TourPlanner";
import { EnquiryForm } from "../EnquiryForm";
import { PolicyDetails } from "../PolicyDetails";
import { defaultPricing } from "../../lib/pricing";
import { activePricing } from "../../lib/pricing-store";
import { ensurePlatform } from "../../lib/platform";
import { customerPageCopy } from "../../lib/customer-page-copy";
import { HelpCentre } from "../HelpCentre";
import { databaseConfigured } from "../../lib/config";

import { pageMetadata, publicOrigin, serviceTitles, organizationData } from "../../lib/seo";
import { StructuredData } from "../StructuredData";
import { ServiceDetails } from "../ServiceDetails";
import { serviceContent } from "../../lib/service-content";
import { pageAliases as aliases, publicSlugs } from "../../lib/public-routes";
import { hourlyVanHire } from "../../lib/business";
import { CookiePolicy } from "../CookiePolicy";

type PageContent = { title: string; eyebrow: string; intro: string; facts: [string, string][]; action: string; note?: string; image?: string; imageAlt?: string; visualLabel?: string };

const pages: Record<string, PageContent> = {
  "cruise-transfers": { eyebrow: "Auckland cruise travel", title: "Auckland Cruise Terminal Transfers", intro: "Arrange a private transfer between your Auckland cruise terminal, airport, hotel or local address. Share your ship and luggage details so operations can agree your pickup plan.", facts: [["Your ship and terminal", "Send the ship name, sailing date and terminal from your cruise documents."], ["Room for your group", "Include all passengers, bags and any equipment requirements."], ["An agreed pickup", "Operations confirms the meeting point, timing and full price before travel."]], action: "Request a cruise transfer" },
  "hourly-van-hire": { eyebrow: "Van and private driver", title: "Auckland Private Driver & Hourly Van Hire", intro: `Keep a van and driver for your Auckland meetings, sightseeing or several stops. Guide price from NZ$${hourlyVanHire.rateNZD} per hour including GST, with a ${hourlyVanHire.minimumHours}-hour minimum; request a quote for your itinerary.`, facts: [["Vans only", "Plan for up to 10 passengers and 6 bags, subject to vehicle fit."], ["Your time and stops", "Share the pickup, planned stops and finish time, including waiting."], ["A clear hire quote", "Agree time, distance, charges and availability before confirming."]], action: "Request hourly van hire" },
  "airport-transfers": { eyebrow: "Auckland Airport", title: "Airport travel with fewer unknowns.", intro: "Use a terminal as your pickup or destination, add your flight and follow a clear walking guide to the correct transfer zone. Driver assignment is shown after operations accepts your request and assigns an approved driver.", facts: [["Arriving", "Choose domestic or international as your pickup in one tap, then add your onward address."],["Departing", "Choose either terminal as your destination and keep the full fare visible before you confirm."],["At the terminal", "Your confirmation includes the meeting point, vehicle registration and who to call."]], action: "Book an airport ride" },
  "north-island-transfers": { eyebrow: "Private transfers", title: "Auckland to the North Island, your way.", intro: "One-way, return and multi-stop private journeys with space for luggage, comfort breaks and a real operational review when the distance demands it.", facts: [["Instant where credible", "Common feasible journeys receive an indicative price and suitable vehicle choices."],["Reviewed when complex", "Long-distance driver return, rest, charging or accommodation may require human confirmation."],["Honest status", "A request is never described as confirmed until vehicle capacity is reserved."]], action: "Plan a transfer", image: "/images/north-island-map-clean.webp", imageAlt: "Illustrated North Island route from Auckland through Rotorua to Wellington", visualLabel: "Auckland to Wellington" },
  "private-tours": { eyebrow: "Private touring", title: "A North Island itinerary built around your group.", intro: "Day trips and multi-day private tours from Auckland, with a structured request covering pace, interests, mobility, luggage and accommodation.", facts: [["Private by default", "Vehicle and itinerary are prepared for your group, subject to operating capacity."],["Versioned itinerary", "Stops, attraction costs and driver expenses can be quoted and amended with a full history."],["Clear inclusions", "Admission, guiding and cultural interpretation are never implied unless contracted."]], action: "Request a tour plan", image: "/images/private-tour-hero.webp", imageAlt: "Private van travelling through native North Island bush beside a lake", visualLabel: "Private North Island touring" },
  "accessible-travel": { eyebrow: "Accessible travel", title: "Requirements that change the match, not just the notes.", intro: "Tell us whether a passenger remains in a wheelchair, needs a ramp or hoist, brings a service animal or needs more boarding time before payment.", facts: [["Structured matching", "Vehicle capability records prevent an incompatible assignment."],["Availability first", "An accessible ride is not confirmed unless suitable equipment can be reserved."],["Human assistance", "Phone-assisted booking remains visible for complex or urgent needs."]], action: "Book accessible travel", note: "Total Mobility eligibility and subsidy estimates require current Auckland Transport validation." },
  "business-travel": { eyebrow: "Business travel", title: "Punctual travel with the records finance needs.", intro: "Tell us about recurring employee and visitor travel. Operations will agree booking contacts, reporting and billing arrangements with your organisation.", facts: [["Book on behalf", "Traveller contact stays separate from the booking coordinator."],["Policy controls", "Discuss service classes, spend limits and project codes with operations before a corporate arrangement is approved."],["Consolidated records", "Each booking records the agreed fare. Corporate invoicing terms are agreed separately."]], action: "Apply for a corporate account" },
  "auckland-rides": { eyebrow: "Local Auckland travel", title: "A clear local fare before you confirm.", intro: "Immediate and scheduled trips across configurable Auckland service zones, matched only when the vehicle can credibly serve the pickup.", facts: [["All known fees", "The displayed total includes GST and compulsory known adjustments."],["Suitable vehicles", "Passenger, luggage, child-seat, accessibility and pet needs influence matching."],["No false assignment", "Booking received and driver assigned remain different, explicit states."]], action: "Get an Auckland price" },
  "help": { eyebrow: "Help centre", title: "Useful answers when plans change.", intro: "Find booking support, airport meeting guidance, cancellation information and the right escalation path without searching through policy jargon.", facts: [["Can’t find the driver", "Check the verified vehicle details, meeting point and last live-location update before calling."],["Booking changes", "Use Manage booking to view status or cancel before the trip starts. Contact operations for journey changes."],["Emergency", "The site does not replace calling 111 during an emergency."]], action: "Manage a booking" },
  "safety": { eyebrow: "Safety", title: "Identity, status and human escalation.", intro: "Operations verifies drivers and vehicles before approval. Your booking shows the assigned driver and registration after acceptance; concerns can be recorded through support.", facts: [["Before you enter", "Confirm the driver name, vehicle colour and registration plate."],["During the trip", "Keep your booking reference available and check the time of the last driver location update."],["If something is wrong", "Contact support, follow emergency instructions and call 111 when necessary."]], action: "Read safety guidance" },
  "pricing": { eyebrow: "Transparent pricing", title: "One total, with the reasons behind it.", intro: "Every quote records its inputs and pricing-rule version. Current fares use published rate versions. Existing booking fares are preserved when new rates are published.", facts: [["Included", "Base fare, time, distance, GST and known compulsory fees."],["Change control", "A fare is recalculated only when material journey details change."],["Demand", "If demand affects a fare, the interface says so and shows the adjustment."]], action: "Estimate a fare" },
  "lost-property": { eyebrow: "Lost property", title: "Tell us what was left behind.", intro: "Create a support case with your booking reference, item description and a safe contact method. Driver contact details are not exposed directly.", facts: [["Locate the trip", "A booking reference helps support contact the correct provider."],["Protect privacy", "Do not include payment data or unnecessary sensitive information."],["Track progress", "Case events form an auditable history until resolved."]], action: "Contact support" },
  "complaints": { eyebrow: "Complaints and feedback", title: "A clear path to review and resolution.", intro: "Complaints, fare disputes and serious incidents are recorded separately, preserved appropriately and routed to staff with the correct permissions.", facts: [["What happened", "Provide the booking reference, date and a concise account."],["What we retain", "Access to journey, payment and location evidence is logged."],["Next steps", "You receive a case reference and honest status updates."]], action: "Submit feedback" },
  "privacy": { eyebrow: "Privacy", title: "Only the information needed to quote and fulfil travel.", intro: "cruzycabs is designed to minimise location data, separate marketing consent and provide access, correction, export and deletion workflows subject to lawful retention.", facts: [["Purpose", "Data is collected to quote, fulfil travel, process payment, meet obligations and operate support."],["Access", "Staff access to sensitive journey data is permissioned and logged."],["Control", "Customers can request correction, export or deletion where allowed."]], action: "Contact the privacy officer", note: "Privacy statement requires New Zealand professional review before launch." },
  "terms": { eyebrow: "Customer terms", title: "Plain-language terms, prepared for professional review.", intro: "Booking states, agreed fare basis, customer responsibilities, cancellation and dispute processes are editable operational content, not hidden source-code assumptions.", facts: [["Before booking", "Review the journey, total, payment method and cancellation terms."],["After booking", "Status messages distinguish receipt, payment and driver assignment."],["When plans change", "Policy outcomes and authorised adjustments create audit events."]], action: "Return to booking", note: "Terms and conditions have not yet received legal sign-off." },
  "accessibility-statement": { eyebrow: "Accessibility statement", title: "Designed for WCAG 2.2 AA and real travel stress.", intro: "Core booking supports keyboard navigation, strong focus states, large targets, plain language, zoom, reduced motion and list-based alternatives to maps.", facts: [["Known standard", "WCAG 2.2 AA is the acceptance target for every surface."],["Human testing", "Critical tasks still require testing with screen readers and keyboard users."],["Tell us", "Accessibility feedback should create a tracked support case."]], action: "Book with accessibility needs" },
  "driver-application": {eyebrow:"Drive with cruzycabs",title:"Apply to join our driver network.",intro:"Tell operations about your experience, licence, vehicle and preferred shifts. Approval requires verified compliance and operating permissions.",facts:[["Contact","We will discuss availability and the operating model."],["Compliance","Licensing, endorsements, vehicle fitness and insurance are reviewed before approval."],["Activation","Only approved drivers receive job offers."]],action:"Apply to drive"},
  "partner-fleet-application": {eyebrow:"Fleet partnerships",title:"Bring your fleet to cruzycabs.",intro:"Send your service areas, vehicle capabilities and operational contact details. We review compliance and agree commercial terms before activation.",facts:[["Coverage","Describe zones, hours and vehicle capacity."],["Verification","Driver and vehicle compliance is checked before allocation."],["Agreement","Commercial and settlement terms are agreed separately."]],action:"Enquire about a fleet partnership"},
};

// Search-result descriptions for pages whose intro is too long to show in full (~155 characters).
const metaDescriptions: Record<string, string> = {
  help: "Manage a cruzycabs booking, get help with a journey or email operations@cruzycabs.co.nz. Booking requests are open 24/7.",
};

function canonicalSlug(slug: string) {
  return Object.hasOwn(aliases, slug) ? aliases[slug] : slug;
}
function contentFor(slug: string) {
  const canonical = canonicalSlug(slug);
  if (!publicSlugs.some(value => value === canonical)) return undefined;
  return { ...pages[canonical], ...customerPageCopy[canonical] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const page = contentFor(slug); if (!page) notFound();
  const canonical = canonicalSlug(slug);
  return pageMetadata(serviceTitles[canonical] || page.title.replace(/\.$/, ""), serviceContent[canonical]?.description || metaDescriptions[canonical] || page.intro, `/${canonical}`);
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const page = contentFor(slug); if (!page) notFound();
  const canonical = canonicalSlug(slug);
  if (slug !== canonical) permanentRedirect(`/${canonical}`);
  const supportPage=canonical==="help";
  const compactPage=["help","privacy","terms","lost-property","complaints","accessibility-statement","driver-application","partner-fleet-application","pricing","safety"].includes(canonical);
  const storageReady=databaseConfigured();
  let rates=defaultPricing;if(slug==="pricing"&&storageReady){await ensurePlatform();rates=await activePricing();}
  const image = page.image || "/images/kauri-route-panorama.webp";
  const imageAlt = page.imageAlt || "cruzycabs journey from Auckland into the North Island";
  const imageSize = image.includes("north-island-map") ? [1122, 1402] : image.includes("private-tour-hero") ? [1536, 1024] : [1774, 887];
  const enquiryKinds: Record<string,string> = {"cruise-transfers":"journey","hourly-van-hire":"journey",help:"support",contact:"support","lost-property":"lost-property",complaints:"complaint",privacy:"privacy","business-travel":"corporate","corporate-accounts":"corporate","driver-application":"driver","partner-fleet-application":"partner","accessibility-statement":"accessibility","north-island-transfers":"journey"};
  const enquiryKind = enquiryKinds[slug]||enquiryKinds[canonical];
  const heroAction = supportPage?"/manage-booking":canonical==="safety"?"/help":enquiryKind ? "#enquiry" : canonical === "private-tours" ? "#tour-planner" : "/#journey-form";
  return <main className="content-page">
    <StructuredData data={{
      "@context": "https://schema.org", "@graph": [
        organizationData(),
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: publicOrigin() },
          { "@type": "ListItem", position: 2, name: serviceTitles[canonical] || page.eyebrow, item: `${publicOrigin()}/${canonical}` },
        ] },
        ...(serviceTitles[canonical] && canonical !== "pricing" ? [{
          "@type": "Service", name: serviceTitles[canonical], description: page.intro,
          url: `${publicOrigin()}/${canonical}`, provider: { "@id": `${publicOrigin()}/#organization` },
          serviceType: serviceTitles[canonical],
          areaServed: { "@type": "Place", name: canonical === "private-tours" || canonical === "north-island-transfers" ? "North Island, New Zealand" : "Auckland, New Zealand" },
          ...(canonical === "hourly-van-hire" ? { offers: { "@type": "Offer", priceCurrency: "NZD", url: `${publicOrigin()}/hourly-van-hire`,
            priceSpecification: { "@type": "UnitPriceSpecification", price: hourlyVanHire.rateNZD, priceCurrency: "NZD", unitCode: "HUR", valueAddedTaxIncluded: true,
              eligibleQuantity: { "@type": "QuantitativeValue", minValue: hourlyVanHire.minimumHours, unitCode: "HUR" } } } } : {}),
        }] : []),
      ],
    }} />
    <SiteHeader activeSlug={slug} />
    <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li aria-current="page">{serviceTitles[canonical] || page.eyebrow}</li></ol></nav>
    <section className={`content-hero ${compactPage?"content-hero-compact":""}`}>
      <div><span className="eyebrow">{page.eyebrow}</span><h1>{serviceTitles[canonical] || page.title}</h1><p>{page.intro}</p><a className="button button-primary" href={heroAction}>{page.action}</a></div>
      {!compactPage&&<figure className={`content-media ${page.image?.includes("north-island-map") ? "map-media" : ""}`}><Image src={image} alt={imageAlt} width={imageSize[0]} height={imageSize[1]} sizes="(max-width: 900px) 100vw, 45vw" decoding="async" /><figcaption><span>{page.visualLabel || "Auckland to anywhere"}</span><strong>Planned around you</strong></figcaption></figure>}
    </section>
    {supportPage&&<HelpCentre/>}
    {page.facts.length>0&&<section className="content-facts">{page.facts.map(([title,text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</section>}
    <ServiceDetails slug={canonical} />
    {slug === "airport-transfers" && <AirportGuide />}
    {slug === "private-tours" && <TourPlanner submissionAvailable={storageReady} />}
    {enquiryKind && <EnquiryForm kind={enquiryKind} title={supportPage?"Send us a message":page.action} initialDetails={canonical === "hourly-van-hire" ? "Hourly van hire enquiry\nDate and pickup time: \nPickup and finish addresses: \nPlanned stops and waiting: \nHours required: \nPassengers and luggage: \nEquipment needs: " : canonical === "cruise-transfers" ? "Cruise transfer enquiry\nShip, date and terminal: \nExpected pickup time: \nPickup and destination: \nFlight details or deadline: \nPassengers, luggage and equipment: " : ""} submissionAvailable={storageReady} />}
    {["terms","privacy"].includes(aliases[slug]||slug) && <PolicyDetails kind={aliases[slug]||slug} />}
    {canonical === "privacy" && <CookiePolicy />}
    {slug === "pricing" && <section className="pricing-details section-pad">
      <div className="section-heading split"><div><span className="eyebrow">Pricing version {rates.version}</span><h2>Every rate,<br />in plain sight.</h2></div><p>These are the current server rates. Online quotes use road distance and travel time when the routing provider is connected. Specialised journeys require review.</p></div>
      <div className="pricing-table" role="table" aria-label="cruzycabs preview rates">
        <div role="row"><span role="cell">Base fare</span><strong role="cell">${(rates.baseCents/100).toFixed(2)}</strong><small role="cell">Every journey</small></div>
        <div role="row"><span role="cell">Auckland distance</span><strong role="cell">${(rates.cityKmCents/100).toFixed(2)} / km</strong><small role="cell">Up to 95 km</small></div>
        <div role="row"><span role="cell">Auckland time</span><strong role="cell">${(rates.cityMinuteCents/100).toFixed(2)} / min</strong><small role="cell">Route duration</small></div>
        <div role="row"><span role="cell">Long-distance rates</span><strong role="cell">${(rates.longKmCents/100).toFixed(2)} / km + ${(rates.longMinuteCents/100).toFixed(2)} / min</strong><small role="cell">Plus ${(rates.returnKmCents/100).toFixed(2)} / km return allowance and 1.55× journey factor</small></div>
        <div role="row"><span role="cell">Allowances</span><strong role="cell">Schedule ${(rates.scheduledCents/100).toFixed(2)} · Airport ${(rates.airportCents/100).toFixed(2)}</strong><small role="cell">Child seat ${(rates.childSeatCents/100).toFixed(2)} · Pet ${(rates.petCents/100).toFixed(2)}</small></div>
      </div>
      <div className="vehicle-factors"><span>Van 1.48×</span><span>Accessible 1.36×</span></div>
      <p className="pricing-note">GST is included. Live demand pricing is not applied. Your quote itemises allowances and vehicle factors.</p>
      <p>For a van and driver retained between local stops, <Link href="/hourly-van-hire">hourly van hire</Link> starts at NZ${hourlyVanHire.rateNZD} per hour including GST, with a {hourlyVanHire.minimumHours}-hour minimum. Time, distance and any additional charges are agreed separately from point-to-point fares.</p>
    </section>}
    {page.note && canonical !== "accessible-travel" && <aside className="review-callout"><strong>Review before launch</strong><p>{page.note}</p></aside>}
    <section className="content-cta"><span className="eyebrow">Plan your next journey</span><h2>{slug === "private-tours" ? "Turn your destination wish list into a private itinerary." : "Agree your journey and price before you travel."}</h2><a className="button button-light" href={heroAction}>{page.action}</a></section>
  </main>;
}

