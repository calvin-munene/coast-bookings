import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnv, isDatabaseConfigured, isSupabaseAuthConfigured } from "@/lib/env";
import { fail } from "@/lib/api";
import { syncAuthenticatedProfile } from "@/modules/auth/profile-sync";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("INVALID_ORIGIN", "Cross-origin profile sync is not allowed", 403);
  if (!isSupabaseAuthConfigured()) return fail("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured", 503);
  if (!isDatabaseConfigured()) return fail("DATABASE_NOT_CONFIGURED", "The selected database is not configured", 503);

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return fail("UNAUTHENTICATED", "A verified session is required", 401);
  const metadata = user.user_metadata;
  const fullName = typeof metadata.full_name === "string" && metadata.full_name.trim()
    ? metadata.full_name.trim()
    : user.email.split("@")[0];
  const accountType = typeof metadata.account_type === "string" ? metadata.account_type : undefined;
  await syncAuthenticatedProfile({ id: user.id, email: user.email, fullName, accountType });
  return NextResponse.json({ data: { userId: user.id, databaseProvider: getEnv().DATABASE_PROVIDER } });
}
