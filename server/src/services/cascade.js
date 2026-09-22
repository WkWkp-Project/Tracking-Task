// Centralized cascade cleanup so deleting a task (directly, or as part of
// deleting its project) always removes the same set of dependent records.
// Keeping this in one place prevents the drift where task-delete and
// project-delete cleaned up different subsets and left orphans behind.

import db from '../db.js';
import { calendarOwnerForTask, deleteTaskEvent } from './calendar.js';

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

// Remove a task's remote event with the Google account that created it. A
// failure is surfaced so callers do not delete local ownership metadata while
// leaving an unreachable event behind in Google Calendar.
export async function removeTaskCalendarEvent(actingUser, task) {
  if (!task?.calendarEventId) return;
  const owner = calendarOwnerForTask(task, actingUser, (id) => db.users.byId(id));
  await deleteTaskEvent(owner, task.calendarEventId);
}
