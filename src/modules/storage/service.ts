import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Client } from "@replit/object-storage";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { fileAccessTokens, storedFiles } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { ResourceNotFoundError } from "@/modules/authorization/errors";
import { requireActiveUser, requireGuestBookingAccess, requireHostBookingAccess, requireInternalStaff } from "@/modules/authorization/service";

export const STORAGE_SCOPES = ["PUBLIC_PROPERTY_IMAGES", "PRIVATE_HOST_DOCUMENTS", "PRIVATE_BOOKING_DOCUMENTS", "PRIVATE_SUPPORT_ATTACHMENTS"] as const;
export type StorageScope = (typeof STORAGE_SCOPES)[number];

const policies: Readonly<Record<StorageScope, { maxBytes: number; mimeTypes: readonly string[] }>> = {
  PUBLIC_PROPERTY_IMAGES: { maxBytes: 10_000_000, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  PRIVATE_HOST_DOCUMENTS: { maxBytes: 15_000_000, mimeTypes: ["application/pdf", "image/jpeg", "image/png"] },
  PRIVATE_BOOKING_DOCUMENTS: { maxBytes: 15_000_000, mimeTypes: ["application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  PRIVATE_SUPPORT_ATTACHMENTS: { maxBytes: 10_000_000, mimeTypes: ["application/pdf", "image/jpeg", "image/png", "text/plain"] },
};

function bucketId(scope: StorageScope): string {
  const env = getEnv();
  const id = scope === "PUBLIC_PROPERTY_IMAGES"
    ? env.REPLIT_PUBLIC_IMAGES_BUCKET_ID
    : scope === "PRIVATE_SUPPORT_ATTACHMENTS"
      ? env.REPLIT_SUPPORT_ATTACHMENTS_BUCKET_ID
      : env.REPLIT_PRIVATE_DOCUMENTS_BUCKET_ID;
  if (!id) throw new Error(`Replit App Storage bucket is not configured for ${scope}`);
  return id;
}

function storageClient(scope: StorageScope): Client { return new Client({ bucketId: bucketId(scope) }); }
function checksum(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function safeExtension(name: string): string { const value = name.split(".").pop()?.toLowerCase(); return value && /^[a-z0-9]{1,8}$/.test(value) ? `.${value}` : ""; }
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }

export type StoreFileInput = Readonly<{
  scope: StorageScope;
  bytes: Buffer;
  originalName: string;
  mimeType: string;
  ownerUserId?: string;
  hostOrganizationId?: string;
  bookingId?: string;
}>;

export async function storeFile(input: StoreFileInput): Promise<typeof storedFiles.$inferSelect> {
  const policy = policies[input.scope];
  if (!policy.mimeTypes.includes(input.mimeType)) throw new Error("This file type is not permitted");
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > policy.maxBytes) throw new Error("The file size is outside the permitted range");
  if (input.scope !== "PUBLIC_PROPERTY_IMAGES" && !input.ownerUserId && !input.hostOrganizationId && !input.bookingId) throw new Error("Private files require an authorized owner or resource scope");
  const objectKey = `${input.scope.toLowerCase()}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}${safeExtension(input.originalName)}`;
  const upload = await storageClient(input.scope).uploadFromBytes(objectKey, input.bytes);
  if (!upload.ok) throw new Error(`Replit App Storage upload failed: ${upload.error.message}`);
  try {
    const [record] = await getDb().insert(storedFiles).values({
      ownerUserId: input.ownerUserId,
      hostOrganizationId: input.hostOrganizationId,
      bookingId: input.bookingId,
      bucketScope: input.scope,
      objectKey,
      originalName: input.originalName.slice(0, 255),
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      checksum: checksum(input.bytes),
      classification: input.scope === "PUBLIC_PROPERTY_IMAGES" ? "PUBLIC" : "PRIVATE",
    }).returning();
    return record;
  } catch (error) {
    await storageClient(input.scope).delete(objectKey);
    throw error;
  }
}

export async function downloadStoredFile(record: typeof storedFiles.$inferSelect): Promise<Buffer> {
  const scope = STORAGE_SCOPES.find((candidate) => candidate === record.bucketScope);
  if (!scope) throw new Error("Unknown storage scope");
  const download = await storageClient(scope).downloadAsBytes(record.objectKey);
  if (!download.ok) throw new Error(`Replit App Storage download failed: ${download.error.message}`);
  return download.value[0];
}

export async function createPrivateFileAccessUrl(fileId: string, audienceUserId: string, origin: string, ttlSeconds = 300): Promise<string> {
  if (ttlSeconds < 30 || ttlSeconds > 900) throw new Error("Private access URL lifetime must be between 30 and 900 seconds");
  const context = await requireActiveUser();
  if (context.user.id !== audienceUserId) throw new ResourceNotFoundError();
  const [file] = await getDb().select().from(storedFiles).where(and(eq(storedFiles.id, fileId), isNull(storedFiles.deletedAt))).limit(1);
  if (!file) throw new ResourceNotFoundError();
  let allowed = file.classification === "PUBLIC" || file.ownerUserId === context.user.id || (file.hostOrganizationId !== null && file.hostOrganizationId === context.membership?.organizationId);
  if (!allowed && file.bookingId) {
    try {
      if (context.membership?.organizationType === "HOST") await requireHostBookingAccess(file.bookingId);
      else await requireGuestBookingAccess(file.bookingId);
      allowed = true;
    } catch { allowed = false; }
  }
  if (!allowed && context.membership?.organizationType === "INTERNAL") {
    try { await requireInternalStaff(); allowed = true; } catch { allowed = false; }
  }
  if (!allowed) throw new ResourceNotFoundError();
  const token = randomBytes(32).toString("base64url");
  await getDb().insert(fileAccessTokens).values({ fileId, audienceUserId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + ttlSeconds * 1000) });
  return new URL(`/api/files/access/${token}`, origin).toString();
}

export async function consumeFileAccessToken(token: string, audienceUserId: string): Promise<typeof storedFiles.$inferSelect | null> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select({ token: fileAccessTokens, file: storedFiles }).from(fileAccessTokens).innerJoin(storedFiles, eq(storedFiles.id, fileAccessTokens.fileId)).where(and(eq(fileAccessTokens.tokenHash, tokenHash(token)), eq(fileAccessTokens.audienceUserId, audienceUserId), gt(fileAccessTokens.expiresAt, now), isNull(fileAccessTokens.consumedAt), isNull(storedFiles.deletedAt))).limit(1);
    if (!row) return null;
    await tx.update(fileAccessTokens).set({ consumedAt: now }).where(eq(fileAccessTokens.id, row.token.id));
    return row.file;
  });
}
