"use client";

import { openCookieSettings } from "../lib/consent-store";

export function CookieSettingsButton() {
  return <button type="button" className="cookie-settings-button" onClick={openCookieSettings}>Cookie settings</button>;
}
