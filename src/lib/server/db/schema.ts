import {
  pgTable, serial, varchar, integer, timestamp, date,
  boolean, text, jsonb, pgEnum, index, uniqueIndex, type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums (only used ones)
export const familyRoleEnum = pgEnum('family_role', ['owner', 'adult', 'child']);
export const profileSexEnum = pgEnum('profile_sex', ['female', 'male', 'unspecified']);
export const privacyLevelEnum = pgEnum('privacy_level', ['public', 'adults_only', 'personal']);
export const noteCategoryEnum = pgEnum('note_category', ['general', 'document', 'medical', 'finance', 'reminder']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
/** Per-assignee lifecycle for family tasks (поручения). */
export const taskAssigneeStatusEnum = pgEnum('task_assignee_status', [
  'pending',
  'seen',
  'done',
  'cancelled',
]);

// 1. users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  familyId: integer('family_id').references((): AnyPgColumn => families.id, { onDelete: 'set null' }),
  familyRole: familyRoleEnum('family_role'),
  /** How the family addresses this person ("Мама", "Саша") — separate from Clerk name. */
  displayName: varchar('display_name', { length: 255 }),
  birthDate: date('birth_date'),
  profileSex: profileSexEnum('profile_sex').default('unspecified').notNull(),
  /** Social label: mom, dad, son, etc. Permissions stay in familyRole. */
  kinshipLabel: varchar('kinship_label', { length: 64 }),
  /** Hex color for calendar chips, e.g. #E89B6C */
  profileColor: varchar('profile_color', { length: 7 }),
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

// 5. family_tasks (chat-created поручения — separate from notes)
export const familyTasks = pgTable('family_tasks', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => [
  index('family_tasks_family_due_idx').on(table.familyId, table.dueAt),
  index('family_tasks_created_by_idx').on(table.createdBy),
]);

// 6. family_task_assignees (per-person ack + done)
export const familyTaskAssignees = pgTable('family_task_assignees', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => familyTasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: taskAssigneeStatusEnum('status').default('pending').notNull(),
  seenAt: timestamp('seen_at', { withTimezone: true }),
  doneAt: timestamp('done_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('family_task_assignees_task_user_uidx').on(table.taskId, table.userId),
  index('family_task_assignees_user_status_idx').on(table.userId, table.status),
  index('family_task_assignees_task_idx').on(table.taskId),
]);

/** Recurring family dates (anniversaries etc.) — materialize into `events` when calendar ships. */
export const familyDateKindEnum = pgEnum('family_date_kind', [
  'anniversary',
  'birthday',
  'holiday',
  'other',
]);

export const familyDates = pgTable('family_dates', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  kind: familyDateKindEnum('kind').default('other').notNull(),
  /** Recurring calendar month (1–12). */
  month: integer('month').notNull(),
  /** Recurring calendar day (1–31). */
  day: integer('day').notNull(),
  /** Optional original year (wedding year, birth year) for “N years ago”. */
  year: integer('year'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('family_dates_family_md_idx').on(table.familyId, table.month, table.day),
]);

/** Web Push endpoints per device (PWA notifications for tasks). */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: varchar('p256dh', { length: 255 }).notNull(),
  auth: varchar('auth', { length: 255 }).notNull(),
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('push_subscriptions_endpoint_uidx').on(table.endpoint),
  index('push_subscriptions_user_idx').on(table.userId),
]);

// 7. ai_conversations
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

// 8. ai_chat_messages
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
  createdTasks: many(familyTasks),
  createdFamilyDates: many(familyDates),
  taskAssignments: many(familyTaskAssignees),
  pushSubscriptions: many(pushSubscriptions),
  conversations: many(aiConversations),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  owner: one(users, { fields: [families.ownerId], references: [users.id] }),
  members: many(users),
  notes: many(notes),
  events: many(events),
  tasks: many(familyTasks),
  familyDates: many(familyDates),
  conversations: many(aiConversations),
}));

export const familyDatesRelations = relations(familyDates, ({ one }) => ({
  family: one(families, { fields: [familyDates.familyId], references: [families.id] }),
  creator: one(users, { fields: [familyDates.createdBy], references: [users.id] }),
}));

export const familyTasksRelations = relations(familyTasks, ({ one, many }) => ({
  family: one(families, { fields: [familyTasks.familyId], references: [families.id] }),
  creator: one(users, { fields: [familyTasks.createdBy], references: [users.id] }),
  assignees: many(familyTaskAssignees),
}));

export const familyTaskAssigneesRelations = relations(familyTaskAssignees, ({ one }) => ({
  task: one(familyTasks, { fields: [familyTaskAssignees.taskId], references: [familyTasks.id] }),
  user: one(users, { fields: [familyTaskAssignees.userId], references: [users.id] }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
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
