"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { guestProfiles, hostOrganizations, hostProfiles, organizationMemberships, users } from "@/db/schema";
import { UnauthenticatedError } from "@/modules/authorization/errors";

const onboardingSchema = z.discriminatedUnion("accountType", [
  z.object({ accountType: z.literal("guest") }),
  z.object({ accountType: z.literal("host"), businessName: z.string().trim().min(2).max(120), legalName: z.string().trim().min(2).max(120) }),
]);

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}

export async function completeOnboarding(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session.userId) throw new UnauthenticatedError();
  const input = onboardingSchema.parse({
    accountType: formData.get("accountType"),
    businessName: formData.get("businessName") || undefined,
    legalName: formData.get("legalName") || undefined,
  });
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(session.userId);
  const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
  if (!primaryEmail) throw new Error("A verified primary email address is required");
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || primaryEmail;

  const [applicationUser] = await getDb().insert(users).values({
    clerkUserId: session.userId,
    primaryEmail,
    fullName,
    avatarUrl: clerkUser.imageUrl,
    emailVerified: clerkUser.primaryEmailAddress?.verification?.status === "verified",
    mfaEnabled: clerkUser.twoFactorEnabled,
    onboardingComplete: true,
    status: "ACTIVE",
  }).onConflictDoUpdate({
    target: users.clerkUserId,
    set: { primaryEmail, fullName, avatarUrl: clerkUser.imageUrl, onboardingComplete: true, status: "ACTIVE", updatedAt: new Date() },
  }).returning();

  if (input.accountType === "guest") {
    await getDb().insert(guestProfiles).values({ userId: applicationUser.id }).onConflictDoNothing();
    redirect("/guest/dashboard");
  }

  const organization = await clerk.organizations.createOrganization({
    name: input.businessName,
    slug: `${slugify(input.businessName)}-${crypto.randomUUID().slice(0, 8)}`,
    createdBy: session.userId,
  });

  await getDb().transaction(async (tx) => {
    const [savedOrganization] = await tx.insert(hostOrganizations).values({
      clerkOrganizationId: organization.id,
      type: "HOST",
      name: organization.name,
      slug: organization.slug ?? slugify(input.businessName),
      status: "PENDING_VERIFICATION",
    }).onConflictDoUpdate({
      target: hostOrganizations.clerkOrganizationId,
      set: { name: organization.name, slug: organization.slug ?? slugify(input.businessName), updatedAt: new Date() },
    }).returning();

    await tx.insert(organizationMemberships).values({
      clerkMembershipId: `bootstrap:${organization.id}:${session.userId}`,
      organizationId: savedOrganization.id,
      userId: applicationUser.id,
      roleKey: "org:owner",
      status: "ACTIVE",
    }).onConflictDoUpdate({
      target: [organizationMemberships.userId, organizationMemberships.organizationId],
      set: { roleKey: "org:owner", status: "ACTIVE", updatedAt: new Date() },
    });

    await tx.insert(hostProfiles).values({
      userId: applicationUser.id,
      hostOrganizationId: savedOrganization.id,
      legalName: input.legalName,
      businessName: input.businessName,
    }).onConflictDoUpdate({
      target: hostProfiles.userId,
      set: { legalName: input.legalName, businessName: input.businessName, hostOrganizationId: savedOrganization.id, updatedAt: new Date() },
    });
  });

  redirect(`/auth/continue?activate=${organization.id}`);
}
