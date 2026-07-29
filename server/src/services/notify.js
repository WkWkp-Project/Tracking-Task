// Notification creation + real-time push.

import db from '../db.js';
import { emitToUser } from '../realtime.js';

export function notify(userId, { type, title, body, link, severity = 'info', meta = {} }) {
  if (!userId) return null;
  const n = {
    id: `ntf_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    userId,
    type,
    title,
    body: body || '',
    link: link || null,
    severity, // info | warning | critical
    meta,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.insert(n);
  emitToUser(userId, 'notification', n);
  return n;
}

export function notifyMany(userIds, payload) {
  return [...new Set(userIds.filter(Boolean))].map((uid) => notify(uid, payload));
}

export function unreadCount(userId) {
  return db.notifications.find((n) => n.userId === userId && !n.read).length;
}
