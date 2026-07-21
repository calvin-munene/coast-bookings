import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db/client";
import { profiles } from "@/db/schema";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const db = getDb();
    const [profile] = await db
      .select({ id: profiles.id, email: profiles.email, passwordHash: profiles.passwordHash, status: profiles.status })
      .from(profiles)
      .where(eq(profiles.email, email.toLowerCase().trim()))
      .limit(1);

    if (!profile || !profile.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (profile.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account is suspended" }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, profile.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = profile.id;
    session.email = profile.email;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
