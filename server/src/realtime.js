// Socket.io wiring: authenticated sockets join a private room per user
// (`user:<id>`) so we can push notifications & DMs to specific people.

import { Server } from 'socket.io';
import { verifyToken } from './auth/jwt.js';
import db from './db.js';
import { config } from './config.js';
import { dmChannelKey } from './services/chat.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token && verifyToken(token);
    if (!payload) return next(new Error('unauthorized'));
    const user = db.users.byId(payload.sub);
    if (!user) return next(new Error('unauthorized'));
    socket.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    db.users.update(socket.userId, { online: true, lastSeen: new Date().toISOString() });
    broadcastPresence();

    // Real-time chat send (also persisted)
    socket.on('chat:send', ({ channelType, channelKey, body, taskId } = {}, ack) => {
      if (!body || !body.trim()) return ack?.({ error: 'empty' });
      const msg = saveMessage({
        senderId: socket.userId,
        channelType: channelType || 'dm',
        channelKey,
        body: body.trim(),
        taskId: taskId || null,
      });
      emitMessage(msg);
      ack?.({ ok: true, message: msg });
    });

    socket.on('chat:typing', ({ channelKey, to } = {}) => {
      if (to) io.to(`user:${to}`).emit('chat:typing', { channelKey, from: socket.userId });
    });

    socket.on('disconnect', () => {
      db.users.update(socket.userId, { online: false, lastSeen: new Date().toISOString() });
      broadcastPresence();
    });
  });

  return io;
}

export function saveMessage({ senderId, channelType, channelKey, body, taskId }) {
  const msg = {
    id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    senderId,
    channelType,
    channelKey,
    taskId: taskId || null,
    body,
    createdAt: new Date().toISOString(),
    readBy: [senderId],
  };
  return db.messages.insert(msg);
}

// Push a chat message to the right recipients
export function emitMessage(msg) {
  if (!io) return;
  if (msg.channelType === 'dm') {
    const [a, b] = msg.channelKey.split('::');
    io.to(`user:${a}`).to(`user:${b}`).emit('chat:message', msg);
  } else {
    // task/project channel -> notify everyone connected (clients filter by channelKey)
    io.emit('chat:message', msg);
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
