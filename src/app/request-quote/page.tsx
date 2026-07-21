import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote-form";
export const metadata: Metadata = { title: "Request a group quote" };
export default function QuotePage() { return <div className="auth-shell"><section className="form-card" style={{ width: "min(760px,100%)" }}><span className="section-kicker">Managed group accommodation</span><h1>Tell us about your group.</h1><p>A reservations officer will confirm the requirements before sourcing suitable properties.</p><QuoteForm /><p className="form-note">No passenger or student lists are collected at enquiry stage.</p></section></div>; }
