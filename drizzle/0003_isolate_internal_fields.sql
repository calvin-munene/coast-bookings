CREATE TABLE "internal"."booking_risk_profiles" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal"."support_ticket_details" (
	"ticket_id" uuid PRIMARY KEY NOT NULL,
	"internal_notes" text,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal"."booking_risk_profiles" ADD CONSTRAINT "booking_risk_profiles_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal"."booking_risk_profiles" ADD CONSTRAINT "booking_risk_profiles_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal"."support_ticket_details" ADD CONSTRAINT "support_ticket_details_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal"."support_ticket_details" ADD CONSTRAINT "support_ticket_details_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "internal"."booking_risk_profiles" ("booking_id", "flags")
SELECT "id", COALESCE("risk_indicators", '[]'::jsonb) FROM "bookings";--> statement-breakpoint
INSERT INTO "internal"."host_risk_profiles" ("host_organization_id", "rating")
SELECT "host_organization_id", "risk_rating" FROM "host_profiles"
ON CONFLICT ("host_organization_id") DO UPDATE SET "rating" = excluded."rating", "updated_at" = now();--> statement-breakpoint
INSERT INTO "internal"."support_ticket_details" ("ticket_id", "internal_notes")
SELECT "id", "internal_notes" FROM "support_tickets" WHERE "internal_notes" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "risk_indicators";--> statement-breakpoint
ALTER TABLE "host_profiles" DROP COLUMN "risk_rating";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "internal_notes";
