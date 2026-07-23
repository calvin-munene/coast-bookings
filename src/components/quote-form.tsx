"use client";

import { useState } from "react";

export function QuoteForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(undefined);
    try {
      const budgetKes = Number(formData.get("budgetKes") ?? 0);
      formData.delete("budgetKes");
      if (Number.isFinite(budgetKes) && budgetKes > 0) formData.set("budgetMinor", String(Math.round(budgetKes * 100)));
      const response = await fetch("/api/group-enquiries", { method: "POST", body: formData });
      const result = await response.json() as { data?: { reference: string }; message?: string };
      setMessage(response.ok
        ? `Enquiry ${result.data?.reference} has been received. Our group desk will contact you.`
        : result.message ?? "Please check your information.");
    } catch {
      setMessage("The enquiry could not be sent. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit}>
      <div className="field-grid">
        <label className="field"><span>Organisation name</span><input name="organisationName" required /></label>
        <label className="field"><span>Group category</span><select name="groupCategory" required><option>School</option><option>Church</option><option>Company</option><option>Sports team</option><option>Tour group</option></select></label>
        <label className="field"><span>Destination</span><input name="destination" placeholder="Diani, Mombasa…" required /></label>
        <label className="field"><span>Estimated total budget (KES)</span><input type="number" name="budgetKes" min="0" step="1" /></label>
        <label className="field"><span>Check in</span><input type="date" name="checkIn" required /></label>
        <label className="field"><span>Check out</span><input type="date" name="checkOut" required /></label>
        <label className="field"><span>Adults</span><input type="number" name="adults" min="0" defaultValue="0" required /></label>
        <label className="field"><span>Children / students</span><input type="number" name="children" min="0" defaultValue="20" required /></label>
        <label className="field"><span>Teachers / supervisors</span><input type="number" name="supervisors" min="0" defaultValue="2" required /></label>
        <label className="field"><span>Meal plan</span><select name="mealPlan" required><option value="FULL_BOARD">Full board</option><option value="HALF_BOARD">Half board</option><option value="BED_AND_BREAKFAST">Bed and breakfast</option><option value="ROOM_ONLY">Room only</option><option value="SELF_CATERING">Self-catering</option><option value="CUSTOM">Custom</option></select></label>
        <label className="field wide"><span>Rooming preferences</span><textarea name="roomingPreferences" placeholder="Room sharing, teacher rooms, gender separation and preferred bed arrangements" /></label>
        <label className="field wide"><span>Transport needs</span><textarea name="transportNeeds" placeholder="Pickup locations, vehicle sizes and proposed schedule" /></label>
        <label className="field wide"><span>Conference or activity requirements</span><textarea name="conferenceRequirements" placeholder="Meeting room, seating, projector, sports or activity needs" /></label>
        <label className="field wide"><span>Accessibility requirements</span><textarea name="accessibilityRequirements" /></label>
        <label className="field wide"><span>Special dietary requirements</span><textarea name="dietaryRequirements" placeholder="Provide counts only; do not include sensitive participant names yet" /></label>
        <label className="field wide"><span>Other requirements</span><textarea name="requirements" placeholder="Tell us anything else important for a suitable quotation." /></label>
        <label className="field"><span>Contact name</span><input name="contactName" autoComplete="name" required /></label>
        <label className="field"><span>Contact email</span><input type="email" name="email" autoComplete="email" required /></label>
        <label className="field"><span>Contact telephone</span><input type="tel" name="contactPhone" autoComplete="tel" placeholder="+254 7XX XXX XXX" required /></label>
      </div>
      <button className="button" disabled={pending}>{pending ? "Submitting…" : "Submit group enquiry"}</button>
      {message && <p className="form-note" role="status">{message}</p>}
    </form>
  );
}
