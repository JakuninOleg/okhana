import { describe, expect, it } from 'vitest';
import {
  filterTasksByScope,
  mapTaskRowsToVisible,
  type TaskAssigneeView,
  type VisibleTask,
} from '@/features/tasks/list-tasks';

function assignment(
  userId: number,
  status: TaskAssigneeView['status'],
): TaskAssigneeView {
  return {
    userId,
    status,
    seenAt: status === 'pending' ? null : '2026-09-01T10:00:00.000Z',
    doneAt: status === 'done' ? '2026-09-02T10:00:00.000Z' : null,
  };
}

function task(partial: Partial<VisibleTask> & Pick<VisibleTask, 'id' | 'title'>): VisibleTask {
  return {
    description: null,
    dueAt: null,
    createdBy: 1,
    createdAt: '2026-09-01T09:00:00.000Z',
    cancelledAt: null,
    isCreator: false,
    myAssignment: null,
    assignees: [],
    ...partial,
  };
}

describe('mapTaskRowsToVisible', () => {
  it('marks creator and attaches the viewer assignee row', () => {
    const mapped = mapTaskRowsToVisible({
      userId: 2,
      taskRows: [
        {
          id: 10,
          title: 'Buy milk',
          description: null,
          dueAt: new Date('2026-09-05T18:00:00.000Z'),
          createdBy: 1,
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          cancelledAt: null,
        },
      ],
      assignees: [
        {
          taskId: 10,
          userId: 2,
          status: 'pending',
          seenAt: null,
          doneAt: null,
        },
        {
          taskId: 10,
          userId: 3,
          status: 'seen',
          seenAt: new Date('2026-09-01T11:00:00.000Z'),
          doneAt: null,
        },
      ],
    });

    expect(mapped).toHaveLength(1);
    expect(mapped[0].isCreator).toBe(false);
    expect(mapped[0].myAssignment).toEqual({
      userId: 2,
      status: 'pending',
      seenAt: null,
      doneAt: null,
    });
    expect(mapped[0].assignees).toHaveLength(2);
    expect(mapped[0].dueAt).toBe('2026-09-05T18:00:00.000Z');
  });

  it('sets isCreator when the viewer created the task without being assigned', () => {
    const mapped = mapTaskRowsToVisible({
      userId: 1,
      taskRows: [
        {
          id: 11,
          title: 'For Darya',
          description: 'Call clinic',
          dueAt: null,
          createdBy: 1,
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          cancelledAt: null,
        },
      ],
      assignees: [
        {
          taskId: 11,
          userId: 2,
          status: 'pending',
          seenAt: null,
          doneAt: null,
        },
      ],
    });

    expect(mapped[0].isCreator).toBe(true);
    expect(mapped[0].myAssignment).toBeNull();
    expect(mapped[0].assignees[0].userId).toBe(2);
  });
});

describe('filterTasksByScope', () => {
  const activeAssigned = task({
    id: 1,
    title: 'Active for me',
    myAssignment: assignment(2, 'pending'),
    assignees: [assignment(2, 'pending')],
  });

  const seenAssigned = task({
    id: 2,
    title: 'Seen by me',
    myAssignment: assignment(2, 'seen'),
    assignees: [assignment(2, 'seen')],
  });

  const doneAssigned = task({
    id: 3,
    title: 'Done by me',
    myAssignment: assignment(2, 'done'),
    assignees: [assignment(2, 'done')],
  });

  const creatorWatchingOpen = task({
    id: 4,
    title: 'I created, others still open',
    isCreator: true,
    createdBy: 1,
    myAssignment: null,
    assignees: [assignment(2, 'pending'), assignment(3, 'done')],
  });

  const creatorWatchingAllDone = task({
    id: 5,
    title: 'I created, everyone done',
    isCreator: true,
    createdBy: 1,
    myAssignment: null,
    assignees: [assignment(2, 'done'), assignment(3, 'done')],
  });

  const cancelled = task({
    id: 6,
    title: 'Cancelled',
    cancelledAt: '2026-09-03T00:00:00.000Z',
    myAssignment: assignment(2, 'pending'),
    assignees: [assignment(2, 'pending')],
  });

  const allTasks = [
    activeAssigned,
    seenAssigned,
    doneAssigned,
    creatorWatchingOpen,
    creatorWatchingAllDone,
    cancelled,
  ];

  it('active: assignee pending/seen + creator open tasks; excludes done and cancelled', () => {
    expect(filterTasksByScope(allTasks, 'active').map((t) => t.id)).toEqual([1, 2, 4]);
  });

  it('completed: assignee done for me, or creator when all assignees done', () => {
    expect(filterTasksByScope(allTasks, 'completed').map((t) => t.id)).toEqual([3, 5]);
  });

  it('all: returns every visible task including cancelled', () => {
    expect(filterTasksByScope(allTasks, 'all').map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('per-assignee done does not complete for another assignee', () => {
    const multi = task({
      id: 20,
      title: 'Shared chore',
      myAssignment: assignment(2, 'done'),
      assignees: [assignment(2, 'done'), assignment(3, 'pending')],
    });

    expect(filterTasksByScope([multi], 'active')).toEqual([]);
    expect(filterTasksByScope([multi], 'completed').map((t) => t.id)).toEqual([20]);

    const asOther = {
      ...multi,
      myAssignment: assignment(3, 'pending'),
    };
    expect(filterTasksByScope([asOther], 'active').map((t) => t.id)).toEqual([20]);
    expect(filterTasksByScope([asOther], 'completed')).toEqual([]);
  });

  it('creator who is also assignee uses own assignment status for scopes', () => {
    const both = task({
      id: 21,
      title: 'Self + others',
      isCreator: true,
      createdBy: 1,
      myAssignment: assignment(1, 'done'),
      assignees: [assignment(1, 'done'), assignment(2, 'pending')],
    });

    expect(filterTasksByScope([both], 'active')).toEqual([]);
    expect(filterTasksByScope([both], 'completed').map((t) => t.id)).toEqual([21]);
  });
});
