import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAiTool, getAiToolDefinitions } from '@/features/ai/tools';

const mockSaveNote = vi.hoisted(() => vi.fn());
const mockSearchNotes = vi.hoisted(() => vi.fn());
const mockCreateFamilyTask = vi.hoisted(() => vi.fn());
const mockListVisibleTasks = vi.hoisted(() => vi.fn());
const mockAcknowledge = vi.hoisted(() => vi.fn());
const mockComplete = vi.hoisted(() => vi.fn());
const mockNotifyAssigned = vi.hoisted(() => vi.fn());
const mockNotifyAcknowledged = vi.hoisted(() => vi.fn());
const mockNotifyCompleted = vi.hoisted(() => vi.fn());
const mockCreateFamilyEvent = vi.hoisted(() => vi.fn());
const mockListEventsInRange = vi.hoisted(() => vi.fn());
const mockCreateFamilyDate = vi.hoisted(() => vi.fn());
const mockListFamilyDates = vi.hoisted(() => vi.fn());
const mockListMemberBirthdays = vi.hoisted(() => vi.fn());

vi.mock('@/features/notes/save-note', () => ({
  saveNote: (...args: unknown[]) => mockSaveNote(...args),
}));

vi.mock('@/features/notes/search-notes', () => ({
  searchNotes: (...args: unknown[]) => mockSearchNotes(...args),
}));

vi.mock('@/features/calendar/list-events', () => ({
  createFamilyEvent: (...args: unknown[]) => mockCreateFamilyEvent(...args),
  listEventsInRange: (...args: unknown[]) => mockListEventsInRange(...args),
}));

vi.mock('@/features/family/create-family-date', () => ({
  createFamilyDate: (...args: unknown[]) => mockCreateFamilyDate(...args),
}));

vi.mock('@/features/family/list-family-dates', () => ({
  listFamilyDates: (...args: unknown[]) => mockListFamilyDates(...args),
}));

vi.mock('@/features/family/list-member-birthdays', () => ({
  listMemberBirthdays: (...args: unknown[]) => mockListMemberBirthdays(...args),
}));

vi.mock('@/features/tasks/create-task', () => ({
  createFamilyTask: (...args: unknown[]) => mockCreateFamilyTask(...args),
}));

vi.mock('@/features/notifications/task-notifications', () => ({
  notifyTaskAssigned: (...args: unknown[]) => mockNotifyAssigned(...args),
  notifyTaskAcknowledged: (...args: unknown[]) => mockNotifyAcknowledged(...args),
  notifyTaskCompleted: (...args: unknown[]) => mockNotifyCompleted(...args),
}));

