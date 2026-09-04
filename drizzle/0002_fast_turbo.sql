CREATE TYPE "public"."task_assignee_status" AS ENUM('pending', 'seen', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "family_task_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "task_assignee_status" DEFAULT 'pending' NOT NULL,
	"seen_at" timestamp with time zone,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "family_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "family_task_assignees" ADD CONSTRAINT "family_task_assignees_task_id_family_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."family_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_task_assignees" ADD CONSTRAINT "family_task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_tasks" ADD CONSTRAINT "family_tasks_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_tasks" ADD CONSTRAINT "family_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "family_task_assignees_task_user_uidx" ON "family_task_assignees" USING btree ("task_id","user_id");--> statement-breakpoint
CREATE INDEX "family_task_assignees_user_status_idx" ON "family_task_assignees" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "family_task_assignees_task_idx" ON "family_task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "family_tasks_family_due_idx" ON "family_tasks" USING btree ("family_id","due_at");--> statement-breakpoint
CREATE INDEX "family_tasks_created_by_idx" ON "family_tasks" USING btree ("created_by");