import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  SEED_DEMO_DATA: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ACCOUNT_URL: z.string().url().optional(),
  NEXT_PUBLIC_OPERATIONS_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  CLERK_INTERNAL_ORGANIZATION_ID: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  REPLIT_PUBLIC_IMAGES_BUCKET_ID: z.string().min(1).optional(),
  REPLIT_PRIVATE_DOCUMENTS_BUCKET_ID: z.string().min(1).optional(),
  REPLIT_SUPPORT_ATTACHMENTS_BUCKET_ID: z.string().min(1).optional(),
  APP_ENCRYPTION_KEY: z.string().min(32).optional(),
  APP_ENCRYPTION_KEY_VERSION: z.string().min(1).default("v1"),
  INITIAL_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  PAYMENT_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  WHOP_API_KEY: z.string().min(1).optional(),
  WHOP_WEBHOOK_SECRET: z.string().min(1).optional(),
  WHOP_COMPANY_ID: z.string().startsWith("biz_").optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  META_WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_APP_SECRET: z.string().optional(),
  META_WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).optional(),
  META_WHATSAPP_TEMPLATE_NAME: z.string().min(1).optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  CRON_SHARED_SECRET: z.string().min(24).optional(),
});

export type AppEnv = z.infer<typeof serverSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= serverSchema.parse(process.env);
  return cached;
}

export function getDatabaseUrl(env: Pick<AppEnv, "DATABASE_URL"> = getEnv()): string {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required. Add a PostgreSQL database to the Replit App.");
  return env.DATABASE_URL;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getEnv().DATABASE_URL);
}

export function isClerkConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export function isConfigured(): boolean {
  return isDatabaseConfigured() && isClerkConfigured();
}
