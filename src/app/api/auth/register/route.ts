import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db/client";
import { profiles, roles, userRoles } from "@/db/schema";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, accountType } = await request.json();
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Email, password and name are required" }, { status: 400 });
    }
    if (password.length < 10) {
      return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const normalizedEmail = email.toLowerCase().trim();
    const displayName = fullName.trim() || normalizedEmail.split("@")[0];

    await db.insert(profiles).values({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      fullName: displayName,
    });

    // Assign default GUEST role
    const roleCodes = ["GUEST"];
    if (accountType === "host") roleCodes.push("HOST");

    const roleRows = await db
      .select({ id: roles.id, code: roles.code })
      .from(roles)
      .where(
        roleCodes.length === 1
          ? eq(roles.code, "GUEST")
          : eq(roles.code, "GUEST"), // will be filtered below
      );

    const allRoles = await db
      .select({ id: roles.id, code: roles.code })
      .from(roles);

    const toAssign = allRoles.filter((r) => roleCodes.includes(r.code));
    if (toAssign.length > 0) {
      await db.insert(userRoles).values(
        toAssign.map((r) => ({ userId, roleId: r.id })),
      ).onConflictDoNothing();
    }

    const session = await getSession();
    session.userId = userId;
    session.email = normalizedEmail;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
