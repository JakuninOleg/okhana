import { z } from 'zod';
import type { GoAiToolDefinition } from '@/features/ai/go-ai-types';
import { saveNote } from '@/features/notes/save-note';
import { searchNotes } from '@/features/notes/search-notes';
import { createFamilyTask } from '@/features/tasks/create-task';
import { listVisibleTasks } from '@/features/tasks/list-tasks';
import {
  acknowledgeTaskAssignment,
  completeTaskAssignment,
} from '@/features/tasks/update-assignment';

type FamilyRole = 'owner' | 'adult' | 'child';

export type BuildAiToolsInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
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

/** OpenAI-compatible tool schemas sent to Go-Ai (execution stays in-app). */
export function getAiToolDefinitions(): GoAiToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'remember_note',
        description:
          'Save a durable family FACT (where something is, preferences, documents, context). Do NOT use for actions to do like buy/call/remind — use create_task for those.',
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
        description: 'Search visible family notes. Results are already filtered by user permissions.',
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
        name: 'create_task',
        description:
          'Create a family task / reminder / поручение — something someone should DO (buy milk, call doctor, take out trash). Use this when the user says "запомни купи…", "напомни…", "поручи…". Not for static facts (use remember_note). Assign by member id or entire family; if only a self-reminder, assign the current user.',
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
          'List family tasks visible to the current user (as creator and/or assignee). Filtered at the database.',
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
  input: BuildAiToolsInput,
  name: string,
  rawArguments: string,
): Promise<unknown> {
  const args = parseToolArguments(rawArguments);

  if (name === 'remember_note') {
    const parsed = rememberNoteArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid remember_note arguments' };
    }

    await saveNote({
      familyId: input.familyId,
      createdBy: input.userId,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      privacyLevel: parsed.data.privacyLevel,
      hiddenFrom: parsed.data.hiddenFrom,
    });

    return { saved: true, title: parsed.data.title };
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

  if (name === 'acknowledge_task') {
    const parsed = taskIdArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid acknowledge_task arguments' };
    }
    return acknowledgeTaskAssignment({
      familyId: input.familyId,
      userId: input.userId,
      taskId: parsed.data.taskId,
    });
  }

  if (name === 'complete_task') {
    const parsed = taskIdArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: 'Invalid complete_task arguments' };
    }
    return completeTaskAssignment({
      familyId: input.familyId,
      userId: input.userId,
      taskId: parsed.data.taskId,
    });
  }

  return { error: `Unknown tool: ${name}` };
}
