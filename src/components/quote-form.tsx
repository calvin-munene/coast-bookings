"use client";

import { useState } from "react";

export function QuoteForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true); setMessage(undefined);
    const budgetKes = Number(formData.get("budgetKes") ?? 0);
    formData.delete("budgetKes");
    if (Number.isFinite(budgetKes) && budgetKes > 0) formData.set("budgetMinor", String(Math.round(budgetKes * 100)));
    const response = await fetch("/api/group-enquiries", { method: "POST", body: formData });
    const result = await response.json() as { data?: { reference: string }; message?: string };
    setMessage(response.ok ? `Enquiry ${result.data?.reference} has been received. Our group desk will contact you.` : result.message ?? "Please check your information.");
    setPending(false);
  }
  return <form action={submit}><div className="field-grid"><label className="field"><span>Organisation name</span><input name="organisationName" required /></label><label className="field"><span>Group category</span><select name="groupCategory"><option>School</option><option>Church</option><option>Company</option><option>Sports team</option><option>Tour group</option></select></label><label className="field"><span>Destination</span><input name="destination" placeholder="Diani, Mombasa…" required /></label><label className="field"><span>Estimated budget (KES)</span><input type="number" name="budgetKes" min="0" /></label><label className="field"><span>Check in</span><input type="date" name="checkIn" required /></label><label className="field"><span>Check out</span><input type="date" name="checkOut" required /></label><label className="field"><span>Adults / supervisors</span><input type="number" name="adults" min="0" defaultValue="2" /></label><label className="field"><span>Children / students</span><input type="number" name="children" min="0" defaultValue="20" /></label><label className="field wide"><span>Meals, rooming, transport and accessibility</span><textarea name="requirements" placeholder="Tell us the important details. Do not include student names yet." /></label><label className="field"><span>Contact name</span><input name="contactName" required /></label><label className="field"><span>Contact email</span><input type="email" name="email" required /></label></div><button className="button" disabled={pending}>{pending ? "Submitting…" : "Submit group enquiry"}</button>{message && <p className="form-note" role="status">{message}</p>}</form>;
}
