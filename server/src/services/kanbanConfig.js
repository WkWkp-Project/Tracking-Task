export const KANBAN_COLUMN_DEFAULTS = [
  { id: 'brief', label: 'Brief', visible: true },
  { id: 'worksheet', label: 'Worksheet', visible: true },
  { id: 'progress', label: 'In Progress', visible: true },
  { id: 'review', label: 'Review', visible: true },
  { id: 'revision', label: 'Revision', visible: true },
  { id: 'approved', label: 'Approved', visible: true },
  { id: 'archive', label: 'Archive', visible: true },
];

const DEFAULT_BY_ID = new Map(KANBAN_COLUMN_DEFAULTS.map((column) => [column.id, column]));

export function canConfigureKanban(user) {
  return Boolean(user && !user.disabled && ['pm', 'admin'].includes(user.role));
}

export function normalizeKanbanPreferences(input) {
  if (!Array.isArray(input)) return KANBAN_COLUMN_DEFAULTS.map((column) => ({ ...column }));
  const seen = new Set();
  const normalized = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const base = DEFAULT_BY_ID.get(item.id);
    if (!base || seen.has(base.id)) continue;
    seen.add(base.id);
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 40) : '';
    normalized.push({
      id: base.id,
      label: label || base.label,
      visible: base.id === 'archive' ? true : item.visible !== false,
    });
  }
  for (const base of KANBAN_COLUMN_DEFAULTS) {
    if (!seen.has(base.id)) normalized.push({ ...base });
  }
  return normalized;
}
