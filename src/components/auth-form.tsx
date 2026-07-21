"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true); setMessage(undefined);
    try {
      const supabase = createSupabaseBrowserClient();
      const email = String(formData.get("email"));
      const password = String(formData.get("password"));
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/guest/dashboard"); router.refresh();
      } else {
        const fullName = String(formData.get("fullName"));
        const accountType = String(formData.get("accountType"));
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, account_type: accountType }, emailRedirectTo: `${window.location.origin}/guest/dashboard` } });
        if (error) throw error;
        setMessage("Check your email to verify your new Coast Bookings account.");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message === "Supabase is not configured" ? "Authentication is in demo mode until Supabase secrets are added in Replit." : error instanceof Error ? error.message : "Authentication failed");
    } finally { setPending(false); }
  }

  return <form action={submit}><div className="field-grid">
    {mode === "register" && <><label className="field"><span>Full name</span><input name="fullName" required /></label><label className="field"><span>Account type</span><select name="accountType"><option value="guest">Guest</option><option value="host">Host / property manager</option><option value="coordinator">Group coordinator</option></select></label></>}
    <label className="field wide"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
    <label className="field wide"><span>Password</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} placeholder="At least 10 characters" required /></label>
  </div><button className="button" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Log in securely" : "Create account"}</button>{message && <p className="form-note" role="status">{message}</p>}</form>;
}
