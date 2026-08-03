// Socket.io wiring: authenticated sockets join a private room per user
// (`user:<id>`) so we can push notifications & DMs to specific people.

import { Server } from 'socket.io';
import { verifyToken } from './auth/jwt.js';
import db from './db.js';
import { config } from './config.js';
import { canAccessDmChannel, dmChannelKey } from './services/chat.js';
import { encryptText, decryptText } from './services/crypto.js';
import { validateChatAttachment } from './services/chatAttachments.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
    maxHttpBufferSize: Math.ceil(config.chatAttachmentMaxBytes * 1.5) + 1024,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token && verifyToken(token);
    if (!payload) return next(new Error('unauthorized'));
    const user = db.users.byId(payload.sub);
    if (!user || user.disabled) return next(new Error('unauthorized'));
    socket.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    db.users.update(socket.userId, { online: true, lastSeen: new Date().toISOString() });
    broadcastPresence();

    // Real-time chat send (also persisted)
    socket.on('chat:send', ({ channelType, channelKey, body, taskId, attachment } = {}, ack) => {
      if (!body || !body.trim()) return ack?.({ error: 'empty' });
      const resolvedChannelType = channelType || 'dm';
      if (resolvedChannelType === 'dm' && !canAccessDmChannel(socket.userId, channelKey))
        return ack?.({ error: 'not allowed' });
      if (resolvedChannelType === 'group') {
        const group = db.groups.byId(String(channelKey || '').replace('group:', ''));
        if (!group?.memberIds.includes(socket.userId)) return ack?.({ error: 'not allowed' });
      }
      if (!['dm', 'group'].includes(resolvedChannelType)) return ack?.({ error: 'invalid channel' });
      let safeAttachment = null;
      try {
        safeAttachment = validateChatAttachment(attachment, config.chatAttachmentMaxBytes);
      } catch (error) {
        return ack?.({ error: error.message });
      }
      const msg = saveMessage({
        senderId: socket.userId,
        channelType: resolvedChannelType,
        channelKey,
        body: body.trim(),
        taskId: taskId || null,
        attachment: safeAttachment,
      });
      emitMessage(msg);
      ack?.({ ok: true, message: msg });
    });

    // Sender unsends a message (24h window enforced by the REST route which
    // emits this same event — exposed here too for socket-only callers)
    socket.on('chat:delete', ({ id } = {}, ack) => {
      const removed = deleteMessage(id, socket.userId);
      if (removed) { emitDeleted(removed); ack?.({ ok: true }); }
      else ack?.({ error: 'not allowed' });
    });

    socket.on('chat:typing', ({ channelKey, to } = {}) => {
      if (to && canAccessDmChannel(socket.userId, channelKey)) {
        const members = String(channelKey).split('::');
        if (members.includes(to))
          io.to(`user:${to}`).emit('chat:typing', { channelKey, from: socket.userId });
      }
    });

    socket.on('disconnect', () => {
      db.users.update(socket.userId, { online: false, lastSeen: new Date().toISOString() });
      broadcastPresence();
    });
  });

  return io;
}

// Body is encrypted before it touches disk (see services/crypto.js) — the
// returned/emitted object carries the plaintext for immediate delivery.
export function saveMessage({
  senderId,
  channelType,
  channelKey,
  body,
  taskId,
  attachment,
  system = false,
  markSenderRead = true,
}) {
  const record = {
    id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    senderId,
    channelType,
    channelKey,
    taskId: taskId || null,
    attachment: attachment || null,
    system: Boolean(system),
    bodyEnc: encryptText(body),
    createdAt: new Date().toISOString(),
    readBy: markSenderRead ? [senderId] : [],
  };
  db.messages.insert(record);
  const { bodyEnc, ...rest } = record;
  return { ...rest, body };
}

// Turn a stored (encrypted) record into the plaintext shape sent to clients.
// Messages saved before encryption shipped still have a plain `body` — pass
// those through as-is instead of trying to decrypt a field that isn't there.
export function decryptMessage(record) {
  const { bodyEnc, ...rest } = record;
  if (!bodyEnc) return rest;
  return { ...rest, body: decryptText(bodyEnc) };
}

function groupMemberIds(channelKey) {
  const group = db.groups.byId(channelKey.replace('group:', ''));
  return group?.memberIds || [];
}

// Push a chat message to the right recipients
export function emitMessage(msg) {
  if (!io) return;
  if (msg.channelType === 'dm') {
    const [a, b] = msg.channelKey.split('::');
    io.to(`user:${a}`).to(`user:${b}`).emit('chat:message', msg);
  } else if (msg.channelType === 'group') {
    io.to(groupMemberIds(msg.channelKey).map((uid) => `user:${uid}`)).emit('chat:message', msg);
  } else {
    // task/project channel -> notify everyone connected (clients filter by channelKey)
    io.emit('chat:message', msg);
  }
}

const UNSEND_WINDOW_MS = 24 * 60 * 60 * 1000;

// Sender-only, silent hard delete — only within 24h of sending.
// Returns the removed record (for targeted socket emit) or null if not allowed.
export function deleteMessage(id, requesterId) {
  const msg = db.messages.byId(id);
  if (!msg || msg.system || msg.senderId !== requesterId) return null;
  if (Date.now() - new Date(msg.createdAt).getTime() > UNSEND_WINDOW_MS) return null;
  db.messages.remove(id);
  return msg;
}

export function emitDeleted(msg) {
  if (!io) return;
  const payload = { id: msg.id, channelKey: msg.channelKey };
  if (msg.channelType === 'dm') {
    const [a, b] = msg.channelKey.split('::');
    io.to(`user:${a}`).to(`user:${b}`).emit('chat:deleted', payload);
  } else if (msg.channelType === 'group') {
    io.to(groupMemberIds(msg.channelKey).map((uid) => `user:${uid}`)).emit('chat:deleted', payload);
  } else {
    io.emit('chat:deleted', payload);
  }
}

export function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

function broadcastPresence() {
  if (!io) return;
  const presence = db.users.all().map((u) => ({ id: u.id, online: !!u.online }));
  io.emit('presence', presence);
}

export { dmChannelKey };
export default { initRealtime, emitToUser, emitMessage };
