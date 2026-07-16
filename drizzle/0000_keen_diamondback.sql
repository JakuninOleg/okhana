CREATE TYPE "public"."family_role" AS ENUM('owner', 'adult', 'child');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."note_category" AS ENUM('general', 'document', 'medical', 'finance', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."privacy_level" AS ENUM('public', 'adults_only', 'personal');--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"tags" varchar(50)[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_id" integer NOT NULL,
	"invite_code" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "families_owner_id_unique" UNIQUE("owner_id"),
	CONSTRAINT "families_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"created_by" integer,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"privacy_level" "privacy_level" DEFAULT 'public' NOT NULL,
	"hidden_from" integer[],
	"category" "note_category" DEFAULT 'general' NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"iv" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"avatar_url" varchar(500),
	"family_id" integer,
	"family_role" "family_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "ai_chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_family_user_idx" ON "ai_conversations" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "conversations_updated_idx" ON "ai_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "events_family_start_idx" ON "events" USING btree ("family_id","start_time");--> statement-breakpoint
CREATE INDEX "families_invite_code_idx" ON "families" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "families_owner_id_idx" ON "families" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "notes_family_privacy_idx" ON "notes" USING btree ("family_id","privacy_level");--> statement-breakpoint
CREATE INDEX "notes_family_category_idx" ON "notes" USING btree ("family_id","category");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_family_id_idx" ON "users" USING btree ("family_id");