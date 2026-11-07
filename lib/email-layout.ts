
// Every outbox email is written as plain text. This turns it into a clean branded HTML email:
// "Key: value" lines become a details table, links become buttons, and the operations signature is the footer.
// The plain-text part keeps the same content with the text signature, for mail apps that do not show HTML.

const green = "#123d32", amber = "#f4a62a", ink = "#17201d", muted = "#58635f", line = "#e3e8e5";
const font = "font-family:Arial,Helvetica,sans-serif;";
const urlPattern = /https?:\/\/[^\s<>"]+/g, hasUrl = /https?:\/\//;
const detailPattern = /^([A-Z][A-Za-z0-9 ()/'&-]{1,38}): (.+)$/;

export const textSignature = ["Kind regards,", "", "Operations Team", "cruzycabs", "operations@cruzycabs.co.nz", "https://cruzycabs.co.nz", "", "Auckland & North Island travel", "Bookings open 24/7"].join("\n");

function escape(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function linkify(value: string) {
  return value.split(urlPattern).map(escape).reduce((html, part, index, parts) => html + part + (index < parts.length - 1 ? (() => { const url = value.match(urlPattern)![index]; return `<a href="${escape(url)}" style="color:${green};">${escape(url.replace(/^https?:\/\//, "").split(/[?#]/)[0])}</a>`; })() : ""), "");
}
function buttonLabel(url: string) {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  if (path.startsWith("/manage-booking")) return "View your booking";
  if (path.startsWith("/driver")) return "Open driver workspace";
  if (path.startsWith("/dispatch") || path.startsWith("/admin")) return "Open dispatch";
  if (path.startsWith("/thank-you")) return "Leave a review";
  if (path.startsWith("/sign-in")) return "Sign in";
  return "Open link";
}
function button(url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr><td style="background-color:${green};border-radius:6px;"><a href="${escape(url)}" style="display:inline-block;padding:12px 22px;${font}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escape(buttonLabel(url))}</a></td></tr></table>`;
}
function paragraph(value: string) { return `<p style="margin:0 0 16px;${font}font-size:15px;line-height:23px;color:${ink};">${linkify(value)}</p>`; }
function details(rows: [string, string][]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 20px;border:1px solid ${line};border-radius:6px;">${rows.map(([key, value], index) => `<tr><td style="padding:10px 14px;${index ? `border-top:1px solid ${line};` : ""}${font}font-size:13px;line-height:19px;color:${muted};width:38%;vertical-align:top;">${escape(key)}</td><td style="padding:10px 14px;${index ? `border-top:1px solid ${line};` : ""}${font}font-size:14px;line-height:20px;color:${ink};font-weight:bold;vertical-align:top;">${linkify(value)}</td></tr>`).join("")}</table>`;
}

function body(text: string) {
  const blocks: string[] = [];
  let rows: [string, string][] = [];
  const flush = () => { if (rows.length) { blocks.push(details(rows)); rows = []; } };
  for (const raw of text.split(/\r?\n/)) {
    const value = raw.trim();
    if (!value) { flush(); continue; }
    if (/^https?:\/\/\S+$/.test(value)) { flush(); blocks.push(button(value)); continue; }
    const detail = detailPattern.exec(value);
    if (detail && !hasUrl.test(detail[1])) { rows.push([detail[1], detail[2]]); continue; }
    flush();
    // A sentence ending in a link reads better as the sentence followed by a button.
    const trailing = /^(.*?)[:\s]+(https?:\/\/\S+?)([.]?)$/.exec(value);
    if (trailing && trailing[1] && !hasUrl.test(trailing[1])) { blocks.push(paragraph(trailing[1].replace(/[,;:]$/, "") + ".")); blocks.push(button(trailing[2])); continue; }
    blocks.push(paragraph(value));
  }
  flush();
  return blocks.join("");
}

const htmlSignature = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${font}font-size:13px;line-height:20px;color:${ink};"><tr><td style="padding:0 0 16px;">Kind regards,</td></tr><tr><td style="border-left:3px solid ${amber};padding:0 0 0 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${font}"><tr><td style="padding:0;font-size:15px;line-height:22px;font-weight:bold;color:${green};">Operations Team</td></tr><tr><td style="padding:2px 0 10px;font-size:24px;line-height:29px;font-weight:bold;letter-spacing:-0.5px;color:${green};">cruzycabs</td></tr><tr><td style="padding:0;font-size:13px;line-height:22px;"><a href="mailto:operations@cruzycabs.co.nz" style="color:${green};text-decoration:none;">operations@cruzycabs.co.nz</a></td></tr><tr><td style="padding:0;font-size:13px;line-height:22px;"><a href="https://cruzycabs.co.nz" style="color:${green};text-decoration:underline;">cruzycabs.co.nz</a></td></tr><tr><td style="padding:10px 0 0;font-size:12px;line-height:19px;color:${muted};">Auckland &amp; North Island travel<br>Bookings open 24/7</td></tr></table></td></tr></table>`;

export function emailHtml(subject: string, text: string) {
  return `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;padding:0;background-color:#f3f5f4;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f5f4;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;"><tr><td style="background-color:${green};padding:18px 28px;${font}font-size:22px;font-weight:bold;letter-spacing:-0.5px;color:#ffffff;">cruzycabs</td></tr><tr><td style="height:4px;line-height:4px;font-size:0;background-color:${amber};">&nbsp;</td></tr><tr><td style="padding:28px 28px 8px;"><h1 style="margin:0 0 18px;${font}font-size:20px;line-height:27px;color:${green};">${escape(subject)}</h1>${body(text)}</td></tr><tr><td style="padding:8px 28px 28px;border-top:1px solid ${line};"><div style="height:20px;line-height:20px;">&nbsp;</div>${htmlSignature}</td></tr></table></td></tr></table></body></html>`;
}

export function emailText(text: string) { return `${text}\n\n${textSignature}`; }
