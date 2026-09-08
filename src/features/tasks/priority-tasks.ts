/**
 * Calendar-day urgency for the dashboard priority strip.
 * Urgent = overdue, due today, or due tomorrow (local timezone).
 */
export function isTaskDueTodayOrTomorrow(
  dueAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!dueAt) {
    return false;
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

  return due.getTime() < endOfTomorrow.getTime();
}

/** Urgent first (by due), then the rest — capped for the priority strip. */
export function selectPriorityTasks<T extends { dueAt: string | null }>(
  tasks: T[],
  now: Date = new Date(),
  limit = 5,
): T[] {
  const urgent = tasks
    .filter((task) => isTaskDueTodayOrTomorrow(task.dueAt, now))
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  const rest = tasks
    .filter((task) => !isTaskDueTodayOrTomorrow(task.dueAt, now))
    .sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return String(a.dueAt).localeCompare(String(b.dueAt));
    });
  return [...urgent, ...rest].slice(0, limit);
}
