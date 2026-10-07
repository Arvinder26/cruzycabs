"use client";
import { useState,type FormEvent } from "react";
import Link from "next/link";
export function EnquiryForm({kind,initialDetails="",title="Send your request",submissionAvailable=true}:{kind:string;initialDetails?:string;title?:string;submissionAvailable?:boolean}){
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[retryKey]=useState(()=>crypto.randomUUID());
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");const form=new FormData(event.currentTarget);try{const response=await fetch("/api/requests",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":retryKey},body:JSON.stringify({kind,name:form.get("name"),email:form.get("email"),phone:form.get("phone"),details:form.get("details"),bookingReference:form.get("bookingReference"),consent:form.get("consent")==="on",website:form.get("website")})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not send request.");setMessage(`Request recorded: ${data.reference}. Operations will contact you.`);setSubmitted(true);}catch(error){setMessage(error instanceof Error?error.message:"Could not send request. Please retry.");}finally{setBusy(false);}}
  if(!submissionAvailable)return <section className="enquiry-section section-pad" id="enquiry"><div className="section-heading"><span className="eyebrow">Contact operations</span><h2>{title}</h2><p>Online requests are being activated. Please email <a href="mailto:operations@cruzycabs.com">operations@cruzycabs.com</a> about your journey or question. No booking has been recorded or payment taken.</p></div></section>;
  return <section className="enquiry-section section-pad" id="enquiry">
    <div className="section-heading"><span className="eyebrow">Operations · available 24/7</span><h2>{title}</h2><p>We’ll contact you using the details you provide. For urgent booking help, email <a href="mailto:operations@cruzycabs.com">operations@cruzycabs.com</a>.</p><p className="contact-emergency">In an emergency, call 111.</p></div>
    {submitted?<div className="enquiry-form utility-card enquiry-success" role="status"><span className="success-mark" aria-hidden="true">✓</span><h3>Your request is with our team.</h3><p>{message}</p><p>Keep your reference handy. This enquiry does not confirm travel or take payment.</p><Link className="button button-ghost" href="/help">Visit the help centre</Link></div>:<form className="enquiry-form utility-card" onSubmit={submit} aria-busy={busy}>
      <label>Name<input name="name" required maxLength={100} autoComplete="name" placeholder="Your full name" /></label>
      <div className="form-row"><label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label><label>Phone<input name="phone" type="tel" required placeholder="e.g. +64 21 123 4567" autoComplete="tel" /></label></div>
      <label>Booking reference <span className="optional">optional</span><input name="bookingReference" maxLength={30} placeholder="If this is about an existing booking"/></label>
      <label>How can we help?<textarea key={initialDetails} name="details" defaultValue={initialDetails} required maxLength={6000} rows={6} placeholder="Tell us about your journey or question."/></label>
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
      <label className="toggle-line"><input name="consent" type="checkbox" required/><span>I agree to be contacted about this request.</span></label>
      <p className="form-privacy">Please avoid card details or sensitive medical information. <Link href="/privacy">Privacy information</Link></p>
      {message&&<p role="alert">{message}</p>}
      <button className="button button-primary" disabled={busy}>{busy?"Sending your request…":"Send request"}<span aria-hidden="true">→</span></button>
    </form>}
  </section>;
}
