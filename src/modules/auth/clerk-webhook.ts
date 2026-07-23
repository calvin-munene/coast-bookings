import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { hostOrganizations, organizationMemberships, securityEvents, staffProfiles, users, webhookEvents } from "@/db/schema";
import { HOST_ROLES, INTERNAL_ROLES, type HostRole, type InternalRole } from "@/modules/authorization/permissions";

const emailSchema = z.object({ id: z.string(), email_address: z.string().email(), verification: z.object({ status: z.string() }).optional() });
const userDataSchema = z.object({
  id: z.string(),
  primary_email_address_id: z.string().nullable().optional(),
  email_addresses: z.array(emailSchema).default([]),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  two_factor_enabled: z.boolean().default(false),
  deleted: z.boolean().optional(),
}).passthrough();
const organizationSchema = z.object({ id: z.string(), name: z.string(), slug: z.string().nullable().optional() }).passthrough();
const membershipSchema = z.object({
  id: z.string(),
  role: z.string(),
  organization: organizationSchema,
  public_user_data: z.object({ user_id: z.string() }).passthrough(),
}).passthrough();
const eventSchema = z.object({ type: z.string(), data: z.unknown() }).passthrough();

export type ClerkWebhookInput = Readonly<{ eventId: string; payloadHash: string; event: unknown }>;
export type ClerkWebhookResult = Readonly<{ duplicate: boolean; processed: boolean }>;

function hostRole(value: string): HostRole | null {
  if (value === "org:admin") return "org:owner";
  if (value === "org:member") return "org:viewer";
  return (HOST_ROLES as readonly string[]).includes(value) ? value as HostRole : null;
}

function internalRole(value: string): InternalRole | null {
  return (INTERNAL_ROLES as readonly string[]).includes(value) ? value as InternalRole : null;
}

function slugFallback(id: string): string { return `organization-${id.slice(-10).toLowerCase()}`; }

export async function processClerkWebhook(input: ClerkWebhookInput): Promise<ClerkWebhookResult> {
  const event = eventSchema.parse(input.event);
  return getDb().transaction(async (tx) => {
    const inserted = await tx.insert(webhookEvents).values({ provider: "CLERK", providerEventId: input.eventId, payloadHash: input.payloadHash }).onConflictDoNothing().returning({ id: webhookEvents.id });
    if (inserted.length === 0) return { duplicate: true, processed: true };

    if (event.type === "user.created" || event.type === "user.updated") {
      const data = userDataSchema.parse(event.data);
      const primary = data.email_addresses.find((email) => email.id === data.primary_email_address_id) ?? data.email_addresses[0];
      if (!primary) throw new Error("Clerk user event has no email address");
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || primary.email_address;
      await tx.insert(users).values({
        clerkUserId: data.id,
        primaryEmail: primary.email_address,
        fullName,
        avatarUrl: data.image_url ?? null,
        emailVerified: primary.verification?.status === "verified",
        mfaEnabled: data.two_factor_enabled,
        status: "PENDING",
      }).onConflictDoUpdate({ target: users.clerkUserId, set: { primaryEmail: primary.email_address, fullName, avatarUrl: data.image_url ?? null, emailVerified: primary.verification?.status === "verified", mfaEnabled: data.two_factor_enabled, updatedAt: new Date() } });
    } else if (event.type === "user.deleted") {
      const data = z.object({ id: z.string() }).parse(event.data);
      await tx.update(users).set({ status: "DELETED", deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.clerkUserId, data.id));
    } else if (event.type === "organization.created" || event.type === "organization.updated") {
      const data = organizationSchema.parse(event.data);
      const type = data.id === process.env.CLERK_INTERNAL_ORGANIZATION_ID ? "INTERNAL" as const : "HOST" as const;
      await tx.insert(hostOrganizations).values({ clerkOrganizationId: data.id, name: data.name, slug: data.slug ?? slugFallback(data.id), type, status: type === "INTERNAL" ? "ACTIVE" : "UNCLAIMED" }).onConflictDoUpdate({ target: hostOrganizations.clerkOrganizationId, set: { name: data.name, slug: data.slug ?? slugFallback(data.id), updatedAt: new Date() } });
    } else if (event.type === "organization.deleted") {
      const data = z.object({ id: z.string() }).parse(event.data);
      await tx.update(hostOrganizations).set({ status: "ARCHIVED", updatedAt: new Date() }).where(eq(hostOrganizations.clerkOrganizationId, data.id));
    } else if (event.type === "organizationMembership.created" || event.type === "organizationMembership.updated") {
      const data = membershipSchema.parse(event.data);
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.clerkUserId, data.public_user_data.user_id)).limit(1);
      const [organization] = await tx.select({ id: hostOrganizations.id, type: hostOrganizations.type, status: hostOrganizations.status }).from(hostOrganizations).where(eq(hostOrganizations.clerkOrganizationId, data.organization.id)).limit(1);
      if (!user || !organization) throw new Error("Clerk membership dependencies have not been synchronized yet");
      const roleKey = organization.type === "INTERNAL" ? internalRole(data.role) : hostRole(data.role);
      const isConfiguredInternal = organization.type !== "INTERNAL" || data.organization.id === process.env.CLERK_INTERNAL_ORGANIZATION_ID;
      await tx.insert(organizationMemberships).values({ clerkMembershipId: data.id, organizationId: organization.id, userId: user.id, roleKey: roleKey ?? "unrecognized", status: roleKey && isConfiguredInternal ? "ACTIVE" : "REVOKED" }).onConflictDoUpdate({
        target: [organizationMemberships.userId, organizationMemberships.organizationId],
        set: { clerkMembershipId: data.id, roleKey: roleKey ?? "unrecognized", status: roleKey && isConfiguredInternal ? "ACTIVE" : "REVOKED", updatedAt: new Date() },
      });
      const approvedHostOrganization = organization.type === "HOST" && ["PENDING_VERIFICATION", "VERIFIED", "ACTIVE"].includes(organization.status);
      if (roleKey && isConfiguredInternal && (organization.type === "INTERNAL" || approvedHostOrganization)) {
        await tx.update(users).set({ status: "ACTIVE", onboardingComplete: true, updatedAt: new Date() }).where(eq(users.id, user.id));
        if (organization.type === "INTERNAL") await tx.insert(staffProfiles).values({ userId: user.id, approvedAt: new Date() }).onConflictDoNothing();
      }
      await tx.insert(securityEvents).values({ actorUserId: user.id, eventType: "CLERK_MEMBERSHIP_SYNC", outcome: roleKey && isConfiguredInternal ? "ALLOWED" : "DENIED", targetType: "organization", targetId: organization.id, metadata: { clerkRole: data.role } });
    } else if (event.type === "organizationMembership.deleted") {
      const data = z.object({ id: z.string() }).parse(event.data);
      await tx.update(organizationMemberships).set({ status: "REVOKED", updatedAt: new Date() }).where(eq(organizationMemberships.clerkMembershipId, data.id));
    }

    await tx.update(webhookEvents).set({ status: "PROCESSED", processedAt: new Date() }).where(and(eq(webhookEvents.provider, "CLERK"), eq(webhookEvents.providerEventId, input.eventId)));
    return { duplicate: false, processed: true };
  });
}
