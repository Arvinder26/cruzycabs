import Link from "next/link";
import { business } from "../lib/business";
import { serviceContent } from "../lib/service-content";
import { serviceTitles } from "../lib/seo";

export function ServiceDetails({ slug }: { slug: string }) {
  const content = serviceContent[slug];
  if (!content) return null;
  return <>
    <section className="service-details section-pad" aria-label="Journey and booking details">
      {content.sections.map(section => <article key={section.title}><h2>{section.title}</h2><p>{section.text}</p></article>)}
      <p><strong>{business.bookingHours}.</strong> Driver and vehicle availability must be confirmed. <Link href="/help#enquiry">Contact operations</Link> for help.</p>
    </section>
    <section className="faq-section section-pad" aria-labelledby="service-questions">
      <div className="section-heading"><span className="eyebrow">Plan your journey</span><h2 id="service-questions">Your questions answered.</h2></div>
      <div className="faq-list">{content.questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
    </section>
    <nav className="related-services section-pad" aria-label="Related travel services"><h2>More ways to travel</h2><ul>{content.related.map(slug => <li key={slug}><Link href={`/${slug}`}>{serviceTitles[slug]||(slug==="help"?"Help centre":slug.replaceAll("-"," "))}</Link></li>)}</ul></nav>
  </>;
}
