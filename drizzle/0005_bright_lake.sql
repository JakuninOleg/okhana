CREATE TABLE "proactive_nudge_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"family_id" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proactive_nudge_deliveries" ADD CONSTRAINT "proactive_nudge_deliveries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proactive_nudge_deliveries_dedupe_uidx" ON "proactive_nudge_deliveries" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "proactive_nudge_deliveries_family_idx" ON "proactive_nudge_deliveries" USING btree ("family_id");