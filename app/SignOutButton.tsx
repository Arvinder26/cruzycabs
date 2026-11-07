"use client";

import { useState } from "react";

export function SignOutButton({ className = "text-button" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signout" }) });
      if (!response.ok) throw new Error("We could not sign you out. Please retry before leaving this device.");
      // Guest links remain usable from their original email after signing out.
      try { for (const key of Object.keys(sessionStorage)) if (key.startsWith("cc:")) sessionStorage.removeItem(key); } catch { /* Browser storage may be unavailable. */ }
      window.location.replace("/sign-in?signedout=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-out failed. Please retry.");
      setBusy(false);
    }
  }
  return <span className="signout-control"><button type="button" className={className} onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>{error && <span className="signout-error" role="alert">{error}</span>}</span>;
}
