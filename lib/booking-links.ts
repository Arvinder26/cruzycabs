export function thankYouPath(reference: string, access = "", paymentReturn = false) {
  const query = new URLSearchParams({ ref: reference });
  if (paymentReturn) query.set("payment", "return");
  return `/thank-you?${query}${access ? `#token=${encodeURIComponent(access)}` : ""}`;
}
