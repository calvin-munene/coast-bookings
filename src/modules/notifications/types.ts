export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";

export type NotificationJob = Readonly<{
  eventId: string;
  eventType: string;
  recipientId: string;
  channel: NotificationChannel;
  templateId: string;
  variables: Readonly<Record<string, string>>;
}>;

export type DeliveryResult = Readonly<{ providerReference: string; acceptedAt: string }>;

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(job: NotificationJob): Promise<DeliveryResult>;
}
