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

// Bell-notify offline recipients of a chat message (DM or group). Shared by the
// REST route and the socket 'chat:send' handler so both transports behave alike.
export function notifyChatRecipients(msg, senderName) {
  const preview = String(msg.body || '').slice(0, 80);
  if (msg.channelType === 'dm') {
    const otherId = String(msg.channelKey).split('::').find((id) => id !== msg.senderId);
    const other = db.users.byId(otherId);
    if (other && !other.online) {
      notify(otherId, {
        type: 'chat',
        title: `💬 ข้อความใหม่จาก ${senderName}`,
        body: preview,
        link: `/chat/${msg.channelKey}`,
        meta: { channelKey: msg.channelKey },
      });
    }
  } else if (msg.channelType === 'group') {
    const group = db.groups.byId(String(msg.channelKey).replace('group:', ''));
    group?.memberIds.filter((id) => id !== msg.senderId).forEach((id) => {
      const member = db.users.byId(id);
      if (member && !member.online) {
        notify(id, {
          type: 'chat',
          title: `💬 ${senderName} ส่งข้อความในกลุ่ม "${group.name}"`,
          body: preview,
          meta: { channelKey: msg.channelKey },
        });
      }
    });
  }
}

export function unreadCount(userId) {
  return db.notifications.find((n) => n.userId === userId && !n.read).length;
}
