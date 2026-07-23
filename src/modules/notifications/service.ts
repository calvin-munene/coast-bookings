import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { notificationConsents, notificationDeliveries, notifications, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { renderNotification, type NotificationContent } from "./content";
import { emailConfigured, sendEmail, sendSms, sendWhatsApp, smsConfigured, whatsappConfigured, type DeliveryMessage, type ProviderDelivery } from "./providers";

export type NotificationRecipient = Readonly<{ userId: string; name: string; email: string; phone: string | null }>;
type ExternalChannel = "EMAIL" | "SMS" | "WHATSAPP";

async function nextDeliveryAttempt(notificationId: string): Promise<number> {
  const [record] = await getDb().select({ attempts: notifications.attempts }).from(notifications).where(eq(notifications.id, notificationId)).limit(1);
  return (record?.attempts ?? 0) + 1;
}

async function sendChannel(channel: ExternalChannel, message: DeliveryMessage): Promise<ProviderDelivery> {
  if (channel === "EMAIL") return sendEmail(message);
  if (channel === "SMS") return sendSms(message);
  return sendWhatsApp(message);
}

async function deliverChannel(outboxEventId: string, eventType: string, recipient: NotificationRecipient, content: NotificationContent, channel: "IN_APP" | ExternalChannel): Promise<void> {
  const deduplicationKey = `${outboxEventId}:${recipient.userId}:${channel}`;
  await getDb().insert(notifications).values({ deduplicationKey, userId: recipient.userId, eventType, channel, status: channel === "IN_APP" ? "SENT" : "PENDING", payload: { subject: content.subject, text: content.text, actionPath: content.actionPath }, sentAt: channel === "IN_APP" ? new Date() : null }).onConflictDoNothing();
  const [notification] = await getDb().select().from(notifications).where(eq(notifications.deduplicationKey, deduplicationKey)).limit(1);
  if (!notification || notification.status === "SENT" || notification.status === "READ" || channel === "IN_APP") return;
  const attempt = await nextDeliveryAttempt(notification.id);
  const actionUrl = new URL(content.actionPath, getEnv().NEXT_PUBLIC_APP_URL).toString();
  const to = channel === "EMAIL" ? recipient.email : recipient.phone;
  if (!to) return;
  try {
    const delivered = await sendChannel(channel, { to, recipientName: recipient.name, subject: content.subject, text: content.text, actionUrl, idempotencyKey: deduplicationKey });
    await getDb().transaction(async (tx) => {
      await tx.insert(notificationDeliveries).values({ notificationId: notification.id, attempt, provider: delivered.provider, status: "ACCEPTED", providerReference: delivered.reference });
      await tx.update(notifications).set({ status: "SENT", providerReference: delivered.reference, attempts: attempt, sentAt: new Date(), updatedAt: new Date() }).where(eq(notifications.id, notification.id));
    });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 200) : "Unknown provider error";
    await getDb().transaction(async (tx) => {
      await tx.insert(notificationDeliveries).values({ notificationId: notification.id, attempt, provider: channel, status: "FAILED", errorCode: code });
      await tx.update(notifications).set({ status: "FAILED", attempts: attempt, updatedAt: new Date() }).where(eq(notifications.id, notification.id));
    });
    throw error;
  }
}

export async function deliverTransactionalNotification(outboxEventId: string, eventType: string, payload: Readonly<Record<string, unknown>>, recipients: readonly NotificationRecipient[]): Promise<void> {
  const content = renderNotification(eventType, payload);
  for (const recipient of recipients) {
    await deliverChannel(outboxEventId, eventType, recipient, content, "IN_APP");
    if (emailConfigured()) await deliverChannel(outboxEventId, eventType, recipient, content, "EMAIL");
    const consents = await getDb().select({ channel: notificationConsents.channel, granted: notificationConsents.granted }).from(notificationConsents).where(and(eq(notificationConsents.userId, recipient.userId), eq(notificationConsents.purpose, "TRANSACTIONAL")));
    const allowed = new Set(consents.filter((consent) => consent.granted).map((consent) => consent.channel));
    if (recipient.phone && allowed.has("SMS") && smsConfigured()) await deliverChannel(outboxEventId, eventType, recipient, content, "SMS");
    if (recipient.phone && allowed.has("WHATSAPP") && whatsappConfigured()) await deliverChannel(outboxEventId, eventType, recipient, content, "WHATSAPP");
  }
}

export async function findRecipient(userId: string): Promise<NotificationRecipient | null> {
  const [user] = await getDb().select({ userId: users.id, name: users.fullName, email: users.primaryEmail, phone: users.phone }).from(users).where(and(eq(users.id, userId), eq(users.status, "ACTIVE"))).limit(1);
  return user ?? null;
}
