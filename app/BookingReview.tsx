"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export function BookingReview({ reference, access, submitted = false, googleReviewUrl }: {
  reference: string; access: string; submitted?: boolean; googleReviewUrl: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(submitted);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bookings/review", { method: "POST", headers: {
        "Content-Type": "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}),
      }, body: JSON.stringify({ reference, rating, comment }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your feedback could not be saved. Please try again.");
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <section className="thank-you-review" aria-labelledby="review-heading">
    <span className="eyebrow">Your experience matters</span>
    <h2 id="review-heading">How did we do?</h2>
    <p>Share your honest experience of booking or travelling with cruzycabs. Every rating is welcome.</p>
    {googleReviewUrl && <div className="google-review-option"><a className="button button-primary" href={googleReviewUrl} target="_blank" rel="noopener noreferrer">Leave a Google review <span aria-hidden="true">↗</span></a><small>Opens Google in a new tab. Please review only your own experience.</small></div>}
    {reference ? saved ? <div className="review-saved" role="status"><strong>Thank you for your feedback.</strong><p>Your review has been saved privately for our team.</p></div> : <form onSubmit={submit} aria-busy={busy}>
      <h3>Send a private review to our team</h3>
      <fieldset className="review-rating" disabled={busy}><legend>Your rating</legend><div>{[1, 2, 3, 4, 5].map(value => <label key={value} className={rating === value ? "selected" : ""}><input required type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} /><span aria-hidden="true">★</span><span>{value}</span><span className="sr-only"> {value === 1 ? "star" : "stars"}</span></label>)}</div></fieldset>
      <label>Your review <span className="optional">optional</span><textarea rows={4} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} disabled={busy} placeholder="Tell us about your experience. Please leave out private journey or passenger details." /></label>
      <p className="form-privacy">This goes privately to our team and is not published on Google or the website. <Link href="/privacy">Privacy information</Link></p>
      {error && <p className="error-summary" role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy}>{busy ? "Saving your review…" : "Send my review"}</button>
    </form> : <p>Open your private booking link or <Link href="/sign-in?next=/manage-booking">sign in with your booking email</Link> to send a review to our team.</p>}
  </section>;
}
