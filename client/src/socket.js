import { io } from 'socket.io-client';
import { getToken } from './api/client.js';

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;
  socket = io('/', {
    auth: { token: getToken() },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
