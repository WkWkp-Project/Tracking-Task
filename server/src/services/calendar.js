// Google Calendar event create / update / delete for task scheduling.

import { google } from 'googleapis';
import { clientForUser, attachTokenPersistence, googleConfigured } from '../auth/google.js';

function calendarFor(user) {
  if (!googleConfigured) {
    const err = new Error('Google API not configured on the server.');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  if (!user.googleRefreshToken) {
    const err = new Error('This account has not linked Google yet.');
    err.code = 'GOOGLE_NOT_LINKED';
    throw err;
  }
  const auth = attachTokenPersistence(clientForUser(user), user.id);
  return google.calendar({ version: 'v3', auth });
}

// All-day event spanning the task window. Calendar end date is exclusive.
function eventBody(task, attendees = []) {
  const end = new Date(`${task.endDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    summary: `[${task.status}] ${task.title}`,
    description: task.description || '',
    start: { date: task.startDate },
    end: { date: end.toISOString().slice(0, 10) },
    attendees: attendees.filter(Boolean).map((email) => ({ email })),
    reminders: { useDefault: true },
  };
}

export async function upsertTaskEvent(user, task, attendees = []) {
  const cal = calendarFor(user);
  const body = eventBody(task, attendees);
  if (task.calendarEventId) {
    const res = await cal.events.update({
      calendarId: 'primary',
      eventId: task.calendarEventId,
      requestBody: body,
    });
    return { eventId: res.data.id, htmlLink: res.data.htmlLink };
  }
  const res = await cal.events.insert({ calendarId: 'primary', requestBody: body });
  return { eventId: res.data.id, htmlLink: res.data.htmlLink };
}

export async function deleteTaskEvent(user, eventId) {
  if (!eventId) return;
  const cal = calendarFor(user);
  try {
    await cal.events.delete({ calendarId: 'primary', eventId });
  } catch (e) {
    if (e?.code !== 404 && e?.code !== 410) throw e;
  }
}
