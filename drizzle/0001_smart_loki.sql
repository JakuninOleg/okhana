CREATE TYPE "public"."profile_sex" AS ENUM('female', 'male', 'unspecified');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_sex" "profile_sex" DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kinship_label" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_color" varchar(7);