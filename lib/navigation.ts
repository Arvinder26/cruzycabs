// Accept only same-origin absolute paths, including browser backslash rules.
export function internalPath(value: string | null | undefined, fallback = "/account") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || Array.from(value).some(char=>char.charCodeAt(0)<=32)) return fallback;
  try {
    const base = "https://cruzycabs.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}
