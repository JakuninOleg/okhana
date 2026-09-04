import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAiTool, getAiToolDefinitions } from '@/features/ai/tools';

const mockSaveNote = vi.hoisted(() => vi.fn());
const mockSearchNotes = vi.hoisted(() => vi.fn());
const mockCreateFamilyTask = vi.hoisted(() => vi.fn());
const mockListVisibleTasks = vi.hoisted(() => vi.fn());
const mockAcknowledge = vi.hoisted(() => vi.fn());
const mockComplete = vi.hoisted(() => vi.fn());

vi.mock('@/features/notes/save-note', () => ({
  saveNote: (...args: unknown[]) => mockSaveNote(...args),
}));

vi.mock('@/features/notes/search-notes', () => ({
  searchNotes: (...args: unknown[]) => mockSearchNotes(...args),
}));

vi.mock('@/features/tasks/create-task', () => ({
  createFamilyTask: (...args: unknown[]) => mockCreateFamilyTask(...args),
}));

vi.mock('@/features/tasks/list-tasks', () => ({
  listVisibleTasks: (...args: unknown[]) => mockListVisibleTasks(...args),
}));

vi.mock('@/features/tasks/update-assignment', () => ({
  acknowledgeTaskAssignment: (...args: unknown[]) => mockAcknowledge(...args),
  completeTaskAssignment: (...args: unknown[]) => mockComplete(...args),
}));

describe('AI tools', () => {
  beforeEach(() => {
    mockSaveNote.mockReset();
    mockSearchNotes.mockReset();
    mockCreateFamilyTask.mockReset();
    mockListVisibleTasks.mockReset();
    mockAcknowledge.mockReset();
    mockComplete.mockReset();
  });

  it('exposes OpenAI-compatible tool definitions for Go-Ai', () => {
    const tools = getAiToolDefinitions();
    expect(tools.map((tool) => tool.function.name).sort()).toEqual([
      'acknowledge_task',
      'complete_task',
      'create_task',
      'list_tasks',
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

  it('creates a task with assignees', async () => {
    mockCreateFamilyTask.mockResolvedValue({
      taskId: 11,
      title: 'Buy bread',
      assigneeUserIds: [3],
      dueAt: null,
    });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'create_task',
        JSON.stringify({ title: 'Buy bread', assigneeUserIds: [3] }),
      ),
    ).resolves.toEqual({
      created: true,
      taskId: 11,
      title: 'Buy bread',
      assigneeUserIds: [3],
      dueAt: null,
    });
  });

  it('defaults create_task to the current user when no assignees given', async () => {
    mockCreateFamilyTask.mockResolvedValue({
      taskId: 12,
      title: 'Buy milk',
      assigneeUserIds: [2],
      dueAt: null,
    });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'create_task',
        JSON.stringify({ title: 'Buy milk' }),
      ),
    ).resolves.toMatchObject({ created: true, title: 'Buy milk' });

    expect(mockCreateFamilyTask).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 2,
        assigneeUserIds: [2],
        assignToEntireFamily: false,
      }),
    );
  });

  it('creates a task for the entire family via assignToEntireFamily', async () => {
    mockCreateFamilyTask.mockResolvedValue({
      taskId: 13,
      title: 'Cleanup',
      assigneeUserIds: [2, 3],
      dueAt: null,
    });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'create_task',
        JSON.stringify({ title: 'Cleanup', assignToEntireFamily: true }),
      ),
    ).resolves.toMatchObject({ created: true, taskId: 13 });

    expect(mockCreateFamilyTask).toHaveBeenCalledWith(
      expect.objectContaining({
        assignToEntireFamily: true,
        assigneeUserIds: [],
      }),
    );
  });

  it('passes dueAt through to create_task', async () => {
    mockCreateFamilyTask.mockResolvedValue({
      taskId: 14,
      title: 'Call',
      assigneeUserIds: [3],
      dueAt: '2026-09-05T18:00:00.000Z',
    });

    await executeAiTool(
      { familyId: 1, userId: 2, familyRole: 'owner' },
      'create_task',
      JSON.stringify({
        title: 'Call',
        assigneeUserIds: [3],
        dueAt: '2026-09-05T18:00:00+03:00',
      }),
    );

    expect(mockCreateFamilyTask).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt: new Date('2026-09-05T18:00:00+03:00'),
      }),
    );
  });

  it('rejects invalid create_task payloads', async () => {
    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'create_task',
        JSON.stringify({ title: '' }),
      ),
    ).resolves.toEqual({ error: 'Invalid create_task arguments' });
  });

  it('surfaces create_task domain errors', async () => {
    mockCreateFamilyTask.mockRejectedValue(new Error('Assignees not in family: 99'));
    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'create_task',
        JSON.stringify({ title: 'X', assigneeUserIds: [99] }),
      ),
    ).resolves.toEqual({ error: 'Assignees not in family: 99' });
  });

  it('acknowledges and completes tasks via tools', async () => {
    mockAcknowledge.mockResolvedValue({ ok: true, taskId: 9, status: 'seen' });
    mockComplete.mockResolvedValue({ ok: true, taskId: 9, status: 'done' });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'acknowledge_task',
        JSON.stringify({ taskId: 9 }),
      ),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'seen' });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'complete_task',
        JSON.stringify({ taskId: 9 }),
      ),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'done' });
  });

  it('rejects invalid acknowledge_task / complete_task args', async () => {
    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'acknowledge_task',
        JSON.stringify({ taskId: 0 }),
      ),
    ).resolves.toEqual({ error: 'Invalid acknowledge_task arguments' });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'complete_task',
        '{}',
      ),
    ).resolves.toEqual({ error: 'Invalid complete_task arguments' });
  });

  it('lists visible tasks for the caller', async () => {
    mockListVisibleTasks.mockResolvedValue([{ id: 1, title: 'X' }]);

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'list_tasks',
        JSON.stringify({ scope: 'active' }),
      ),
    ).resolves.toEqual({ tasks: [{ id: 1, title: 'X' }] });
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
