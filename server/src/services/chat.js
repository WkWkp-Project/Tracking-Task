// Channel key helpers for chat.
// A DM channel between two users is deterministic regardless of order,
// so user A and user B always resolve to the same channel.

export function dmChannelKey(userA, userB) {
  return [userA, userB].sort().join('::');
}

export function taskChannelKey(taskId) {
  return `task:${taskId}`;
}

export function projectChannelKey(projectId) {
  return `project:${projectId}`;
}
