import { z } from 'zod';
import type { GoAiToolDefinition } from '@/features/ai/go-ai-types';
import { saveNote } from '@/features/notes/save-note';
import { searchNotes } from '@/features/notes/search-notes';

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

/** OpenAI-compatible tool schemas sent to Go-Ai (execution stays in-app). */
export function getAiToolDefinitions(): GoAiToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'remember_note',
        description: 'Save an important family note for future reference.',
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

  return { error: `Unknown tool: ${name}` };
}
