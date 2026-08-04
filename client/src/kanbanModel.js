export const DEFAULT_KANBAN_COLUMNS = [
  { id: 'brief', label: 'Brief', statuses: ['To Do'], targetStatus: 'To Do', visible: true },
  { id: 'worksheet', label: 'Worksheet', statuses: ['Draft 1'], targetStatus: 'Draft 1', visible: true },
  { id: 'progress', label: 'In Progress', statuses: ['Draft 2'], targetStatus: 'Draft 2', visible: true },
  { id: 'review', label: 'Review', statuses: ['Final'], targetStatus: 'Final', visible: true },
  { id: 'revision', label: 'Revision', statuses: ['Client Review'], targetStatus: 'Client Review', visible: true },
  { id: 'approved', label: 'Approved', statuses: ['Approval', 'Done'], targetStatus: 'Approval', visible: true },
  { id: 'archive', label: 'Archive', statuses: ['Cancelled', 'Archive'], targetStatus: 'Archive', visible: true, archive: true },
];

// A Kanban card represents one task. Draft/phase rows remain details inside
// that task and must never create additional cards.
export function groupTasksByColumn(tasks, columns = DEFAULT_KANBAN_COLUMNS) {
  const grouped = new Map(columns.map((column) => [column.id, []]));
  const seenTaskIds = new Set();
  for (const task of tasks || []) {
    if (!task?.id || seenTaskIds.has(task.id)) continue;
    seenTaskIds.add(task.id);
    const column = columns.find((candidate) => candidate.statuses.includes(task.status));
    if (column) grouped.get(column.id).push(task);
  }
  return grouped;
}

export function replaceTaskCard(tasks, updated) {
  if (!updated?.id) return tasks || [];
  let found = false;
  const next = (tasks || []).map((task) => {
    if (task.id !== updated.id) return task;
    found = true;
    return updated;
  });
  // A move can update an existing card but may never create a new task/card.
  return found ? next : (tasks || []);
}

export function resolveKanbanMove(task, column) {
  if (!task || !column) return { allowed: false, reason: 'invalid' };
  if (column.statuses.includes(task.status)) return { allowed: true, noop: true, nextStatus: task.status };
  const nextStatus = column.targetStatus;
  if (!task.workflow?.allowedTransitions?.includes(nextStatus)) {
    return { allowed: false, reason: 'workflow', nextStatus };
  }
  return { allowed: true, noop: false, nextStatus };
}

export function restoreKanbanColumns(preferences) {
  if (!Array.isArray(preferences)) return DEFAULT_KANBAN_COLUMNS.map((column) => ({ ...column }));
  const byId = new Map(DEFAULT_KANBAN_COLUMNS.map((column) => [column.id, column]));
  const restored = [];
  const seen = new Set();
  for (const preference of preferences) {
    const base = byId.get(preference?.id);
    if (!base || seen.has(base.id)) continue;
    seen.add(base.id);
    restored.push({
      ...base,
      label: String(preference.label || base.label).trim().slice(0, 40) || base.label,
      visible: base.archive ? true : preference.visible !== false,
    });
  }
  for (const base of DEFAULT_KANBAN_COLUMNS) {
    if (!seen.has(base.id)) restored.push({ ...base });
  }
  return restored;
}
