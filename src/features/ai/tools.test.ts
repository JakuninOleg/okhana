import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAiTool, getAiToolDefinitions } from '@/features/ai/tools';

const mockSaveNote = vi.hoisted(() => vi.fn());
const mockSearchNotes = vi.hoisted(() => vi.fn());

vi.mock('@/features/notes/save-note', () => ({
  saveNote: (...args: unknown[]) => mockSaveNote(...args),
}));

vi.mock('@/features/notes/search-notes', () => ({
  searchNotes: (...args: unknown[]) => mockSearchNotes(...args),
}));

describe('AI tools', () => {
  beforeEach(() => {
    mockSaveNote.mockReset();
    mockSearchNotes.mockReset();
  });

  it('exposes OpenAI-compatible tool definitions for Go-Ai', () => {
    const tools = getAiToolDefinitions();
    expect(tools.map((tool) => tool.function.name).sort()).toEqual([
      'remember_note',
      'search_notes',
    ]);
    expect(tools.every((tool) => tool.type === 'function')).toBe(true);
  });

  it('validates and executes remember_note in-app', async () => {
    mockSaveNote.mockResolvedValue(undefined);

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'remember_note',
        JSON.stringify({ title: 'Milk', content: 'Buy 2L', category: 'reminder' }),
      ),
    ).resolves.toEqual({ saved: true, title: 'Milk' });

    expect(mockSaveNote).toHaveBeenCalledWith({
      familyId: 1,
      createdBy: 2,
      title: 'Milk',
      content: 'Buy 2L',
      category: 'reminder',
      privacyLevel: 'public',
      hiddenFrom: undefined,
    });
  });

  it('rejects invalid remember_note arguments without writing', async () => {
    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'remember_note',
        JSON.stringify({ title: '' }),
      ),
    ).resolves.toEqual({ error: 'Invalid remember_note arguments' });
    expect(mockSaveNote).not.toHaveBeenCalled();
  });

  it('executes search_notes with the caller permission context', async () => {
    mockSearchNotes.mockResolvedValue([{ id: 1, title: 'Milk' }]);

    await expect(
      executeAiTool(
        { familyId: 4, userId: 8, familyRole: 'child' },
        'search_notes',
        JSON.stringify({ query: 'milk', limit: 3 }),
      ),
    ).resolves.toEqual({ notes: [{ id: 1, title: 'Milk' }] });

    expect(mockSearchNotes).toHaveBeenCalledWith({
      familyId: 4,
      userId: 8,
      familyRole: 'child',
      query: 'milk',
      limit: 3,
    });
  });

  it('returns an error for unknown tools', async () => {
    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'delete_everything',
        '{}',
      ),
    ).resolves.toEqual({ error: 'Unknown tool: delete_everything' });
  });
});
