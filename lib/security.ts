import { setting, siteOrigin, localPreview } from "./config";

export class HttpError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
export async function endpoint(work: () => Promise<Response>) {
  try { return await work(); } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error(JSON.stringify({ event: "request.failed", category: error instanceof Error ? error.name : "unknown" }));
    return json({ error: "This service is temporarily unavailable. Please retry or contact support." }, 503);
  }
}
export async function readObject(request: Request, maxBytes = 16000): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError("Use JSON for this request.", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) throw new HttpError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Request body is required.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) { await reader.cancel(); throw new HttpError("Request is too large.",413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError("Invalid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError("An object is required.");
  return value as Record<string,unknown>;
}
export function text(value: unknown, label: string, max = 250, optional = false) {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new HttpError(`${label} is required and must be at most ${max} characters.`);
  return value.trim();
}
export function email(value: unknown) { const v = text(value,"Email",254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError("Enter a valid email address."); return v; }
export function phone(value: unknown) { const v=text(value,"Mobile number",30).replace(/[\s()-]/g,""); if (!/^\+[1-9]\d{7,14}$/.test(v)) throw new HttpError("Use an international phone number, such as +64211234567."); return v; }
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== siteOrigin()) throw new HttpError("Request origin is not allowed.",403);
}
export function token() { return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join(""); }
export async function sha(value: string) { return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))); }
function hex(value: ArrayBuffer) { return Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,"0")).join(""); }
export async function hmac(value: string, secret: string) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
}
export function equal(a: string,b: string) { let result=a.length ^ b.length; for(let i=0;i<Math.max(a.length,b.length);i++) result |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0); return result===0; }
export function signingSecret() { const secret=setting("APP_SIGNING_SECRET"); if(secret.length<32) throw new HttpError("Secure booking access has not been configured.",503); return secret; }
export async function managementToken(id: string) { return hmac(`booking-access:${id}`,signingSecret()); }
export function bearer(request: Request) { return request.headers.get("authorization")?.replace(/^Bearer /,"") || ""; }
export function previewEmail() { return localPreview() ? "preview@cruzycabs.local" : null; }
