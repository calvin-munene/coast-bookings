ALTER TYPE "public"."booking_status" ADD VALUE 'PAYMENT_REVIEW';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'PARTIALLY_PAID' BEFORE 'SUCCEEDED';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'DISPUTED' BEFORE 'REFUNDED';--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid,
	"anonymous_id" text,
	"session_id" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"request_type" text NOT NULL,
	"requested_changes" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decision_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_payment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"label" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_payment_schedules_amount_positive" CHECK ("booking_payment_schedules"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "channel_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"provider" text NOT NULL,
	"external_reference" text NOT NULL,
	"conflict_type" text NOT NULL,
	"details" jsonb NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"provider" text NOT NULL,
	"external_property_id" text NOT NULL,
	"external_unit_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid,
	"mapping_id" uuid,
	"direction" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"cursor" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"county" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"stored_file_id" uuid,
	"statement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_evidence_has_content" CHECK (num_nonnulls("dispute_evidence"."stored_file_id", "dispute_evidence"."statement") > 0)
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"summary" text NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"rollout_percentage" integer DEFAULT 0 NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_rollout_range" CHECK ("feature_flags"."rollout_percentage" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "group_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"booking_id" uuid,
	"document_type" text NOT NULL,
	"stored_file_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"booking_id" uuid,
	"full_name" text NOT NULL,
	"participant_type" text NOT NULL,
	"rooming_preference" text,
	"dietary_requirements" text,
	"accessibility_requirements" text,
	"emergency_contact" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"participant_id" uuid,
	"payment_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_payment_allocations_amount_positive" CHECK ("group_payment_allocations"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "host_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"host_organization_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"ratings" jsonb NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"stored_file_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_consents" (
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'ACCOUNT' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_consents_user_id_channel_purpose_pk" PRIMARY KEY("user_id","channel","purpose")
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"provider_reference" text,
	"error_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" text DEFAULT 'WHOP' NOT NULL,
	"provider_session_id" text NOT NULL,
	"provider_plan_id" text,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"return_url" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_checkout_sessions_amount_positive" CHECK ("payment_checkout_sessions"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "property_quality_metrics" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"completed_stays" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"overall_rating_basis_points" integer DEFAULT 0 NOT NULL,
	"host_cancellation_basis_points" integer DEFAULT 0 NOT NULL,
	"unresolved_safety_incidents" integer DEFAULT 0 NOT NULL,
	"coast_favourite" boolean DEFAULT false NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recently_viewed_properties" (
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recently_viewed_properties_user_id_property_id_pk" PRIMARY KEY("user_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "referral_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_user_id" uuid,
	"referred_user_id" uuid,
	"code" text NOT NULL,
	"booking_id" uuid,
	"status" text DEFAULT 'CAPTURED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid,
	"host_review_id" uuid,
	"reported_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_reports_single_target" CHECK (num_nonnulls("review_reports"."review_id", "review_reports"."host_review_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "reward_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"booking_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"alerts_enabled" boolean DEFAULT false NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"stored_file_id" uuid,
	"storage_path" text NOT NULL,
	"alt_text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"wishlist_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"note" text,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_wishlist_id_property_id_pk" PRIMARY KEY("wishlist_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "wishlist_members" (
	"wishlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_members_wishlist_id_user_id_pk" PRIMARY KEY("wishlist_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"share_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal"."staff_tasks" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
UPDATE "group_quote_options" AS option
SET "unit_id" = (
	SELECT unit_record."id" FROM "units" AS unit_record
	WHERE unit_record."property_id" = option."property_id"
	ORDER BY unit_record."created_at", unit_record."id" LIMIT 1
)
WHERE option."unit_id" IS NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "group_quote_options" WHERE "unit_id" IS NULL) THEN
		RAISE EXCEPTION 'Every existing group quote option needs at least one unit on its property before migration 0004 can continue';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "group_quote_options" ALTER COLUMN "unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD COLUMN "adults" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD COLUMN "children" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_quotes" ADD COLUMN "acceptance_token_hash" text;--> statement-breakpoint
ALTER TABLE "property_images" ADD COLUMN "stored_file_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "booking_change_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "booking_change_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "booking_change_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_payment_schedules" ADD CONSTRAINT "booking_payment_schedules_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_payment_schedules" ADD CONSTRAINT "booking_payment_schedules_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_conflicts" ADD CONSTRAINT "channel_conflicts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_conflicts" ADD CONSTRAINT "channel_conflicts_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_conflicts" ADD CONSTRAINT "channel_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sync_jobs" ADD CONSTRAINT "channel_sync_jobs_connection_id_ical_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."ical_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sync_jobs" ADD CONSTRAINT "channel_sync_jobs_mapping_id_channel_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."channel_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_documents" ADD CONSTRAINT "group_documents_enquiry_id_group_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."group_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_documents" ADD CONSTRAINT "group_documents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_documents" ADD CONSTRAINT "group_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_enquiry_id_group_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."group_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_payment_allocations" ADD CONSTRAINT "group_payment_allocations_enquiry_id_group_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."group_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_payment_allocations" ADD CONSTRAINT "group_payment_allocations_participant_id_group_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."group_participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_payment_allocations" ADD CONSTRAINT "group_payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_reviews" ADD CONSTRAINT "host_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_reviews" ADD CONSTRAINT "host_reviews_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "public"."host_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_reviews" ADD CONSTRAINT "host_reviews_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_consents" ADD CONSTRAINT "notification_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_checkout_sessions" ADD CONSTRAINT "payment_checkout_sessions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_quality_metrics" ADD CONSTRAINT "property_quality_metrics_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_videos" ADD CONSTRAINT "property_videos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed_properties" ADD CONSTRAINT "recently_viewed_properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed_properties" ADD CONSTRAINT "recently_viewed_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_host_review_id_host_reviews_id_fk" FOREIGN KEY ("host_review_id") REFERENCES "public"."host_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_images" ADD CONSTRAINT "unit_images_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_members" ADD CONSTRAINT "wishlist_members_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_members" ADD CONSTRAINT "wishlist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_name_time_idx" ON "analytics_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "booking_change_requests_booking_idx" ON "booking_change_requests" USING btree ("booking_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payment_schedules_sequence_unique" ON "booking_payment_schedules" USING btree ("booking_id","sequence");--> statement-breakpoint
CREATE INDEX "channel_conflicts_open_idx" ON "channel_conflicts" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_mappings_external_unique" ON "channel_mappings" USING btree ("provider","external_property_id","external_unit_id");--> statement-breakpoint
CREATE INDEX "channel_sync_jobs_pending_idx" ON "channel_sync_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "destinations_slug_unique" ON "destinations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "destinations_featured_idx" ON "destinations" USING btree ("featured","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_reference_unique" ON "disputes" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "disputes_booking_idx" ON "disputes" USING btree ("booking_id","status");--> statement-breakpoint
CREATE INDEX "group_participants_enquiry_idx" ON "group_participants" USING btree ("enquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "host_reviews_booking_unique" ON "host_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_attempt_unique" ON "notification_deliveries" USING btree ("notification_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_checkout_sessions_provider_unique" ON "payment_checkout_sessions" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX "payment_checkout_sessions_payment_idx" ON "payment_checkout_sessions" USING btree ("payment_id","status");--> statement-breakpoint
CREATE INDEX "referral_attributions_code_idx" ON "referral_attributions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_ledger_reference_unique" ON "reward_ledger" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "reward_ledger_user_idx" ON "reward_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "wishlists_owner_idx" ON "wishlists" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD CONSTRAINT "group_quote_options_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_quotes_acceptance_token_unique" ON "group_quotes" USING btree ("acceptance_token_hash");--> statement-breakpoint
CREATE INDEX "group_quotes_enquiry_status_idx" ON "group_quotes" USING btree ("enquiry_id","status");--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD CONSTRAINT "group_quote_options_quantity_positive" CHECK ("group_quote_options"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD CONSTRAINT "group_quote_options_guest_counts_valid" CHECK ("group_quote_options"."adults" >= 0 and "group_quote_options"."children" >= 0);--> statement-breakpoint
ALTER TABLE "group_quote_options" ADD CONSTRAINT "group_quote_options_amounts_valid" CHECK ("group_quote_options"."total_minor" > 0 and "group_quote_options"."deposit_minor" >= 0 and "group_quote_options"."deposit_minor" <= "group_quote_options"."total_minor");
--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "unit_images" ADD CONSTRAINT "unit_images_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "group_documents" ADD CONSTRAINT "group_documents_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "group_quote_options_id_quote_unique" ON "group_quote_options" ("id", "quote_id");--> statement-breakpoint
ALTER TABLE "group_quotes" ADD CONSTRAINT "group_quotes_accepted_option_belongs_to_quote_fk" FOREIGN KEY ("accepted_option_id", "id") REFERENCES "group_quote_options"("id", "quote_id") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.create_inventory_hold(
	target_user_id uuid,
	target_unit_id uuid,
	target_check_in date,
	target_check_out date,
	target_quantity integer,
	target_expires_at timestamptz,
	target_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	existing_hold inventory_holds%ROWTYPE;
	created_hold_id uuid;
	member_count integer;
	item record;
	required_quantity integer;
BEGIN
	IF target_unit_id IS NULL OR target_check_in IS NULL OR target_check_out IS NULL OR target_check_out <= target_check_in THEN
		RAISE EXCEPTION 'A valid unit and date range are required';
	END IF;
	IF target_quantity IS NULL OR target_quantity <= 0 THEN
		RAISE EXCEPTION 'Inventory quantity must be positive';
	END IF;
	IF target_expires_at IS NULL OR target_expires_at <= now() OR target_expires_at > now() + interval '7 days' THEN
		RAISE EXCEPTION 'Inventory hold expiry must be within the next seven days';
	END IF;
	IF target_idempotency_key IS NULL OR length(target_idempotency_key) < 8 OR length(target_idempotency_key) > 180 THEN
		RAISE EXCEPTION 'A stable idempotency key is required';
	END IF;

	SELECT * INTO existing_hold FROM inventory_holds WHERE idempotency_key = target_idempotency_key FOR UPDATE;
	IF FOUND THEN
		IF existing_hold.status <> 'ACTIVE' OR existing_hold.expires_at <= now() THEN
			RAISE EXCEPTION 'The existing inventory hold is no longer active';
		END IF;
		IF existing_hold.user_id IS DISTINCT FROM target_user_id THEN
			RAISE EXCEPTION 'The idempotency key belongs to another user';
		END IF;
		RETURN existing_hold.id;
	END IF;

	SELECT count(*)::integer INTO member_count FROM inventory_pool_members WHERE unit_id = target_unit_id;
	IF member_count = 0 THEN
		RAISE EXCEPTION 'The selected unit has no inventory pool';
	END IF;

	INSERT INTO inventory_holds (user_id, hold_type, status, expires_at, idempotency_key)
	VALUES (target_user_id, CASE WHEN target_idempotency_key LIKE 'quote-%' THEN 'GROUP_QUOTE' ELSE 'BOOKING' END, 'ACTIVE', target_expires_at, target_idempotency_key)
	RETURNING id INTO created_hold_id;

	FOR item IN
		SELECT member.pool_id, member.quantity_consumed, stay_date::date AS inventory_date
		FROM inventory_pool_members AS member
		CROSS JOIN generate_series(target_check_in::timestamp, (target_check_out - 1)::timestamp, interval '1 day') AS stay_date
		WHERE member.unit_id = target_unit_id
		ORDER BY member.pool_id, stay_date
	LOOP
		required_quantity := target_quantity * item.quantity_consumed;
		PERFORM 1 FROM unit_inventory_days AS day
		WHERE day.pool_id = item.pool_id AND day.inventory_date = item.inventory_date
			AND NOT day.closed
			AND day.held + day.sold + required_quantity <= day.capacity
			AND (item.inventory_date <> target_check_in OR day.check_in_allowed)
		FOR UPDATE;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'Inventory is unavailable for %', item.inventory_date;
		END IF;
		UPDATE unit_inventory_days
		SET held = held + required_quantity, version = version + 1, updated_at = now()
		WHERE pool_id = item.pool_id AND inventory_date = item.inventory_date;
		INSERT INTO inventory_hold_items (hold_id, pool_id, inventory_date, quantity)
		VALUES (created_hold_id, item.pool_id, item.inventory_date, required_quantity);
	END LOOP;

	PERFORM 1
	FROM inventory_pool_members AS member
	LEFT JOIN unit_inventory_days AS day ON day.pool_id = member.pool_id AND day.inventory_date = target_check_out
	WHERE member.unit_id = target_unit_id AND (day.pool_id IS NULL OR NOT day.check_out_allowed)
	LIMIT 1;
	IF FOUND THEN
		RAISE EXCEPTION 'Checkout is restricted on %', target_check_out;
	END IF;

	RETURN created_hold_id;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.release_inventory_hold(target_hold_id uuid, release_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	current_status text;
	item record;
BEGIN
	SELECT status INTO current_status FROM inventory_holds WHERE id = target_hold_id FOR UPDATE;
	IF NOT FOUND THEN RETURN; END IF;
	IF current_status <> 'ACTIVE' THEN RETURN; END IF;
	FOR item IN
		SELECT pool_id, inventory_date, quantity FROM inventory_hold_items
		WHERE hold_id = target_hold_id ORDER BY pool_id, inventory_date
	LOOP
		PERFORM 1 FROM unit_inventory_days
		WHERE pool_id = item.pool_id AND inventory_date = item.inventory_date FOR UPDATE;
		UPDATE unit_inventory_days
		SET held = greatest(held - item.quantity, 0), version = version + 1, updated_at = now()
		WHERE pool_id = item.pool_id AND inventory_date = item.inventory_date;
	END LOOP;
	UPDATE inventory_holds SET status = 'RELEASED', released_at = now() WHERE id = target_hold_id;
	INSERT INTO outbox_events (queue_name, event_type, aggregate_type, aggregate_id, payload)
	VALUES ('operations', 'INVENTORY_HOLD_RELEASED', 'inventory_hold', target_hold_id,
		jsonb_build_object('holdId', target_hold_id::text, 'reason', coalesce(release_reason, 'UNSPECIFIED')));
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.confirm_paid_booking(
	target_booking_id uuid,
	target_payment_id uuid,
	provider_event_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	current_status booking_status;
	current_hold_id uuid;
	hold_expiry timestamptz;
	total_paid bigint;
	total_due bigint;
	resulting_payment_status payment_status;
	item record;
BEGIN
	IF provider_event_id IS NULL OR length(provider_event_id) < 3 THEN
		RAISE EXCEPTION 'A stable provider event ID is required';
	END IF;
	SELECT status, hold_id INTO current_status, current_hold_id FROM bookings WHERE id = target_booking_id FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
	IF current_status = 'CONFIRMED' THEN RETURN; END IF;
	IF current_status <> 'PAYMENT_PROCESSING' THEN RAISE EXCEPTION 'Booking is not awaiting verified payment'; END IF;
	PERFORM 1 FROM payments WHERE id = target_payment_id AND booking_id = target_booking_id AND status = 'SUCCEEDED' FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Payment has not been verified'; END IF;
	SELECT coalesce(sum(amount_minor), 0)::bigint INTO total_paid FROM payments WHERE booking_id = target_booking_id AND status = 'SUCCEEDED';
	SELECT guest_total_minor INTO total_due FROM pricing_snapshots WHERE booking_id = target_booking_id;
	IF total_due IS NULL OR total_paid <= 0 THEN RAISE EXCEPTION 'Verified payment total is invalid'; END IF;
	resulting_payment_status := CASE WHEN total_paid >= total_due THEN 'SUCCEEDED'::payment_status ELSE 'PARTIALLY_PAID'::payment_status END;
	IF current_hold_id IS NULL THEN RAISE EXCEPTION 'Booking has no inventory hold'; END IF;
	SELECT expires_at INTO hold_expiry FROM inventory_holds WHERE id = current_hold_id AND status = 'ACTIVE' FOR UPDATE;
	IF NOT FOUND OR hold_expiry <= now() THEN RAISE EXCEPTION 'Inventory hold has expired'; END IF;
	FOR item IN
		SELECT pool_id, inventory_date, quantity FROM inventory_hold_items
		WHERE hold_id = current_hold_id ORDER BY pool_id, inventory_date
	LOOP
		PERFORM 1 FROM unit_inventory_days
		WHERE pool_id = item.pool_id AND inventory_date = item.inventory_date
			AND NOT closed AND held >= item.quantity AND sold + item.quantity <= capacity
		FOR UPDATE;
		IF NOT FOUND THEN RAISE EXCEPTION 'Inventory is no longer available for %', item.inventory_date; END IF;
		UPDATE unit_inventory_days SET held = held - item.quantity, sold = sold + item.quantity, version = version + 1, updated_at = now()
		WHERE pool_id = item.pool_id AND inventory_date = item.inventory_date;
	END LOOP;
	UPDATE inventory_holds SET status = 'CONVERTED' WHERE id = current_hold_id;
	UPDATE booking_payment_schedules SET status = 'PAID', updated_at = now() WHERE payment_id = target_payment_id;
	UPDATE bookings SET status = 'CONFIRMED', payment_status = resulting_payment_status, version = version + 1, updated_at = now() WHERE id = target_booking_id;
	INSERT INTO booking_status_history (booking_id, from_status, to_status, reason)
	VALUES (target_booking_id, current_status, 'CONFIRMED', 'Verified Whop payment event ' || provider_event_id);
	INSERT INTO outbox_events (queue_name, event_type, aggregate_type, aggregate_id, payload)
	VALUES ('notifications', 'BOOKING_CONFIRMED', 'booking', target_booking_id,
		jsonb_build_object('bookingId', target_booking_id::text, 'paymentStatus', resulting_payment_status::text));
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.create_inventory_hold(uuid, uuid, date, date, integer, timestamptz, text) FROM public;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.release_inventory_hold(uuid, text) FROM public;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.confirm_paid_booking(uuid, uuid, text) FROM public;
