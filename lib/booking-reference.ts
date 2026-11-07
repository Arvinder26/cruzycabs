// Short booking numbers leave out look-alike characters (0/O, 1/I/L) so customers can read them aloud or type them.
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

// A hex seed keeps a reference stable across retries; without one the reference is random.
export function shortReference(seed?: string) {
  const bytes = seed ? Array.from({ length: 6 }, (_, index) => parseInt(seed.slice(index * 2, index * 2 + 2), 16)) : Array.from(crypto.getRandomValues(new Uint8Array(6)));
  return `CC-${bytes.map(value => alphabet[value % alphabet.length]).join("")}`;
}

// Accepts "cc 7kq4md", "7KQ4MD" or the older long references, and returns the stored form.
export function normaliseReference(value: string) {
  const compact = value.toUpperCase().replace(/[\s-]/g, "");
  const body = compact.startsWith("CC") && [8, 12, 14].includes(compact.length) ? compact.slice(2) : compact;
  return `CC-${body}`;
}
