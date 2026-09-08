import { describe, expect, it } from 'vitest';
import {
  isTaskDueTodayOrTomorrow,
  selectPriorityTasks,
} from '@/features/tasks/priority-tasks';

describe('priority-tasks', () => {
  const now = new Date('2026-09-09T15:00:00+03:00');

  it('marks overdue, today, and tomorrow as urgent', () => {
    expect(isTaskDueTodayOrTomorrow('2026-09-08T12:00:00+03:00', now)).toBe(true);
    expect(isTaskDueTodayOrTomorrow('2026-09-09T20:00:00+03:00', now)).toBe(true);
    expect(isTaskDueTodayOrTomorrow('2026-09-10T09:00:00+03:00', now)).toBe(true);
    expect(isTaskDueTodayOrTomorrow('2026-09-11T09:00:00+03:00', now)).toBe(false);
    expect(isTaskDueTodayOrTomorrow(null, now)).toBe(false);
  });

  it('lists urgent tasks before others', () => {
    const selected = selectPriorityTasks(
      [
        { id: 1, dueAt: '2026-09-12T10:00:00+03:00' },
        { id: 2, dueAt: '2026-09-10T10:00:00+03:00' },
        { id: 3, dueAt: null },
        { id: 4, dueAt: '2026-09-09T10:00:00+03:00' },
      ],
      now,
      5,
    );
    expect(selected.map((task) => task.id)).toEqual([4, 2, 1, 3]);
  });
});
