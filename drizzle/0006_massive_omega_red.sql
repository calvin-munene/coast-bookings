ALTER TABLE "host_documents" ADD COLUMN "stored_file_id" uuid;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "deduplication_key" text;--> statement-breakpoint
ALTER TABLE "property_documents" ADD COLUMN "stored_file_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "host_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_host_organization_id_host_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "public"."host_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_documents" ADD CONSTRAINT "host_documents_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_deduplication_unique" ON "outbox_events" USING btree ("deduplication_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_external_reference_unique" ON "payouts" USING btree ("external_reference");
