import { z } from 'zod';
import type { GoAiToolDefinition } from '@/features/ai/go-ai-types';
import { buildUpcomingRange, calendarYmdFromClientNow, interpretEventDateTime } from '@/features/calendar/calendar-time';
import { createFamilyDate } from '@/features/family/create-family-date';
import { FAMILY_DATE_KINDS, isValidMonthDay } from '@/features/family/family-date-utils';
import { listFamilyDates } from '@/features/family/list-family-dates';
import { listMemberBirthdays } from '@/features/family/list-member-birthdays';
import { saveNote } from '@/features/notes/save-note';
import { searchNotes } from '@/features/notes/search-notes';
import {
  deleteVisibleNote,
  updateVisibleNoteContent,
  updateVisibleNotePrivacy,
} from '@/features/notes/list-notes';
import { createFamilyTask } from '@/features/tasks/create-task';
import { listVisibleTasks } from '@/features/tasks/list-tasks';
import {
  acknowledgeTaskAssignment,
  completeTaskAssignment,
} from '@/features/tasks/update-assignment';
import { cancelFamilyTask, updateFamilyTask } from '@/features/tasks/manage-task';
import {
  notifyTaskAcknowledged,
  notifyTaskAssigned,
  notifyTaskCompleted,
} from '@/features/notifications/task-notifications';
import {
  notifyEventCreated,
  notifyMemorableDateCreated,
  notifyNoteCreated,
} from '@/features/notifications/family-activity-notifications';
import {
  createFamilyEvent,
  listEventsInRange,
} from '@/features/calendar/list-events';
import { loadActiveFamilyMember } from '@/lib/server/family/assert-family-member';

type FamilyRole = 'owner' | 'adult' | 'child';

export type BuildAiToolsInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  /** Device-local ISO-8601 with offset — calendar “today” and relative deadlines. */
  clientNow?: string | null;
};

const rememberNoteArgsSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  category: z.enum(['general', 'document', 'medical', 'finance', 'reminder']).default('general'),
  privacyLevel: z.enum(['public', 'adults_only', 'personal']).default('public'),
  hiddenFrom: z.array(z.number().int().positive()).optional(),
});

const searchNotesArgsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(10).default(5),
});

const updateNoteArgsSchema = z.object({
  noteId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(8000),
});

const noteIdArgsSchema = z.object({
  noteId: z.number().int().positive(),
});

const updateNotePrivacyArgsSchema = z.object({
  noteId: z.number().int().positive(),
  privacyLevel: z.enum(['public', 'adults_only', 'personal']),
  hiddenFrom: z.array(z.number().int().positive()).optional(),
});

const createTaskArgsSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  dueAt: z
    .string()
    .optional()
    .nullable()
    .refine((value) => value == null || !Number.isNaN(Date.parse(value)), {
      message: 'Invalid dueAt datetime',
    }),
  assigneeUserIds: z.array(z.number().int().positive()).optional(),
  assignToEntireFamily: z.boolean().optional(),
});

const listTasksArgsSchema = z.object({
  scope: z.enum(['active', 'completed', 'all']).default('active'),
});

const taskIdArgsSchema = z.object({
  taskId: z.number().int().positive(),
});

const updateTaskArgsSchema = z.object({
  taskId: z.number().int().positive(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z
    .string()
    .optional()
    .nullable()
    .refine((value) => value == null || !Number.isNaN(Date.parse(value)), {
      message: 'Invalid dueAt datetime',
    }),
});

const createEventArgsSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1).optional(),
  allDay: z.boolean().optional(),
  participantUserIds: z.array(z.number().int().positive()).optional(),
});

const listEventsArgsSchema = z.object({
  daysAhead: z.number().int().min(1).max(180).default(30),
});

