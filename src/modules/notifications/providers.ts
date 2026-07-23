import "server-only";

import { z } from "zod";
import { getEnv } from "@/lib/env";

export type DeliveryMessage = Readonly<{
  to: string;
  recipientName: string;
  subject: string;
  text: string;
  actionUrl: string;
  idempotencyKey?: string;
}>;

export type ProviderDelivery = Readonly<{ provider: string; reference: string }>;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function emailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(message: DeliveryMessage): Promise<ProviderDelivery> {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Resend email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}) },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: `${message.text}\n\n${message.actionUrl}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#142235"><h1 style="color:#08233e">${escapeHtml(message.subject)}</h1><p>Hello ${escapeHtml(message.recipientName)},</p><p style="line-height:1.6">${escapeHtml(message.text)}</p><p><a href="${escapeHtml(message.actionUrl)}" style="display:inline-block;background:#f47721;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Open Coast Bookings</a></p><p style="color:#647082;font-size:12px">This is a transactional Coast Bookings notification.</p></div>`,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Resend rejected the notification (${response.status})`);
  const parsed = z.object({ id: z.string().min(1) }).parse(payload);
  return { provider: "RESEND", reference: parsed.id };
}

export function smsConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.AFRICASTALKING_API_KEY && env.AFRICASTALKING_USERNAME);
}

export async function sendSms(message: DeliveryMessage): Promise<ProviderDelivery> {
  const env = getEnv();
  if (!env.AFRICASTALKING_API_KEY || !env.AFRICASTALKING_USERNAME) throw new Error("Africa's Talking SMS is not configured");
  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: { apiKey: env.AFRICASTALKING_API_KEY, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: env.AFRICASTALKING_USERNAME, to: message.to, message: `${message.subject}: ${message.text} ${message.actionUrl}`.slice(0, 1500) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Africa's Talking rejected the notification (${response.status})`);
  const parsed = z.object({ SMSMessageData: z.object({ Recipients: z.array(z.object({ messageId: z.string().optional(), status: z.string() })).min(1) }) }).parse(payload);
  const recipient = parsed.SMSMessageData.Recipients[0];
  if (!recipient.status.toLowerCase().includes("success")) throw new Error(`SMS delivery was not accepted: ${recipient.status}`);
  return { provider: "AFRICASTALKING", reference: recipient.messageId ?? `accepted-${Date.now()}` };
}

export function whatsappConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.META_WHATSAPP_ACCESS_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID && env.META_GRAPH_API_VERSION && env.META_WHATSAPP_TEMPLATE_NAME);
}

export async function sendWhatsApp(message: DeliveryMessage): Promise<ProviderDelivery> {
  const env = getEnv();
  if (!env.META_WHATSAPP_ACCESS_TOKEN || !env.META_WHATSAPP_PHONE_NUMBER_ID || !env.META_GRAPH_API_VERSION || !env.META_WHATSAPP_TEMPLATE_NAME) throw new Error("Meta WhatsApp templates are not configured");
  const number = message.to.replace(/[^\d]/g, "");
  if (number.length < 10 || number.length > 15) throw new Error("Recipient WhatsApp number is invalid");
  const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.META_WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: number, type: "template", template: { name: env.META_WHATSAPP_TEMPLATE_NAME, language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: message.recipientName }, { type: "text", text: message.subject }, { type: "text", text: message.text.slice(0, 900) }] }] } }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Meta WhatsApp rejected the notification (${response.status})`);
  const parsed = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) }).parse(payload);
  return { provider: "META_WHATSAPP", reference: parsed.messages[0].id };
}
