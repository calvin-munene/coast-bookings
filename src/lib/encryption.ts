import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

function encryptionKey(): Buffer {
  const configured = getEnv().APP_ENCRYPTION_KEY;
  if (!configured) throw new Error("APP_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(configured, "utf8").digest();
}

export function encryptSensitiveJson(value: Readonly<Record<string, string>>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [getEnv().APP_ENCRYPTION_KEY_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSensitiveJson(value: string): Readonly<Record<string, string>> {
  const [version, encodedIv, encodedTag, encodedData] = value.split(":");
  if (!version || version !== getEnv().APP_ENCRYPTION_KEY_VERSION || !encodedIv || !encodedTag || !encodedData) throw new Error("Encrypted value uses an unsupported key version");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  const decoded: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encodedData, "base64url")), decipher.final()]).toString("utf8"));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded) || !Object.values(decoded).every((item) => typeof item === "string")) throw new Error("Encrypted value has an invalid structure");
  return decoded as Readonly<Record<string, string>>;
}
