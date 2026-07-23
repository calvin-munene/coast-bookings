"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

export function SavePropertyButton({ propertyId, propertyName }: Readonly<{ propertyId: string; propertyName: string }>) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const response = await fetch("/api/favourites", { method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId }) });
    if (response.status === 401) { window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`); return; }
    if (response.ok) setSaved((value) => !value);
    setBusy(false);
  }
  return <button type="button" className={`heart-button card-heart ${saved ? "saved" : ""}`} aria-label={`${saved ? "Remove" : "Save"} ${propertyName}`} aria-pressed={saved} disabled={busy} onClick={toggle}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>;
}
