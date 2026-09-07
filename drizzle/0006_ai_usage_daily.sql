CREATE TABLE "ai_usage_family_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"usage_date" date NOT NULL,
	"chat_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_user_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"usage_date" date NOT NULL,
	"chat_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_family_daily" ADD CONSTRAINT "ai_usage_family_daily_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_user_daily" ADD CONSTRAINT "ai_usage_user_daily_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_user_daily" ADD CONSTRAINT "ai_usage_user_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_family_daily_uidx" ON "ai_usage_family_daily" USING btree ("family_id","usage_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_user_daily_uidx" ON "ai_usage_user_daily" USING btree ("user_id","usage_date");--> statement-breakpoint
CREATE INDEX "ai_usage_user_daily_family_day_idx" ON "ai_usage_user_daily" USING btree ("family_id","usage_date");
