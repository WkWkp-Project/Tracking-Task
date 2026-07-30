import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, MessageSquare, Circle, Paperclip, Tag, Trash2, Users, Plus, Lock } from 'lucide-react';
import api from '../api/client.js';
import { getSocket } from '../socket.js';
import { Avatar } from './ui.jsx';
import { fmtTime } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';

const UNSEND_WINDOW_MS = 24 * 60 * 60 * 1000;
function dmKey(a, b) { return [a, b].sort().join('::'); }

export default function ChatPanel({ open, onClose, presetUserId, users = [], onOpenTask }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null); // { type: 'dm', user } | { type: 'group', group }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [allTasks, setAllTasks] = useState([]);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [taskFilter, setTaskFilter] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const bottomRef = useRef(null);

  const taskById = useMemo(() => Object.fromEntries(allTasks.map((t) => [t.id, t])), [allTasks]);
  const activeKey = () => (active?.type === 'group' ? active.group.channelKey : active ? dmKey(user.id, active.user.id) : null);

  const loadLists = async () => {
    try {
      const [{ conversations }, { groups }] = await Promise.all([api.conversations(), api.groups()]);
      setConversations(conversations);
      setGroups(groups);
      return { conversations, groups };
    } catch { return { conversations: [], groups: [] }; }
  };

  useEffect(() => {
    if (open) {
      loadLists();
      api.tasks().then(({ tasks }) => setAllTasks(tasks)).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && presetUserId) {
      loadLists().then(({ conversations }) => {
        const c = conversations.find((x) => x.user.id === presetUserId);
        if (c) openChat(c.user);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUserId]);

  const openChat = async (other) => {
    setActive({ type: 'dm', user: other });
    const key = dmKey(user.id, other.id);
    const { messages } = await api.messages(key);
    setMessages(messages);
    setConversations((prev) => prev.map((c) => (c.user.id === other.id ? { ...c, unread: 0 } : c)));
  };

  const openGroup = async (g) => {
    setActive({ type: 'group', group: g });
    const { messages } = await api.messages(g.channelKey);
    setMessages(messages);
    setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, unread: 0 } : x)));
  };

  // live incoming messages / deletions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMessage = (msg) => {
      if (active && msg.channelKey === activeKey()) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } else {
        loadLists();
      }
    };
    const onDeleted = ({ id, channelKey }) => {
      if (active && channelKey === activeKey()) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    };
    socket.on('chat:message', onMessage);
    socket.on('chat:deleted', onDeleted);
    return () => { socket.off('chat:message', onMessage); socket.off('chat:deleted', onDeleted); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !active) return;
    const body = text.trim();
    const channelType = active.type === 'group' ? 'group' : 'dm';
    const channelKey = activeKey();
    const payload = { channelType, channelKey, body, taskId: pendingTaskId || null, attachment: pendingAttachment || null };
    setText(''); setPendingTaskId(null); setPendingAttachment(null);
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('chat:send', payload, (ack) => {
        if (ack?.message) setMessages((prev) => (prev.some((m) => m.id === ack.message.id) ? prev : [...prev, ack.message]));
      });
    } else {
      const { message } = await api.sendMessage({ ...payload, to: active.type === 'dm' ? active.user.id : undefined });
      setMessages((prev) => [...prev, message]);
    }
  };

  const canUnsend = (m) => m.senderId === user.id && Date.now() - new Date(m.createdAt).getTime() < UNSEND_WINDOW_MS;
  const unsend = async (id) => {
    if (!confirm('ยกเลิกข้อความนี้? จะถูกลบออกจากทุกคนแบบเงียบๆ')) return;
    try {
      await api.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) { alert(err.message); }
  };

  const attachLink = () => {
    const url = prompt('ใส่ลิงก์ไฟล์/เอกสาร (URL)');
    if (!url) return;
    const name = prompt('ชื่อไฟล์ที่จะแสดง', url) || url;
    setPendingAttachment({ name, url });
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || groupMemberIds.length === 0) return;
    try {
      const { group } = await api.createGroup({ name: groupName.trim(), memberIds: groupMemberIds });
      setShowNewGroup(false); setGroupName(''); setGroupMemberIds([]);
      await loadLists();
      openGroup(group);
    } catch (err) { alert(err.message); }
  };

  const filteredTasks = taskFilter
    ? allTasks.filter((t) => t.title.toLowerCase().includes(taskFilter.toLowerCase())).slice(0, 8)
    : allTasks.slice(0, 8);

  if (!open) return null;

  return (
    <div className="fixed bottom-0 right-6 w-[720px] h-[500px] bg-white rounded-t-xl shadow-2xl border border-gray-200 z-40 flex overflow-hidden">
      {/* conversation list */}
      <div className="w-60 border-r border-gray-100 flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
          <span className="font-bold text-sm flex items-center gap-1.5" title="ข้อความเข้ารหัสไว้ในระบบ">
            <MessageSquare size={16} className="text-blue-600" /> แชตทีม <Lock size={11} className="text-gray-300" />
          </span>
          <button onClick={() => setShowNewGroup((v) => !v)} title="สร้างกลุ่มแชต" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Plus size={16} /></button>
        </div>

        {showNewGroup && (
          <form onSubmit={createGroup} className="p-3 border-b border-gray-100 bg-white space-y-2">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="ชื่อกลุ่ม…" required
              className="w-full p-1.5 border border-gray-300 rounded text-xs" />
            <div className="max-h-24 overflow-y-auto space-y-1">
              {users.filter((u) => u.id !== user.id).map((u) => (
                <label key={u.id} className="flex items-center gap-1.5 text-[11px] text-gray-700">
                  <input type="checkbox" checked={groupMemberIds.includes(u.id)}
                    onChange={(e) => setGroupMemberIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))} />
                  {u.name}
                </label>
              ))}
            </div>
            <button type="submit" className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded">สร้างกลุ่ม</button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {groups.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase">กลุ่ม</p>
              {groups.map((g) => (
                <button key={g.id} onClick={() => openGroup(g)}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white text-left ${active?.type === 'group' && active.group.id === g.id ? 'bg-white' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Users size={15} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{g.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{g.lastMessage?.body || 'เริ่มแชตกลุ่ม'}</p>
                  </div>
                  {g.unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5">{g.unread}</span>}
                </button>
              ))}
            </>
          )}
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
            <Lock size={9} /> แชทส่วนตัว (1-ต่อ-1)
          </p>
          {conversations.map((c) => (
            <button
              key={c.user.id}
              onClick={() => openChat(c.user)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white text-left ${active?.type === 'dm' && active.user.id === c.user.id ? 'bg-white' : ''}`}
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
          <span className="font-bold text-sm text-gray-800">
            {active?.type === 'group' ? active.group.name : active?.type === 'dm' ? active.user.name : 'เลือกคนเพื่อเริ่มแชต'}
          </span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {!active ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">เลือกเพื่อนร่วมงานหรือกลุ่มทางซ้าย</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">ยังไม่มีข้อความ</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user.id;
              const senderName = active.type === 'group' && !mine ? users.find((u) => u.id === m.senderId)?.name : null;
              const taggedTask = m.taskId ? taskById[m.taskId] : null;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group relative max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                    {senderName && <p className="text-[10px] font-bold text-indigo-500 mb-0.5">{senderName}</p>}
                    {taggedTask && (
                      <button onClick={() => onOpenTask?.(taggedTask.id)}
                        className={`flex items-center gap-1 text-[10px] font-bold mb-1 px-1.5 py-0.5 rounded ${mine ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'} hover:underline`}>
                        <Tag size={10} /> {taggedTask.title}
                      </button>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    {m.attachment && (
                      <a href={m.attachment.url} target="_blank" rel="noreferrer"
                        className={`flex items-center gap-1 text-[11px] mt-1 underline ${mine ? 'text-blue-100' : 'text-blue-600'}`}>
                        <Paperclip size={10} /> {m.attachment.name}
                      </a>
                    )}
                    <p className={`text-[9px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>{fmtTime(m.createdAt)}</p>
                    {canUnsend(m) && (
                      <button onClick={() => unsend(m.id)} title="ยกเลิกข้อความ (ภายใน 24 ชม.)"
                        className={`absolute -top-2 ${mine ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-opacity`}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        {active && (
          <div className="border-t border-gray-100">
            {(pendingTaskId || pendingAttachment) && (
              <div className="px-3 pt-2 flex items-center gap-2 flex-wrap">
                {pendingTaskId && (
                  <span className="flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                    <Tag size={10} /> {taskById[pendingTaskId]?.title || '...'}
                    <button type="button" onClick={() => setPendingTaskId(null)}><X size={11} /></button>
                  </span>
                )}
                {pendingAttachment && (
                  <span className="flex items-center gap-1 text-[11px] font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    <Paperclip size={10} /> {pendingAttachment.name}
                    <button type="button" onClick={() => setPendingAttachment(null)}><X size={11} /></button>
                  </span>
                )}
              </div>
            )}
            {showTagPicker && (
              <div className="px-3 pt-2">
                <input value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} autoFocus placeholder="ค้นหางานที่จะแท็ก…"
                  className="w-full p-1.5 border border-gray-300 rounded text-xs mb-1" />
                <div className="max-h-28 overflow-y-auto border border-gray-100 rounded">
                  {filteredTasks.map((t) => (
                    <button key={t.id} type="button" onClick={() => { setPendingTaskId(t.id); setShowTagPicker(false); setTaskFilter(''); }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 truncate">{t.title}</button>
                  ))}
                  {filteredTasks.length === 0 && <p className="text-[11px] text-gray-400 p-2">ไม่พบงาน</p>}
                </div>
              </div>
            )}
            <form onSubmit={send} className="p-3 flex gap-2 items-center">
              <button type="button" onClick={attachLink} title="แนบลิงก์ไฟล์" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full"><Paperclip size={16} /></button>
              <button type="button" onClick={() => setShowTagPicker((v) => !v)} title="แท็กงาน" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full"><Tag size={16} /></button>
              <input
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder="พิมพ์ข้อความ…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm outline-none focus:border-blue-500"
              />
              <button type="submit" className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700"><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
