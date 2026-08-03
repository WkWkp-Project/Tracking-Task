export const TASK_STATUSES = [
  'To Do',
  'Draft 1',
  'Draft 2',
  'Final',
  'Client Review',
  'Approval',
  'Done',
  'Cancelled',
  'Archive',
];

export const DRAFT_STATUSES = ['Pending', 'In Progress', 'Revising', 'Approved'];

const TASK_TRANSITIONS = {
  'To Do': ['Draft 1', 'Cancelled', 'Archive'],
  'Draft 1': ['To Do', 'Draft 2', 'Final', 'Cancelled', 'Archive'],
  'Draft 2': ['Draft 1', 'Final', 'Cancelled', 'Archive'],
  Final: ['Draft 2', 'Client Review', 'Cancelled', 'Archive'],
  'Client Review': ['Final', 'Approval', 'Cancelled', 'Archive'],
  Approval: ['Final', 'Client Review', 'Done', 'Cancelled', 'Archive'],
  Done: ['Approval', 'Archive'],
  Cancelled: ['To Do', 'Archive'],
  Archive: ['To Do'],
};

const WORKER_TASK_STATUSES = new Set(['To Do', 'Draft 1', 'Draft 2', 'Final']);

const DRAFT_TRANSITIONS = {
  Pending: ['In Progress'],
  'In Progress': ['Revising', 'Approved'],
  Revising: ['In Progress', 'Approved'],
  Approved: ['Revising'],
};

export function isTaskManager(user, task, project = null) {
  if (!user || user.disabled) return false;
  return (
    user.role === 'admin' ||
    (user.role === 'pm' && (task?.pmId === user.id || project?.pmId === user.id))
  );
}

export function isTaskAssignee(user, task) {
  return Boolean(user && !user.disabled && task?.assigneeId === user.id);
}

export function canCreateTask(user, project) {
  if (!user || user.disabled) return false;
  return user.role === 'admin' || (user.role === 'pm' && project?.pmId === user.id);
}

export function canEditTaskDetails(user, task, project = null) {
  return isTaskManager(user, task, project);
}

export function canContributeToTask(user, task, project = null) {
  return isTaskManager(user, task, project) || isTaskAssignee(user, task);
}

export function allowedTaskTransitions(user, task, project = null) {
  const candidates = TASK_TRANSITIONS[task?.status] || [];
  if (isTaskManager(user, task, project)) return candidates;
  if (!isTaskAssignee(user, task)) return [];
  return candidates.filter(
    (status) => WORKER_TASK_STATUSES.has(status) && WORKER_TASK_STATUSES.has(task.status)
  );
}

export function canTransitionTask(user, task, nextStatus, project = null) {
  return (
    nextStatus === task?.status ||
    allowedTaskTransitions(user, task, project).includes(nextStatus)
  );
}

export function allowedDraftTransitions(user, task, draft, project = null) {
  const candidates = DRAFT_TRANSITIONS[draft?.status] || [];
  if (isTaskManager(user, task, project)) return candidates;
  if (!isTaskAssignee(user, task)) return [];
  return candidates.filter((status) => status !== 'Approved');
}

export function canTransitionDraft(user, task, draft, nextStatus, project = null) {
  return (
    nextStatus === draft?.status ||
    allowedDraftTransitions(user, task, draft, project).includes(nextStatus)
  );
}

export function workflowFor(user, task, project = null) {
  const manager = isTaskManager(user, task, project);
  const assignee = isTaskAssignee(user, task);
  return {
    canManage: manager,
    canContribute: manager || assignee,
    canEditDetails: manager,
    canLogHours: manager || assignee,
    allowedTransitions: allowedTaskTransitions(user, task, project),
  };
}