const createMemorableDateArgsSchema = z.object({
  title: z.string().min(1).max(255),
  kind: z.enum(FAMILY_DATE_KINDS),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/** OpenAI-compatible tool schemas sent to Go-Ai (execution stays in-app). */
export function getAiToolDefinitions(): GoAiToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'remember_note',
        description:
          'NOTES (заметки): save a durable family FACT — where documents/things are, preferences, medical/finance context. Example: "passport is in the cabinet". Do NOT use for поручения/actions (create_task), memorable dates/anniversaries/birthdays/holidays (create_memorable_date), or one-time appointments (create_event).',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            content: { type: 'string', minLength: 1 },
            category: {
              type: 'string',
              enum: ['general', 'document', 'medical', 'finance', 'reminder'],
              default: 'general',
            },
            privacyLevel: {
              type: 'string',
              enum: ['public', 'adults_only', 'personal'],
              default: 'public',
            },
            hiddenFrom: {
              type: 'array',
              items: { type: 'integer', minimum: 1 },
            },
          },
          required: ['title', 'content'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_notes',
        description:
          'Search family NOTES (заметки / facts). Returns note ids for update_note / delete_note / update_note_privacy. Not for tasks or memorable dates. Results are already filtered by user permissions.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', minLength: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_note',
        description:
          'Update title/content of an existing note the user can manage. Call search_notes first to get noteId. Author or owner/adult only.',
        parameters: {
          type: 'object',
          properties: {
            noteId: { type: 'integer', minimum: 1 },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            content: { type: 'string', minLength: 1, maxLength: 8000 },
          },
          required: ['noteId', 'title', 'content'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_note_privacy',
        description:
          'Change privacyLevel and optional hiddenFrom for a note. Author or owner/adult. Use after search_notes.',
        parameters: {
          type: 'object',
          properties: {
            noteId: { type: 'integer', minimum: 1 },
            privacyLevel: {
              type: 'string',
              enum: ['public', 'adults_only', 'personal'],
            },
            hiddenFrom: {
              type: 'array',
              items: { type: 'integer', minimum: 1 },
            },
          },
          required: ['noteId', 'privacyLevel'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_note',
        description:
          'Delete a note the user can manage (author or owner/adult). Call search_notes first for noteId. Confirm destructive intent when ambiguous.',
        parameters: {
          type: 'object',
          properties: {
            noteId: { type: 'integer', minimum: 1 },
          },
          required: ['noteId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_task',
        description:
          'TASKS / ПОРУЧЕНИЯ: create something someone should DO (buy milk, call doctor, pick up child). Triggers: "запомни купи…", "напомни…", "поручи…", "remember to…". Not for static facts (remember_note) or anniversaries/birthdays (create_memorable_date). Assign by member id from the family list — when the user says mom/маме/папа/etc., use that member\'s id (kinship field). Self-reminder → current user; entire family → assignToEntireFamily.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000 },
            dueAt: {
              type: 'string',
              description: 'ISO-8601 datetime with offset for the deadline in the user local time.',
            },
            assigneeUserIds: {
              type: 'array',
              items: { type: 'integer', minimum: 1 },
              description: 'Family member user ids from the system prompt list.',
            },
            assignToEntireFamily: {
              type: 'boolean',
              description: 'When true, assign to every family member (ignores assigneeUserIds).',
            },
          },
          required: ['title'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_tasks',
        description:
          'List family TASKS / ПОРУЧЕНИЯ visible to the current user (as creator and/or assignee). Use before update_task / cancel_task / acknowledge_task / complete_task to get taskId. Not notes or memorable dates.',
        parameters: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: ['active', 'completed', 'all'],
              default: 'active',
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_task',
        description:
          'Edit an existing task title, description, and/or dueAt. Creator or owner/adult. Call list_tasks first for taskId. Pass only fields that should change.',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'integer', minimum: 1 },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000 },
            dueAt: {
              type: 'string',
              description: 'ISO-8601 datetime with offset, or omit/null to clear.',
            },
          },
          required: ['taskId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cancel_task',
        description:
          'Cancel (soft-delete) a task. Creator or owner/adult. Call list_tasks first. Prefer cancel over inventing a new conflicting task.',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'integer', minimum: 1 },
          },
          required: ['taskId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'acknowledge_task',
        description: 'Mark that the current user has seen a task assigned to them.',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'integer', minimum: 1 },
          },
          required: ['taskId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'complete_task',
        description:
          'Mark the current user done on a task assigned to them. Other assignees keep their own status.',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'integer', minimum: 1 },
          },
          required: ['taskId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_event',
        description:
          'One-time calendar EVENT (appointment, trip, school meeting) — happens once. Not a recurring memorable date (create_memorable_date) and not a note. Adults/owner only.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000 },
            startTime: {
              type: 'string',
              description: 'ISO-8601 datetime (prefer user local offset).',
            },
            endTime: { type: 'string' },
            allDay: { type: 'boolean', default: false },
            participantUserIds: {
              type: 'array',
              items: { type: 'integer' },
              description:
                'Family member user ids this event is addressed to (they get the push). Omit to notify the whole family.',
            },
          },
          required: ['title', 'startTime'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_events',
        description: 'List upcoming family calendar events in the next N days (default 30).',
        parameters: {
          type: 'object',
          properties: {
            daysAhead: { type: 'integer', minimum: 1, maximum: 180, default: 30 },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_memorable_date',
        description:
          'MEMORABLE DATES (памятные даты): recurring yearly date — wedding anniversary (годовщина), birthday (день рождения), holiday (праздник), other. Example 21.06.2023 → day=21, month=6, year=2023. NEVER remember_note or create_event. Adults/owner only.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            kind: {
              type: 'string',
              enum: [...FAMILY_DATE_KINDS],
              description: 'anniversary | birthday | holiday | other',
            },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            year: {
              type: 'integer',
              minimum: 1900,
              maximum: 2100,
              description: 'Original year if known (wedding year, birth year).',
            },
            notes: { type: 'string', maxLength: 2000 },
          },
          required: ['title', 'kind', 'month', 'day'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_memorable_dates',
        description:
          'List family MEMORABLE DATES (памятные даты): saved anniversaries/holidays plus member birthdays from profiles. Not notes or tasks.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    },
  ];
}

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export async function executeAiTool(
  rawInput: BuildAiToolsInput,
  name: string,
  rawArguments: string,
): Promise<unknown> {
  // Never trust cached familyId/role for mutations — re-check live membership.
  const member = await loadActiveFamilyMember(rawInput.userId, rawInput.familyId);
  if (!member) {
    return { error: 'Not a family member' };
  }
  const input: BuildAiToolsInput = {
    ...rawInput,
    familyId: member.familyId,
    familyRole: member.familyRole,
  };

  const args = parseToolArguments(rawArguments);

  if (name === 'remember_note') {
    const parsed = rememberNoteArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid remember_note arguments' };
    }

    const saved = await saveNote({
      familyId: input.familyId,
      createdBy: input.userId,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      privacyLevel: parsed.data.privacyLevel,
      hiddenFrom: parsed.data.hiddenFrom,
    });

    void notifyNoteCreated({
      familyId: input.familyId,
      createdBy: input.userId,
      noteTitle: parsed.data.title,
      privacyLevel: parsed.data.privacyLevel ?? 'public',
      hiddenFrom: parsed.data.hiddenFrom ?? null,
    });

    return { saved: true, noteId: saved.id, title: parsed.data.title };
  }

  if (name === 'search_notes') {
    const parsed = searchNotesArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid search_notes arguments' };
    }

    return {
      notes: await searchNotes({
        familyId: input.familyId,
        userId: input.userId,
        familyRole: input.familyRole,
        query: parsed.data.query,
        limit: parsed.data.limit,
      }),
    };
  }

  if (name === 'update_note') {
    const parsed = updateNoteArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid update_note arguments' };
    }
    const result = await updateVisibleNoteContent({
      familyId: input.familyId,
      userId: input.userId,
      familyRole: input.familyRole,
      noteId: parsed.data.noteId,
      title: parsed.data.title,
      content: parsed.data.content,
    });
    if (!result.ok) {
      return { error: result.error };
    }
    return { updated: true, noteId: parsed.data.noteId, title: parsed.data.title };
  }

  if (name === 'update_note_privacy') {
    const parsed = updateNotePrivacyArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid update_note_privacy arguments' };
    }
    const result = await updateVisibleNotePrivacy({
      familyId: input.familyId,
      userId: input.userId,
      familyRole: input.familyRole,
      noteId: parsed.data.noteId,
      privacyLevel: parsed.data.privacyLevel,
      hiddenFrom: parsed.data.hiddenFrom ?? [],
    });
    if (!result.ok) {
      return { error: result.error };
    }
    return {
      updated: true,
      noteId: parsed.data.noteId,
      privacyLevel: parsed.data.privacyLevel,
    };
  }

  if (name === 'delete_note') {
    const parsed = noteIdArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid delete_note arguments' };
    }
    const result = await deleteVisibleNote({
      familyId: input.familyId,
      userId: input.userId,
      familyRole: input.familyRole,
      noteId: parsed.data.noteId,
    });
    if (!result.ok) {
      return { error: result.error };
    }
    return { deleted: true, noteId: parsed.data.noteId };
  }

  if (name === 'create_task') {
    const parsed = createTaskArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid create_task arguments' };
    }

    const assignToEntireFamily = parsed.data.assignToEntireFamily === true;
    const assigneeUserIds = parsed.data.assigneeUserIds?.length
      ? parsed.data.assigneeUserIds
      : assignToEntireFamily
        ? []
        : [input.userId];

    try {
      const created = await createFamilyTask({
        familyId: input.familyId,
        createdBy: input.userId,
        title: parsed.data.title,
        description: parsed.data.description,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        assigneeUserIds,
        assignToEntireFamily,
      });
      void notifyTaskAssigned({
        title: created.title,
        createdBy: input.userId,
        assigneeUserIds: created.assigneeUserIds,
        dueAt: created.dueAt,
      });
      return { created: true, ...created };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create task' };
    }
  }

  if (name === 'list_tasks') {
    const parsed = listTasksArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid list_tasks arguments' };
    }

    return {
      tasks: await listVisibleTasks({
        familyId: input.familyId,
        userId: input.userId,
        scope: parsed.data.scope,
      }),
    };
  }

  if (name === 'update_task') {
    const parsed = updateTaskArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid update_task arguments' };
    }
    const hasField =
      parsed.data.title !== undefined
      || parsed.data.description !== undefined
      || parsed.data.dueAt !== undefined;
    if (!hasField) {
      return { error: 'Invalid update_task arguments' };
    }
    const result = await updateFamilyTask({
      familyId: input.familyId,
      userId: input.userId,
      familyRole: input.familyRole,
      taskId: parsed.data.taskId,
      title: parsed.data.title,
      description: parsed.data.description,
      dueAt: parsed.data.dueAt === undefined
        ? undefined
        : parsed.data.dueAt === null
          ? null
          : new Date(parsed.data.dueAt),
    });
    if (!result.ok) {
      return { error: result.error };
    }
    return {
      updated: true,
      taskId: result.taskId,
      title: result.title,
      dueAt: result.dueAt,
    };
  }

  if (name === 'cancel_task') {
    const parsed = taskIdArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid cancel_task arguments' };
    }
    const result = await cancelFamilyTask({
      familyId: input.familyId,
      userId: input.userId,
      familyRole: input.familyRole,
      taskId: parsed.data.taskId,
    });
    if (!result.ok) {
      return { error: result.error };
    }
    return { cancelled: true, taskId: result.taskId };
  }

  if (name === 'acknowledge_task') {
    const parsed = taskIdArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid acknowledge_task arguments' };
    }
    const result = await acknowledgeTaskAssignment({
      familyId: input.familyId,
      userId: input.userId,
      taskId: parsed.data.taskId,
    });
    if (result.ok && result.changed) {
      void notifyTaskAcknowledged({
        familyId: input.familyId,
        taskId: parsed.data.taskId,
        acknowledgedByUserId: input.userId,
      });
    }
    return result;
  }

  if (name === 'complete_task') {
    const parsed = taskIdArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid complete_task arguments' };
    }
    const result = await completeTaskAssignment({
      familyId: input.familyId,
      userId: input.userId,
      taskId: parsed.data.taskId,
    });
    if (result.ok && result.changed) {
      void notifyTaskCompleted({
        familyId: input.familyId,
        taskId: parsed.data.taskId,
        completedByUserId: input.userId,
      });
    }
    return result;
  }

  if (name === 'create_event') {
    if (input.familyRole === 'child') {
      return { error: 'Children cannot create calendar events' };
    }
    const parsed = createEventArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid create_event arguments' };
    }
    const startTime = interpretEventDateTime(parsed.data.startTime, input.clientNow);
    if (!startTime) {
      return {
        error:
          'Invalid create_event startTime — use ISO-8601 with offset (e.g. 2026-09-10T18:00:00+03:00)',
      };
    }
    let endTime: Date | null = null;
    if (parsed.data.endTime) {
      endTime = interpretEventDateTime(parsed.data.endTime, input.clientNow);
      if (!endTime) {
        return { error: 'Invalid create_event endTime' };
      }
    }
    return createFamilyEvent({
      familyId: input.familyId,
      createdBy: input.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      startTime,
      endTime,
      allDay: parsed.data.allDay ?? false,
      participantUserIds: parsed.data.participantUserIds,
    }).then((created) => {
      void notifyEventCreated({
        familyId: input.familyId,
        createdBy: input.userId,
        eventId: created.id,
        eventTitle: parsed.data.title,
        participantUserIds: created.participantUserIds,
      });
      return {
        id: created.id,
        title: parsed.data.title,
        participantUserIds: created.participantUserIds,
      };
    });
  }

  if (name === 'list_events') {
    const parsed = listEventsArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid list_events arguments' };
    }
    const { from, to } = buildUpcomingRange({
      daysAhead: parsed.data.daysAhead,
      clientNowIso: input.clientNow ?? null,
    });
    return {
      events: await listEventsInRange({
        familyId: input.familyId,
        from,
        to,
      }),
    };
  }

  if (name === 'create_memorable_date') {
    if (input.familyRole === 'child') {
      return { error: 'Children cannot create memorable dates' };
    }
    const parsed = createMemorableDateArgsSchema.safeParse(args);
    if (!parsed.success || !isValidMonthDay(parsed.data.month, parsed.data.day)) {
      return { error: 'Invalid create_memorable_date arguments' };
    }
    try {
      const created = await createFamilyDate({
        familyId: input.familyId,
        createdBy: input.userId,
        title: parsed.data.title,
        kind: parsed.data.kind,
        month: parsed.data.month,
        day: parsed.data.day,
        year: parsed.data.year ?? null,
        notes: parsed.data.notes ?? null,
      });
      void notifyMemorableDateCreated({
        familyId: input.familyId,
        createdBy: input.userId,
        dateId: created.id,
        dateTitle: parsed.data.title,
      });
      return { saved: true, ...created };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to create memorable date',
      };
    }
  }

  if (name === 'list_memorable_dates') {
    const today = calendarYmdFromClientNow(input.clientNow ?? null) ?? undefined;
    const opts = today ? { today } : undefined;
    const [dates, memberBirthdays] = await Promise.all([
      listFamilyDates(input.familyId, opts),
      listMemberBirthdays(input.familyId, opts),
    ]);
    return { dates, memberBirthdays };
  }

  return { error: `Unknown tool: ${name}` };
}
