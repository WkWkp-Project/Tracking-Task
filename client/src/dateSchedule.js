export const DAY_MS = 86400000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Date-only task fields are calendar keys, not instants. UTC noon keeps their
// arithmetic stable across browser timezones and daylight-saving boundaries.
export function dateKeyMs(value) {
  if (!DATE_KEY.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day, 12);
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

export function timelineBounds(tasks, now = new Date()) {
  const validTasks = (tasks || []).filter((task) => {
    const start = dateKeyMs(task.startDate);
    const end = dateKeyMs(task.endDate);
    return start !== null && end !== null && start <= end;
  });
  if (!validTasks.length) {
    return {
      validTasks,
      startMs: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
      days: 35,
    };
  }
  const startMs = Math.min(...validTasks.map((task) => dateKeyMs(task.startDate))) - DAY_MS * 2;
  const endMs = Math.max(...validTasks.map((task) => dateKeyMs(task.endDate))) + DAY_MS * 3;
  return { validTasks, startMs, days: Math.max(21, Math.round((endMs - startMs) / DAY_MS) + 1) };
}

export function timelinePosition(task, bounds) {
  const start = (dateKeyMs(task.startDate) - bounds.startMs) / DAY_MS;
  const duration = (dateKeyMs(task.endDate) - dateKeyMs(task.startDate)) / DAY_MS + 1;
  const left = Math.max(0, (start / bounds.days) * 100);
  return {
    left,
    width: Math.max(3, Math.min(100 - left, (duration / bounds.days) * 100)),
    duration,
  };
}
