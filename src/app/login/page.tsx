import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function LoginPage() { return <div className="auth-shell"><section className="form-card"><span className="section-kicker">Welcome back</span><h1>Log in to Coast Bookings</h1><p>Manage trips, reservations, properties and group quotations from one secure account.</p><AuthForm mode="login" /><p className="form-note">New here? <Link href="/register">Create an account</Link></p></section></div>; }
