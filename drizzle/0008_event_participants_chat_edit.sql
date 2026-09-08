-- Event participants (who should be notified / is addressed) + soft-edit chat messages.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "participant_user_ids" integer[];--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_alive_idx" ON "ai_chat_messages" ("conversation_id", "created_at") WHERE "deleted_at" IS NULL;
