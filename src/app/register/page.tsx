import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function RegisterPage() { return <div className="auth-shell"><section className="form-card"><span className="section-kicker">Create an account</span><h1>Your coast starts here.</h1><p>Choose your role now. Fine-grained permissions are enforced again on the server and in PostgreSQL.</p><AuthForm mode="register" /><p className="form-note">Already registered? <Link href="/login">Log in</Link></p></section></div>; }