vi.mock('@/features/notifications/family-activity-notifications', () => ({
  notifyEventCreated: vi.fn().mockResolvedValue(undefined),
  notifyMemorableDateCreated: vi.fn().mockResolvedValue(undefined),
  notifyNoteCreated: vi.fn().mockResolvedValue(undefined),
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
    mockNotifyAssigned.mockReset();
    mockNotifyCompleted.mockReset();
    mockCreateFamilyEvent.mockReset();
    mockListEventsInRange.mockReset();
    mockCreateFamilyDate.mockReset();
    mockListFamilyDates.mockReset();
    mockListMemberBirthdays.mockReset();
  });

  it('exposes OpenAI-compatible tool definitions for Go-Ai', () => {
    const tools = getAiToolDefinitions();
    expect(tools.map((tool) => tool.function.name).sort()).toEqual([
      'acknowledge_task',
      'complete_task',
      'create_event',
      'create_memorable_date',
      'create_task',
      'list_events',
      'list_memorable_dates',
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
    mockAcknowledge.mockResolvedValue({ ok: true, taskId: 9, status: 'seen', changed: true });
    mockComplete.mockResolvedValue({ ok: true, taskId: 9, status: 'done', changed: true });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'acknowledge_task',
        JSON.stringify({ taskId: 9 }),
      ),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'seen', changed: true });
    expect(mockNotifyAcknowledged).toHaveBeenCalledWith({
      familyId: 1,
      taskId: 9,
      acknowledgedByUserId: 2,
    });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'adult' },
        'complete_task',
        JSON.stringify({ taskId: 9 }),
      ),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'done', changed: true });
    expect(mockNotifyCompleted).toHaveBeenCalledWith({
      familyId: 1,
      taskId: 9,
      completedByUserId: 2,
    });
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

  it('notifies assignees after create_task and creator after complete_task', async () => {
    mockCreateFamilyTask.mockResolvedValue({
      taskId: 11,
      title: 'Buy bread',
      assigneeUserIds: [2, 3],
      dueAt: null,
    });
    mockComplete.mockResolvedValue({ ok: true, taskId: 11, status: 'done', changed: true });

    await executeAiTool(
      { familyId: 1, userId: 2, familyRole: 'owner' },
      'create_task',
      JSON.stringify({ title: 'Buy bread', assigneeUserIds: [3] }),
    );
    expect(mockNotifyAssigned).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Buy bread',
        createdBy: 2,
        assigneeUserIds: [2, 3],
      }),
    );

    await executeAiTool(
      { familyId: 1, userId: 3, familyRole: 'adult' },
      'complete_task',
      JSON.stringify({ taskId: 11 }),
    );
    expect(mockNotifyCompleted).toHaveBeenCalledWith({
      familyId: 1,
      taskId: 11,
      completedByUserId: 3,
    });
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

  it('creates a memorable date via create_memorable_date', async () => {
    mockCreateFamilyDate.mockResolvedValue({
      id: 9,
      title: 'Годовщина свадьбы',
      kind: 'anniversary',
      month: 6,
      day: 21,
      year: 2023,
    });

    await expect(
      executeAiTool(
        { familyId: 1, userId: 2, familyRole: 'owner' },
        'create_memorable_date',
        JSON.stringify({
          title: 'Годовщина свадьбы',
          kind: 'anniversary',
          month: 6,
          day: 21,
          year: 2023,
        }),
      ),
    ).resolves.toEqual({
      saved: true,
      id: 9,
      title: 'Годовщина свадьбы',
      kind: 'anniversary',
      month: 6,
      day: 21,
      year: 2023,
    });

    expect(mockCreateFamilyDate).toHaveBeenCalledWith({
      familyId: 1,
      createdBy: 2,
      title: 'Годовщина свадьбы',
      kind: 'anniversary',
      month: 6,
      day: 21,
      year: 2023,
      notes: null,
    });
  });

  it('rejects create_memorable_date for children', async () => {
    await expect(
      executeAiTool(
        { familyId: 1, userId: 4, familyRole: 'child' },
        'create_memorable_date',
        JSON.stringify({
          title: 'День рождения',
          kind: 'birthday',
          month: 3,
          day: 5,
        }),
      ),
    ).resolves.toEqual({ error: 'Children cannot create memorable dates' });
    expect(mockCreateFamilyDate).not.toHaveBeenCalled();
  });

  it('lists events using clientNow day boundary', async () => {
    mockListEventsInRange.mockResolvedValue([{ id: 1, title: 'Trip' }]);

    await expect(
      executeAiTool(
        {
          familyId: 1,
          userId: 2,
          familyRole: 'adult',
          clientNow: '2026-09-06T01:30:00+03:00',
        },
        'list_events',
        JSON.stringify({ daysAhead: 30 }),
      ),
    ).resolves.toEqual({ events: [{ id: 1, title: 'Trip' }] });

    expect(mockListEventsInRange).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 1,
        from: new Date('2026-09-05T21:00:00.000Z'),
        to: new Date('2026-10-05T21:00:00.000Z'),
      }),
    );
  });

  it('lists memorable dates together with profile member birthdays', async () => {
    mockListFamilyDates.mockResolvedValue([
      { id: 1, title: 'Anniversary', kind: 'anniversary', month: 6, day: 21 },
    ]);
    mockListMemberBirthdays.mockResolvedValue([
      {
        userId: 3,
        displayName: 'Саша',
        month: 3,
        day: 5,
        year: 2015,
        nextOccurrence: '2027-03-05',
      },
    ]);

    await expect(
      executeAiTool(
        {
          familyId: 1,
          userId: 2,
          familyRole: 'adult',
          clientNow: '2026-09-06T12:00:00+03:00',
        },
        'list_memorable_dates',
        '{}',
      ),
    ).resolves.toEqual({
      dates: [{ id: 1, title: 'Anniversary', kind: 'anniversary', month: 6, day: 21 }],
      memberBirthdays: [
        {
          userId: 3,
          displayName: 'Саша',
          month: 3,
          day: 5,
          year: 2015,
          nextOccurrence: '2027-03-05',
        },
      ],
    });

    expect(mockListFamilyDates).toHaveBeenCalledWith(1, {
      today: { year: 2026, month: 9, day: 6 },
    });
    expect(mockListMemberBirthdays).toHaveBeenCalledWith(1, {
      today: { year: 2026, month: 9, day: 6 },
    });
  });
});
