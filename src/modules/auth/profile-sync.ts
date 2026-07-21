import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profiles, roles, userRoles } from "@/db/schema";

export type AuthenticatedProfile = Readonly<{
  id: string;
  email: string;
  fullName: string;
  accountType?: string;
}>;

/** Mirrors a verified external-auth identity into either supported PostgreSQL database. */
export async function syncAuthenticatedProfile(profile: AuthenticatedProfile): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(profiles).values({ id: profile.id, email: profile.email, fullName: profile.fullName })
      .onConflictDoUpdate({ target: profiles.id, set: { email: profile.email, fullName: profile.fullName, updatedAt: new Date() } });

    const desiredRoles = profile.accountType === "host" ? ["GUEST", "HOST"] : ["GUEST"];
    for (const code of desiredRoles) {
      const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1);
      if (!role) throw new Error(`Required role ${code} has not been seeded`);
      await tx.insert(userRoles).values({ userId: profile.id, roleId: role.id }).onConflictDoNothing();
    }
  });
}
