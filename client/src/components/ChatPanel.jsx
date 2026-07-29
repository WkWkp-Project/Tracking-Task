import React, { useEffect, useRef, useState } from 'react';
import { Send, X, MessageSquare, Circle } from 'lucide-react';
import api from '../api/client.js';
import { getSocket } from '../socket.js';
import { Avatar } from './ui.jsx';
import { fmtTime } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';

// channelKey for a DM is the two user ids sorted and joined by '::'
function dmKey(a, b) { return [a, b].sort().join('::'); }

export default function ChatPanel({ open, onClose, presetUserId }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null); // other user object
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  const loadConvos = async () => {
    try {
      const { conversations } = await api.conversations();
      setConversations(conversations);
      return conversations;
    } catch { return []; }
  };

  useEffect(() => { if (open) loadConvos(); }, [open]);

  useEffect(() => {
    if (open && presetUserId) {
      loadConvos().then((cs) => {
        const c = cs.find((x) => x.user.id === presetUserId);
        if (c) openChat(c.user);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUserId]);

  const openChat = async (other) => {
    setActive(other);
    const key = dmKey(user.id, other.id);
    const { messages } = await api.messages(key);
    setMessages(messages);
    setConversations((prev) => prev.map((c) => (c.user.id === other.id ? { ...c, unread: 0 } : c)));
  };

  // live incoming messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg) => {
      if (msg.channelType !== 'dm') return;
      if (active && msg.channelKey === dmKey(user.id, active.id)) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } else {
        loadConvos();
      }
    };
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !active) return;
    const body = text.trim();
    setText('');
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('chat:send', { channelType: 'dm', channelKey: dmKey(user.id, active.id), body }, (ack) => {
        if (ack?.message) setMessages((prev) => (prev.some((m) => m.id === ack.message.id) ? prev : [...prev, ack.message]));
      });
    } else {
      const { message } = await api.sendMessage({ channelType: 'dm', to: active.id, body });
      setMessages((prev) => [...prev, message]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-0 right-6 w-[680px] h-[460px] bg-white rounded-t-xl shadow-2xl border border-gray-200 z-40 flex overflow-hidden">
      {/* conversation list */}
      <div className="w-60 border-r border-gray-100 flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
          <span className="font-bold text-sm flex items-center gap-2"><MessageSquare size={16} className="text-blue-600" /> แชตทีม</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.user.id}
              onClick={() => openChat(c.user)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white text-left ${active?.id === c.user.id ? 'bg-white' : ''}`}
            >
              <div className="relative">
                <Avatar user={c.user} size={32} />
                <Circle size={9} className={`absolute -bottom-0.5 -right-0.5 ${c.user.online ? 'text-emerald-500 fill-emerald-500' : 'text-gray-300 fill-gray-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{c.user.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{c.lastMessage?.body || 'เริ่มแชต'}</p>
              </div>
              {c.unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5">{c.unread}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* thread */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-sm text-gray-800">{active ? active.name : 'เลือกคนเพื่อเริ่มแชต'}</span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {!active ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">เลือกเพื่อนร่วมงานทางซ้าย</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">ยังไม่มีข้อความ</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[9px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>{fmtTime(m.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        {active && (
          <form onSubmit={send} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              value={text} onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์ข้อความ…"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm outline-none focus:border-blue-500"
            />
            <button type="submit" className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700"><Send size={16} /></button>
          </form>
        )}
      </div>
    </div>
  );
}
