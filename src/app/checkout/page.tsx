import type { Metadata } from "next";
import { CreditCard, LockKeyhole, Smartphone } from "lucide-react";

export const metadata: Metadata = { title: "Secure checkout" };

export default function CheckoutPage() {
  return <div className="auth-shell"><section className="form-card"><span className="section-kicker">Secure checkout</span><h1>Confirm your stay</h1><p>This sandbox demonstrates the protected checkout flow. Payment is finalised only after a signed provider callback is verified.</p><form><div className="field-grid"><label className="field wide"><span>Full name</span><input placeholder="Name on the booking" /></label><label className="field"><span>Email</span><input type="email" placeholder="you@example.com" /></label><label className="field"><span>Mobile number</span><input type="tel" placeholder="+254 7…" /></label><label className="field wide"><span>Payment method</span><select><option>M-Pesa STK Push</option><option>Card with Pesapal</option><option>Manual payment reference</option></select></label></div><div className="filter-row" style={{ marginBottom: 18 }}><span className="filter-chip active"><Smartphone size={14} /> M-Pesa</span><span className="filter-chip"><CreditCard size={14} /> Card</span><span className="filter-chip"><LockKeyhole size={14} /> Server verified</span></div><button type="button" className="button">Create secure payment request</button></form><p className="form-note">Demo mode — no live payment will be initiated until provider credentials are configured.</p></section></div>;
}
