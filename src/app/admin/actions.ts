"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { auditLogs, featureFlags, systemSettings, users } from "@/db/schema";
import { requireInternalPermission, requireRecentReverification } from "@/modules/authorization/service";

export async function updateFeatureFlag(formData: FormData): Promise<void> {
  const input = z.object({ key: z.string().min(3).max(100), enabled: z.string().optional(), rolloutPercentage: z.coerce.number().int().min(0).max(100), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:settings:manage");
  await requireRecentReverification("strict_mfa");
  const [flag] = await getDb().select().from(featureFlags).where(eq(featureFlags.key, input.key)).limit(1);
  if (!flag) throw new Error("Feature flag was not found");
  const enabled = input.enabled === "on";
  await getDb().transaction(async (tx) => {
    await tx.update(featureFlags).set({ enabled, rolloutPercentage: enabled ? input.rolloutPercentage : 0, updatedBy: context.user.id, updatedAt: new Date() }).where(eq(featureFlags.key, input.key));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "FEATURE_FLAG_UPDATED", entityType: "feature_flag", oldValue: { key: flag.key, enabled: flag.enabled, rolloutPercentage: flag.rolloutPercentage }, newValue: { key: flag.key, enabled, rolloutPercentage: enabled ? input.rolloutPercentage : 0 }, reason: input.reason });
  });
  revalidatePath("/admin/feature-flags");
}

export async function updateSystemSetting(formData: FormData): Promise<void> {
  const input = z.object({ key: z.string().min(3).max(160), value: z.string().min(1).max(5000), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:settings:manage");
  await requireRecentReverification("strict_mfa");
  const parsedValue: unknown = JSON.parse(input.value);
  const [setting] = await getDb().select().from(systemSettings).where(eq(systemSettings.key, input.key)).limit(1);
  if (!setting) throw new Error("System setting was not found");
  await getDb().transaction(async (tx) => {
    await tx.update(systemSettings).set({ value: parsedValue, version: setting.version + 1, updatedBy: context.user.id, updatedAt: new Date() }).where(eq(systemSettings.key, input.key));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "SYSTEM_SETTING_UPDATED", entityType: "system_setting", oldValue: { key: setting.key, value: setting.value, version: setting.version }, newValue: { key: setting.key, value: parsedValue, version: setting.version + 1 }, reason: input.reason });
  });
  revalidatePath("/admin/payment-settings"); revalidatePath("/admin/commission-settings");
}

export async function changeUserStatus(formData: FormData): Promise<void> {
  const input = z.object({ userId: z.string().uuid(), status: z.enum(["ACTIVE", "RESTRICTED", "SUSPENDED"]), reason: z.string().trim().min(10).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:users:manage");
  await requireRecentReverification("strict_mfa");
  if (context.user.id === input.userId && input.status !== "ACTIVE") throw new Error("Administrators cannot restrict their own account");
  const [user] = await getDb().select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new Error("User was not found");
  await getDb().transaction(async (tx) => {
    await tx.update(users).set({ status: input.status, version: user.version + 1, updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "USER_STATUS_CHANGED", entityType: "user", entityId: user.id, oldValue: { status: user.status }, newValue: { status: input.status }, reason: input.reason });
  });
  revalidatePath("/admin/users"); revalidatePath("/admin/restrictions");
}
