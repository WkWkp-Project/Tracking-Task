import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, publicUser } from '../auth/jwt.js';
import { canAccessDmChannel, dmChannelKey } from '../services/chat.js';
import { saveMessage, decryptMessage, deleteMessage, emitMessage, emitDeleted } from '../realtime.js';
import { notify } from '../services/notify.js';
import { config } from '../config.js';
import { validateChatAttachment } from '../services/chatAttachments.js';

const router = Router();
router.use(requireAuth);

// List DM conversations for the current user (one entry per other member)
router.get('/conversations', (req, res) => {
  const me = req.user.id;
  const others = [
    req.user,
    ...db.users.all().filter((user) => user.id !== me && !user.disabled),
  ];
  const convos = others.map((u) => {
    const ck = dmChannelKey(me, u.id);
    const msgs = db.messages
      .find((m) => m.channelType === 'dm' && m.channelKey === ck)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = msgs[msgs.length - 1] || null;
    const unread = msgs.filter((message) => !message.readBy?.includes(me)).length;
    return {
      user: publicUser(u),
      self: u.id === me,
      channelKey: ck,
      lastMessage: last ? decryptMessage(last) : null,
      unread,
    };
  });
  convos.sort((a, b) => {
    if (a.self !== b.self) return a.self ? -1 : 1;
    return (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || '');
  });
  res.json({ conversations: convos });
});

// ── Groups ────────────────────────────────────────────────────────────────
router.get('/groups', (req, res) => {
  const mine = db.groups.find((g) => g.memberIds.includes(req.user.id));
  const withMeta = mine.map((g) => {
    const msgs = db.messages.find((m) => m.channelType === 'group' && m.channelKey === `group:${g.id}`)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = msgs[msgs.length - 1] || null;
    const unread = msgs.filter((m) => m.senderId !== req.user.id && !m.readBy?.includes(req.user.id)).length;
    return { ...g, channelKey: `group:${g.id}`, lastMessage: last ? decryptMessage(last) : null, unread };
  });
  withMeta.sort((a, b) => (b.lastMessage?.createdAt || b.createdAt).localeCompare(a.lastMessage?.createdAt || a.createdAt));
  res.json({ groups: withMeta });
});

router.post('/groups', (req, res) => {
  const name = (req.body?.name || '').trim();
  const memberIds = Array.isArray(req.body?.memberIds) ? [...new Set(req.body.memberIds)] : [];
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!memberIds.includes(req.user.id)) memberIds.push(req.user.id);
  if (memberIds.length < 2) return res.status(400).json({ error: 'pick at least one other member' });
  const group = { id: `grp_${nanoid(8)}`, name, memberIds, createdBy: req.user.id, createdAt: new Date().toISOString() };
  db.groups.insert(group);
  memberIds.filter((id) => id !== req.user.id).forEach((id) => {
    notify(id, {
      type: 'chat',
      title: `👥 เพิ่มเข้ากลุ่มแชต: ${name}`,
      body: `โดย ${req.user.name}`,
      meta: { channelKey: `group:${group.id}` },
    });
  });
  res.status(201).json({ group: { ...group, channelKey: `group:${group.id}` } });
});

// Get messages for a channel (dm channelKey, or group:<id>)
router.get('/messages', (req, res) => {
  const { channelKey } = req.query;
  if (!channelKey) return res.status(400).json({ error: 'channelKey required' });
  if (channelKey.startsWith('group:')) {
    const group = db.groups.byId(channelKey.slice('group:'.length));
    if (!group || !group.memberIds.includes(req.user.id))
      return res.status(403).json({ error: 'not a member of this group' });
  } else if (!canAccessDmChannel(req.user.id, channelKey)) {
    return res.status(403).json({ error: 'not a participant in this conversation' });
  }
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
  res.json({ messages: msgs.map(decryptMessage) });
});

// Send a message via REST (socket path also exists for live delivery)
router.post('/messages', (req, res) => {
  const { channelType = 'dm', channelKey, body, taskId, attachment, to } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });
  let ck = channelKey;
  if (channelType === 'dm' && to) {
    const target = db.users.byId(to);
    if (!target || target.disabled) return res.status(400).json({ error: 'recipient unavailable' });
    ck = dmChannelKey(req.user.id, target.id);
  }
  if (!ck) return res.status(400).json({ error: 'channelKey or to required' });
  if (channelType === 'dm' && !canAccessDmChannel(req.user.id, ck)) {
    return res.status(403).json({ error: 'not a participant in this conversation' });
  } else if (channelType === 'group') {
    const group = db.groups.byId(ck.slice('group:'.length));
    if (!group || !group.memberIds.includes(req.user.id))
      return res.status(403).json({ error: 'not a member of this group' });
  } else if (!['dm', 'group'].includes(channelType)) {
    return res.status(400).json({ error: 'invalid channel type' });
  }

  let safeAttachment = null;
  try {
    safeAttachment = validateChatAttachment(attachment, config.chatAttachmentMaxBytes);
  } catch (error) {
    return res.status(400).json({ error: error.message, code: 'INVALID_ATTACHMENT' });
  }

  const msg = saveMessage({
    senderId: req.user.id,
    channelType,
    channelKey: ck,
    body: body.trim(),
    taskId: taskId || null,
    attachment: safeAttachment,
  });
  emitMessage(msg);

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
  } else if (channelType === 'group') {
    const group = db.groups.byId(ck.slice('group:'.length));
    group?.memberIds.filter((id) => id !== req.user.id).forEach((id) => {
      const member = db.users.byId(id);
      if (member && !member.online) {
        notify(id, {
          type: 'chat',
          title: `💬 ${req.user.name} ส่งข้อความในกลุ่ม "${group.name}"`,
          body: body.slice(0, 80),
          meta: { channelKey: ck },
        });
      }
    });
  }
  res.status(201).json({ message: msg });
});

// Unsend — sender only, silently removed for everyone, within 24h of sending
router.delete('/messages/:id', (req, res) => {
  const removed = deleteMessage(req.params.id, req.user.id);
  if (!removed) return res.status(403).json({ error: 'ลบได้เฉพาะข้อความของตัวเองภายใน 24 ชม.' });
  emitDeleted(removed);
  res.json({ ok: true });
});

export default router;
