import Link from "next/link";

const questions = [
  ["When is my ride confirmed?", "Your request is confirmed when a suitable driver accepts. Payment records your request; check your private booking link for the latest status and assigned vehicle."],
  ["Can I change or cancel my booking?", "You can cancel through your private booking link before the trip starts. Completed card payments are refunded in full; your bank controls when the refund appears. Email operations to change the journey, date or vehicle."],
  ["Where will my airport driver meet me?", "Operations confirms the authorised meeting point for your terminal and vehicle. Collect your bags, check those instructions and match the driver and registration before boarding."],
  ["Can I book for someone else?", "Yes. Enter the passenger’s contact details so they receive the booking link and updates. Add any coordinator instructions in the pickup notes."],
  ["How do I request an accessible vehicle?", "Select wheelchair assistance in the booking form and tell us which equipment is needed. Operations reviews suitability and availability before requesting payment."],
];

export function HelpCentre() {
  return <>
    <section className="support-shortcuts" aria-label="Booking support options">
      <Link href="/manage-booking"><span aria-hidden="true">↗</span><h2>Manage your booking</h2><p>Check status, make payment or cancel.</p><strong>Open booking management →</strong></Link>
      <a href="mailto:operations@cruzycabs.com"><span aria-hidden="true">✉</span><h2>Contact operations</h2><p>Journey changes and booking questions, 24/7.</p><strong>operations@cruzycabs.com →</strong></a>
      <Link href="/lost-property"><span aria-hidden="true">⌕</span><h2>Lost something?</h2><p>Send your trip reference and item details.</p><strong>Report lost property →</strong></Link>
    </section>
    <section className="faq-section section-pad"><div className="section-heading"><span className="eyebrow">Before you travel</span><h2>Answers to common questions.</h2><p>Need something else? Send a message below and include your booking reference if you have one.</p></div><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
  </>;
}
