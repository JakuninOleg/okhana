CREATE TYPE "public"."family_date_kind" AS ENUM('anniversary', 'birthday', 'holiday', 'other');--> statement-breakpoint
CREATE TABLE "family_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"kind" "family_date_kind" DEFAULT 'other' NOT NULL,
	"month" integer NOT NULL,
	"day" integer NOT NULL,
	"year" integer,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_dates" ADD CONSTRAINT "family_dates_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_dates" ADD CONSTRAINT "family_dates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_dates_family_md_idx" ON "family_dates" USING btree ("family_id","month","day");