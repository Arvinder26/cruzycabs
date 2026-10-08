const terminals = [
  { name: "Domestic", code: "DOM", description: "Flights within New Zealand", className: "domestic" },
  { name: "International", code: "INT", description: "Flights arriving from overseas", className: "international" },
];

export function AirportGuide() {
  return <section className="airport-guide section-pad" id="pickup-guide">
    <div className="section-heading split">
      <div><span className="eyebrow">Your airport pickup</span><h2>From arrivals<br />to your ride.</h2></div>
      <p>Choose your terminal and follow three simple steps. Operations will confirm the meeting point for your vehicle before pickup.</p>
    </div>
    <div className="terminal-guide-grid">
      {terminals.map(terminal => <article className={`terminal-guide-card terminal-guide-${terminal.className}`} key={terminal.code}>
        <header className="terminal-guide-head">
          <div className="terminal-guide-heading">
            <span className="terminal-code" aria-hidden="true">{terminal.code}</span>
            <div><p className="terminal-guide-label">{terminal.description}</p><h3>{terminal.name} arrivals</h3></div>
          </div>
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 17 9 2 6-5-2-9 3-2 4 8 4-3a2 2 0 0 1 3 3l-17 14-8-5 1-3ZM4 29h24" /></svg>
        </header>
        <ol>
          <li><strong>Share your flight details</strong><p>Select the {terminal.name.toLowerCase()} terminal, add your flight number and provide the passenger’s contact details.</p></li>
          <li><strong>Collect your bags</strong><p>Once you’re ready to leave arrivals, check the pickup instructions supplied by operations.</p></li>
          <li><strong>Meet your confirmed driver</strong><p>Match the driver and vehicle registration before boarding. Contact operations if you need help finding them.</p></li>
        </ol>
        <div className="terminal-guide-footer"><span aria-hidden="true">✓</span> Follow the meeting point confirmed for your booking.</div>
      </article>)}
    </div>
    <aside className="airport-rank-note">
      <div><strong>Check your meeting point before you travel</strong><p>Taxi ranks, shuttle zones and private transfer lanes serve different vehicles. Use the instructions confirmed by operations.</p></div>
      <a href="https://www.aucklandairport.co.nz/en/transport/taxis-and-shuttles" target="_blank" rel="noreferrer">Airport transport guide <span aria-hidden="true">↗</span></a>
    </aside>
  </section>;
}
