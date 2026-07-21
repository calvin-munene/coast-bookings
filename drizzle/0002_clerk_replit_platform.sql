-- Clerk identity, organization tenancy, internal schema isolation, and Replit App Storage metadata.
-- Existing profile and host data is preserved with legacy identity placeholders until it is linked to Clerk.
CREATE SCHEMA IF NOT EXISTS "audit";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "internal";--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('HOST', 'INTERNAL');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint

ALTER TYPE "public"."user_status" RENAME TO "user_status_legacy";--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'DELETED');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "status" TYPE "public"."user_status" USING (
  CASE "status"::text WHEN 'DEACTIVATED' THEN 'RESTRICTED' ELSE "status"::text END
)::"public"."user_status";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
DROP TYPE "public"."user_status_legacy";--> statement-breakpoint

ALTER TABLE "profiles" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "email" TO "primary_email";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "clerk_user_id" = 'legacy:' || "id"::text, "onboarding_complete" = true WHERE "clerk_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "clerk_user_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "profiles_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_primary_email_unique" ON "users" ("primary_email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" ("status");--> statement-breakpoint

CREATE TABLE "guest_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "marketing_consent" boolean DEFAULT false NOT NULL,
  "emergency_contact" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "guest_profiles_user_unique" ON "guest_profiles" ("user_id");--> statement-breakpoint

CREATE TABLE "host_organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_organization_id" text NOT NULL,
  "type" "organization_type" DEFAULT 'HOST' NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
  "verified_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "host_organizations_clerk_unique" ON "host_organizations" ("clerk_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "host_organizations_slug_unique" ON "host_organizations" ("slug");--> statement-breakpoint
INSERT INTO "host_organizations" ("clerk_organization_id", "name", "slug", "status", "verified_at")
SELECT 'legacy-org:' || hp."id"::text, COALESCE(hp."business_name", hp."legal_name"), 'legacy-' || hp."id"::text,
       CASE WHEN hp."verified_at" IS NULL THEN 'PENDING_VERIFICATION' ELSE 'VERIFIED' END, hp."verified_at"
FROM "host_profiles" hp;--> statement-breakpoint

ALTER TABLE "host_profiles" ADD COLUMN "host_organization_id" uuid;--> statement-breakpoint
UPDATE "host_profiles" hp SET "host_organization_id" = ho."id" FROM "host_organizations" ho WHERE ho."clerk_organization_id" = 'legacy-org:' || hp."id"::text;--> statement-breakpoint
ALTER TABLE "host_profiles" ALTER COLUMN "host_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "host_profiles" ADD CONSTRAINT "host_profiles_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "host_organizations"("id") ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "host_profiles_organization_unique" ON "host_profiles" ("host_organization_id");--> statement-breakpoint

CREATE TABLE "organization_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_membership_id" text NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "host_organizations"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role_key" text NOT NULL,
  "status" "membership_status" DEFAULT 'ACTIVE' NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "organization_memberships" ("clerk_membership_id", "organization_id", "user_id", "role_key")
SELECT 'legacy-membership:' || hp."id"::text, hp."host_organization_id", hp."user_id", 'org:owner' FROM "host_profiles" hp;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_clerk_unique" ON "organization_memberships" ("clerk_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_user_org_unique" ON "organization_memberships" ("user_id", "organization_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_scope_idx" ON "organization_memberships" ("organization_id", "status");--> statement-breakpoint

ALTER TABLE "properties" ADD COLUMN "host_organization_id" uuid;--> statement-breakpoint
UPDATE "properties" p SET "host_organization_id" = hp."host_organization_id" FROM "host_profiles" hp WHERE hp."id" = p."host_id";--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "host_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "host_organizations"("id");--> statement-breakpoint

ALTER TABLE "bookings" RENAME COLUMN "guest_id" TO "guest_user_id";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "host_organization_id" uuid;--> statement-breakpoint
UPDATE "bookings" b SET "host_organization_id" = hp."host_organization_id" FROM "host_profiles" hp WHERE hp."id" = b."host_id";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "host_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "host_organizations"("id");--> statement-breakpoint
DROP INDEX IF EXISTS "bookings_guest_idx";--> statement-breakpoint
CREATE INDEX "bookings_guest_idx" ON "bookings" ("guest_user_id", "status");--> statement-breakpoint

ALTER TABLE "payout_accounts" ADD COLUMN "host_organization_id" uuid;--> statement-breakpoint
UPDATE "payout_accounts" p SET "host_organization_id" = hp."host_organization_id" FROM "host_profiles" hp WHERE hp."id" = p."host_id";--> statement-breakpoint
ALTER TABLE "payout_accounts" ALTER COLUMN "host_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "host_organizations"("id");--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "host_organization_id" uuid;--> statement-breakpoint
UPDATE "payouts" p SET "host_organization_id" = hp."host_organization_id" FROM "host_profiles" hp WHERE hp."id" = p."host_id";--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "host_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "host_organizations"("id");--> statement-breakpoint

ALTER TABLE "roles" ADD COLUMN "scope" "organization_type";--> statement-breakpoint
UPDATE "roles" SET "scope" = CASE WHEN "code" IN ('HOST','CO_HOST','GUEST') THEN 'HOST'::"organization_type" ELSE 'INTERNAL'::"organization_type" END;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "scope" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "roles_code_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_scope_unique" ON "roles" ("code", "scope");--> statement-breakpoint
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_unique" ON "permissions" ("code");--> statement-breakpoint
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE cascade,
  "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("role_id", "permission_id")
);--> statement-breakpoint

