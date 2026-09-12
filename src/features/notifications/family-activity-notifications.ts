import { eq } from 'drizzle-orm';
import { noteIsVisibleToViewer } from '@/features/notes/note-visibility';
import { sendPushToUsers } from '@/features/notifications/web-push';
import { routing } from '@/i18n/routing';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

/** Locale-prefixed dashboard path for notification deep links. */
export function dashboardNotificationUrl(localePath?: string): string {
  if (localePath?.startsWith('/')) {
    return localePath;
  }
  return `/${routing.defaultLocale}/dashboard`;
}

async function listFamilyMemberIds(familyId: number): Promise<
  Array<{ id: number; familyRole: 'owner' | 'adult' | 'child' | null }>
> {
  return withDbRetry(async () =>
    db
      .select({
        id: users.id,
        familyRole: users.familyRole,
      })
      .from(users)
      .where(eq(users.familyId, familyId)),
  );
}

async function notifyFamilyExceptCreator(input: {
  familyId: number;
  createdBy: number;
  title: string;
  body: string;
  tag: string;
  localePath?: string;
  /** Extra filter after excluding the creator. */
  recipientFilter?: (
    member: { id: number; familyRole: 'owner' | 'adult' | 'child' | null },
  ) => boolean;
}): Promise<void> {
  const members = await listFamilyMemberIds(input.familyId);
  const recipients = members
    .filter((member) => member.id !== input.createdBy)
    .filter((member) => (input.recipientFilter ? input.recipientFilter(member) : true))
    .map((member) => member.id);

  if (recipients.length === 0) {
    return;
  }

  await sendPushToUsers(recipients, {
    title: input.title,
    body: input.body,
    url: dashboardNotificationUrl(input.localePath),
    tag: input.tag,
  });
}

/** New one-time calendar event — notify addressed participants, or whole family if none. */
export async function notifyEventCreated(input: {
  familyId: number;
  createdBy: number;
  eventId: number;
  eventTitle: string;
  participantUserIds?: number[];
  localePath?: string;
}): Promise<void> {
  const rawParticipants = input.participantUserIds;
  // Non-empty list = targeted event (even if only the creator remains after filter).
  if (rawParticipants != null && rawParticipants.length > 0) {
    const recipients = rawParticipants.filter((id) => id !== input.createdBy);
    if (recipients.length === 0) {
      return;
    }
    await sendPushToUsers(recipients, {
      title: 'Календарь',
      body: `Вас добавили к событию «${input.eventTitle}»`,
      url: dashboardNotificationUrl(input.localePath),
      tag: `event-${input.eventId}`,
    });
    return;
  }

  await notifyFamilyExceptCreator({
    familyId: input.familyId,
    createdBy: input.createdBy,
    title: 'Календарь',
    body: `Новое событие: «${input.eventTitle}»`,
    tag: `event-${input.eventId}`,
    localePath: input.localePath,
  });
}

/** New memorable date — notify other family members. */
export async function notifyMemorableDateCreated(input: {
  familyId: number;
  createdBy: number;
  dateId: number;
  dateTitle: string;
  localePath?: string;
}): Promise<void> {
  await notifyFamilyExceptCreator({
    familyId: input.familyId,
    createdBy: input.createdBy,
    title: 'Памятная дата',
    body: `Добавлена дата: «${input.dateTitle}»`,
    tag: `date-${input.dateId}`,
    localePath: input.localePath,
  });
}

/**
 * New note — only notify members who can see it (DB ACL).
 * Personal notes never push to others.
 */
export async function notifyNoteCreated(input: {
  familyId: number;
  createdBy: number;
  noteTitle: string;
  privacyLevel: 'public' | 'adults_only' | 'personal';
  hiddenFrom?: number[] | null;
  localePath?: string;
}): Promise<void> {
  if (input.privacyLevel === 'personal') {
    return;
  }

  const snapshot = {
    privacyLevel: input.privacyLevel,
    createdBy: input.createdBy,
    hiddenFrom: input.hiddenFrom ?? null,
  };

  await notifyFamilyExceptCreator({
    familyId: input.familyId,
    createdBy: input.createdBy,
    title: 'Новая заметка',
    body: `Семья сохранила: «${input.noteTitle}»`,
    tag: `note-${input.createdBy}-${input.noteTitle.slice(0, 24)}`,
    localePath: input.localePath,
    recipientFilter: (member) => {
      if (!member.familyRole) {
        return false;
      }
      return noteIsVisibleToViewer(snapshot, {
        userId: member.id,
        familyRole: member.familyRole,
      });
    },
  });
}
