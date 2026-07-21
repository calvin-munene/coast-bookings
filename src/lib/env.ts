import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  APP_ENCRYPTION_KEY: z.string().min(32).optional(),
  APP_ENCRYPTION_KEY_VERSION: z.string().min(1).default("v1"),
  INITIAL_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  PAYMENT_MODE: z.enum(["mock", "sandbox", "live"]).default("mock"),
  DARAJA_CONSUMER_KEY: z.string().optional(),
  DARAJA_CONSUMER_SECRET: z.string().optional(),
  DARAJA_SHORTCODE: z.string().optional(),
  DARAJA_PASSKEY: z.string().optional(),
  DARAJA_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  DARAJA_CALLBACK_SECRET: z.string().optional(),
  PESAPAL_CONSUMER_KEY: z.string().optional(),
  PESAPAL_CONSUMER_SECRET: z.string().optional(),
  PESAPAL_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  PESAPAL_IPN_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  META_WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  CRON_SHARED_SECRET: z.string().min(24).optional(),
});

export type AppEnv = z.infer<typeof serverSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cached) cached = serverSchema.parse(process.env);
  return cached;
}

export function isConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.DATABASE_URL);
}