ALTER TABLE "user_roles" RENAME TO "user_role_assignments";--> statement-breakpoint
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_roles_user_id_role_id_pk";--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD COLUMN "organization_id" uuid REFERENCES "host_organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_assignments_scope_unique" ON "user_role_assignments" ("user_id", "role_id", "organization_id");--> statement-breakpoint
CREATE INDEX "user_role_assignments_user_idx" ON "user_role_assignments" ("user_id");--> statement-breakpoint

CREATE TABLE "staff_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "employee_reference" text,
  "department" text,
  "approved_by" uuid REFERENCES "users"("id"),
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_user_unique" ON "staff_profiles" ("user_id");--> statement-breakpoint

CREATE TABLE "stored_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid REFERENCES "users"("id"),
  "host_organization_id" uuid REFERENCES "host_organizations"("id"),
  "booking_id" uuid REFERENCES "bookings"("id"),
  "bucket_scope" text NOT NULL,
  "object_key" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "checksum" text NOT NULL,
  "classification" text DEFAULT 'PRIVATE' NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "stored_files_object_key_unique" ON "stored_files" ("object_key");--> statement-breakpoint
CREATE INDEX "stored_files_owner_idx" ON "stored_files" ("owner_user_id", "classification");--> statement-breakpoint
CREATE INDEX "stored_files_organization_idx" ON "stored_files" ("host_organization_id", "classification");--> statement-breakpoint
CREATE TABLE "file_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL REFERENCES "stored_files"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "audience_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "file_access_tokens_hash_unique" ON "file_access_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX "file_access_tokens_expiry_idx" ON "file_access_tokens" ("expires_at");--> statement-breakpoint

CREATE TABLE "request_rate_limits" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
CREATE INDEX "request_rate_limits_expiry_idx" ON "request_rate_limits" ("expires_at");--> statement-breakpoint

CREATE TABLE "internal"."booking_financials" (
  "booking_id" uuid PRIMARY KEY REFERENCES "bookings"("id") ON DELETE cascade,
  "gross_minor" bigint NOT NULL,
  "tax_minor" bigint DEFAULT 0 NOT NULL,
  "service_fee_minor" bigint DEFAULT 0 NOT NULL,
  "commission_minor" bigint DEFAULT 0 NOT NULL,
  "host_net_minor" bigint NOT NULL,
  "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "internal_notes" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "internal"."staff_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assigned_to_user_id" uuid REFERENCES "users"("id"),
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "title" text NOT NULL,
  "priority" text DEFAULT 'NORMAL' NOT NULL,
  "status" text DEFAULT 'OPEN' NOT NULL,
  "due_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "internal"."host_risk_profiles" (
  "host_organization_id" uuid PRIMARY KEY REFERENCES "host_organizations"("id") ON DELETE cascade,
  "rating" text DEFAULT 'UNRATED' NOT NULL,
  "flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "reviewed_by_user_id" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "audit"."security_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id"),
  "event_type" text NOT NULL,
  "outcome" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
