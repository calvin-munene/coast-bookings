ALTER TABLE "notifications" ADD COLUMN "deduplication_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_deduplication_unique" ON "notifications" USING btree ("deduplication_key");