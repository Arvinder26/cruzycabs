// Zero marks an admin session that lasts until it is explicitly revoked.
export const PERSISTENT_ADMIN_EXPIRY = 0;
// Browsers cap persistent cookies at 400 days; operations reads renew this.
export const ADMIN_COOKIE_MAX_AGE = 400 * 86400;
export const CUSTOMER_COOKIE_MAX_AGE = 7 * 86400;

export function sessionToken(headers: Headers) {
  const value = headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith("cc_session="))?.slice(11);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function sessionCookie(value: string, persistentAdmin = false) {
  return `cc_session=${value}; Path=/; Max-Age=${persistentAdmin ? ADMIN_COOKIE_MAX_AGE : CUSTOMER_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}
