import {
  pgTable, serial, varchar, integer, timestamp,
  boolean, text, jsonb, pgEnum, index, foreignKey, type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums (only used ones)
export const familyRoleEnum = pgEnum('family_role', ['owner', 'adult', 'child']);
export const privacyLevelEnum = pgEnum('privacy_level', ['public', 'adults_only', 'personal']);
export const noteCategoryEnum = pgEnum('note_category', ['general', 'document', 'medical', 'finance', 'reminder']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);

// 1. users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  familyId: integer('family_id').references((): AnyPgColumn => families.id, { onDelete: 'set null' }),
  familyRole: familyRoleEnum('family_role'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('users_clerk_id_idx').on(table.clerkId),
  index('users_family_id_idx').on(table.familyId),
]);

// 2. families
export const families = pgTable('families', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerId: integer('owner_id').notNull().unique().references((): AnyPgColumn => users.id, { onDelete: 'restrict' }),
  inviteCode: varchar('invite_code', { length: 10 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('families_invite_code_idx').on(table.inviteCode),
  index('families_owner_id_idx').on(table.ownerId),
]);

// 3. notes (CORE PRODUCT — knowledge base)
export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  privacyLevel: privacyLevelEnum('privacy_level').default('public').notNull(),
  hiddenFrom: integer('hidden_from').array(),
  category: noteCategoryEnum('category').default('general').notNull(),
  isEncrypted: boolean('is_encrypted').default(false).notNull(),
  iv: varchar('iv', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notes_family_privacy_idx').on(table.familyId, table.privacyLevel),
  index('notes_family_category_idx').on(table.familyId, table.category),
]);

// 4. events (simplified calendar)
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  allDay: boolean('all_day').default(false).notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  tags: varchar('tags', { length: 50 }).array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('events_family_start_idx').on(table.familyId, table.startTime),
]);

// 5. ai_conversations
export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('conversations_family_user_idx').on(table.familyId, table.userId),
  index('conversations_updated_idx').on(table.updatedAt),
]);

// 6. ai_chat_messages
export const aiChatMessages = pgTable('ai_chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_conversation_idx').on(table.conversationId, table.createdAt),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  family: one(families, { fields: [users.familyId], references: [families.id] }),
  ownedFamily: one(families, { fields: [users.id], references: [families.ownerId] }),
  createdNotes: many(notes),
  createdEvents: many(events),
  conversations: many(aiConversations),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  owner: one(users, { fields: [families.ownerId], references: [users.id] }),
  members: many(users),
  notes: many(notes),
  events: many(events),
  conversations: many(aiConversations),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  family: one(families, { fields: [notes.familyId], references: [families.id] }),
  creator: one(users, { fields: [notes.createdBy], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  family: one(families, { fields: [events.familyId], references: [families.id] }),
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  family: one(families, { fields: [aiConversations.familyId], references: [families.id] }),
  user: one(users, { fields: [aiConversations.userId], references: [users.id] }),
  messages: many(aiChatMessages),
}));

export const aiChatMessagesRelations = relations(aiChatMessages, ({ one }) => ({
  conversation: one(aiConversations, { fields: [aiChatMessages.conversationId], references: [aiConversations.id] }),
}));
