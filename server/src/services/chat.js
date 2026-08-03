// Channel key helpers for chat.
// A DM channel between two users is deterministic regardless of order,
// so user A and user B always resolve to the same channel.

export function dmChannelKey(userA, userB) {
  return [userA, userB].sort().join('::');
}

export function dmChannelMembers(channelKey) {
  const parts = String(channelKey || '').split('::');
  if (parts.length !== 2 || parts.some((part) => !part)) return null;
  if (dmChannelKey(parts[0], parts[1]) !== channelKey) return null;
  return parts;
}

export function canAccessDmChannel(userId, channelKey) {
  const members = dmChannelMembers(channelKey);
  return Boolean(members?.includes(userId));
}

export function selfChannelKey(userId) {
  return dmChannelKey(userId, userId);
}

export function taskChannelKey(taskId) {
  return `task:${taskId}`;
}

export function projectChannelKey(projectId) {
  return `project:${projectId}`;
}
