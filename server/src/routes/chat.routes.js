import { Router } from 'express';
import db from '../db.js';
import { requireAuth, publicUser } from '../auth/jwt.js';
import { dmChannelKey } from '../services/chat.js';
import { saveMessage, emitMessage } from '../realtime.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

// List DM conversations for the current user (one entry per other member)
router.get('/conversations', (req, res) => {
  const me = req.user.id;
  const others = db.users.all().filter((u) => u.id !== me && !u.disabled);
  const convos = others.map((u) => {
    const ck = dmChannelKey(me, u.id);
    const msgs = db.messages
      .find((m) => m.channelType === 'dm' && m.channelKey === ck)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = msgs[msgs.length - 1] || null;
    const unread = msgs.filter((m) => m.senderId !== me && !m.readBy?.includes(me)).length;
    return { user: publicUser(u), channelKey: ck, lastMessage: last, unread };
  });
  convos.sort((a, b) => (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || ''));
  res.json({ conversations: convos });
});

// Get messages for a channel (dm channelKey, or task:<id> / project:<id>)
router.get('/messages', (req, res) => {
  const { channelKey } = req.query;
  if (!channelKey) return res.status(400).json({ error: 'channelKey required' });
  const msgs = db.messages
    .find((m) => m.channelKey === channelKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // mark as read for me
  msgs.forEach((m) => {
    if (!m.readBy?.includes(req.user.id)) {
      m.readBy = [...(m.readBy || []), req.user.id];
    }
  });
  db.persist();
  res.json({ messages: msgs });
});

// Send a message via REST (socket path also exists for live delivery)
router.post('/messages', (req, res) => {
  const { channelType = 'dm', channelKey, body, taskId, to } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });
  let ck = channelKey;
  if (channelType === 'dm' && to) ck = dmChannelKey(req.user.id, to);
  if (!ck) return res.status(400).json({ error: 'channelKey or to required' });

  const msg = saveMessage({
    senderId: req.user.id,
    channelType,
    channelKey: ck,
    body: body.trim(),
    taskId: taskId || null,
  });
  emitMessage(msg);

  // notify the DM recipient if offline / not in the channel
  if (channelType === 'dm') {
    const otherId = ck.split('::').find((id) => id !== req.user.id);
    const other = db.users.byId(otherId);
    if (other && !other.online) {
      notify(otherId, {
        type: 'chat',
        title: `💬 ข้อความใหม่จาก ${req.user.name}`,
        body: body.slice(0, 80),
        link: `/chat/${ck}`,
        meta: { channelKey: ck },
      });
    }
  }
  res.status(201).json({ message: msg });
});

export default router;
