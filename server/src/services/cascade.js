// Centralized cascade cleanup so deleting a task (directly, or as part of
// deleting its project) always removes the same set of dependent records.
// Keeping this in one place prevents the drift where task-delete and
// project-delete cleaned up different subsets and left orphans behind.

import db from '../db.js';
import { deleteTaskEvent } from './calendar.js';

// Remove everything owned by a task: its drafts, attachments, notes/updates,
// and time logs. Chat messages that merely *tag* the task are left intact —
// they belong to their conversation, not to the task.
export function deleteTaskCascade(taskId) {
  db.drafts.removeWhere((dr) => dr.taskId === taskId);
  db.attachments.removeWhere((a) => a.taskId === taskId);
  db.taskUpdates.removeWhere((entry) => entry.taskId === taskId);
  db.timeLogs.removeWhere((entry) => entry.taskId === taskId);
  db.tasks.remove(taskId);
}

// Best-effort calendar event removal for a task (needs the acting user's
// Google credentials). Never throws — calendar sync is optional.
export async function removeTaskCalendarEvent(actingUser, task) {
  if (!task?.calendarEventId) return;
  try { await deleteTaskEvent(actingUser, task.calendarEventId); } catch { /* optional */ }
}
