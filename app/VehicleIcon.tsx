type VehicleKind = "car" | "van" | "accessible" | "executive";

export function WheelchairIcon() {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="27" cy="8" r="3" fill="currentColor" stroke="none" />
    <path d="m24 15-2 13h12l5 12h5M24 19h11M17 23a11 11 0 1 0 13 15" />
  </svg>;
}

export function VehicleIcon({ kind }: { kind: VehicleKind }) {
  const van = kind === "van" || kind === "accessible";
  return <svg className={`vehicle-illustration vehicle-illustration-${kind}`} viewBox="0 0 240 120" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 105h216" stroke="#d9ded9" strokeWidth="2" />
    {van ? <>
      <path d="M25 85V36a8 8 0 0 1 8-8h133l28 30 18 8v19H25Z" fill="#e6efeb" />
      <path d="M38 40h29v21H38zM79 40h29v21H79zM120 40h32v21h-32zM166 40l19 21h-19zM115 35v43M155 35v43M124 70h12M199 73h12" />
      {kind === "accessible" && <g transform="translate(199 20)"><circle r="19" fill="#123d32" stroke="none" /><g transform="translate(-13 -14) scale(.75)" stroke="#fff" strokeWidth="2.5"><circle cx="18" cy="1" r="3" fill="#fff" stroke="none" /><path d="m16 8-2 13h13l5 10M17 12h10M10 17a10 10 0 1 0 12 16" /></g></g>}
    </> : <>
      <path d={kind === "executive" ? "M22 85V68l32-10 29-27h70l35 30 25 9v15H22Z" : "M28 85V65l28-8 25-26h66l27 27 32 12v15H28Z"} fill={kind === "executive" ? "#fdf0d5" : "#e6efeb"} />
      <path d="m69 57 20-18h23v18H69ZM123 39h19l21 18h-40V39ZM117 64v15M127 67h10M33 71h13M190 73h14" />
      {kind === "executive" && <path d="m202 18 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="#f4a62a" stroke="#f4a62a" strokeWidth="1.5" />}
    </>}
    <circle cx="58" cy="85" r="14" fill="#123d32" />
    <circle cx="180" cy="85" r="14" fill="#123d32" />
    <circle cx="58" cy="85" r="6" fill="#fff" stroke="none" />
    <circle cx="180" cy="85" r="6" fill="#fff" stroke="none" />
  </svg>;
}
