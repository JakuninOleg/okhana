CREATE TABLE "member_kinship_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"viewer_user_id" integer NOT NULL,
	"subject_user_id" integer NOT NULL,
	"kinship_label" varchar(64) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_kinship_views" ADD CONSTRAINT "member_kinship_views_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_kinship_views" ADD CONSTRAINT "member_kinship_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_kinship_views" ADD CONSTRAINT "member_kinship_views_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_kinship_viewer_subject_uidx" ON "member_kinship_views" USING btree ("viewer_user_id","subject_user_id");--> statement-breakpoint
CREATE INDEX "member_kinship_family_idx" ON "member_kinship_views" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "member_kinship_viewer_idx" ON "member_kinship_views" USING btree ("viewer_user_id");
