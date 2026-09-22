import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, MessageSquare, Circle, Paperclip, Tag, Trash2, Users, Plus, Lock, NotebookPen, Bot, SmilePlus, Download, FileText, Film, Search } from 'lucide-react';
import api from '../api/client.js';
import { getSocket } from '../socket.js';
import { Avatar } from './ui.jsx';
import { fmtTime } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  directGifUrl,
  EMOJI_CATEGORIES,
  normalizeEmoticonsForDisplay,
  searchEmojiCategories,
} from '../chatFormatting.js';
import {
  attachmentCategory,
  CHAT_ATTACHMENT_ACCEPT,
  DEFAULT_CHAT_ATTACHMENT_MAX_BYTES,
  validateChatFile,
} from '../chatAttachments.js';

const UNSEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CHAT_FILE_BYTES =
  Number(import.meta.env?.VITE_CHAT_ATTACHMENT_MAX_BYTES) || DEFAULT_CHAT_ATTACHMENT_MAX_BYTES;
function dmKey(a, b) { return [a, b].sort().join('::'); }

function readChatFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('ไม่พบไฟล์'));
    if (file.size > MAX_CHAT_FILE_BYTES) return reject(new Error(`ไฟล์ต้องมีขนาดไม่เกิน ${Math.ceil(MAX_CHAT_FILE_BYTES / 1024 / 1024)} MB`));
    let metadata;
    try {
      metadata = validateChatFile(file, MAX_CHAT_FILE_BYTES);
    } catch (error) {
      return reject(error);
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ ...metadata, url: reader.result });
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState('recent');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const bottomRef = useRef(null);
  const textInputRef = useRef(null);

  const taskById = useMemo(() => Object.fromEntries(allTasks.map((t) => [t.id, t])), [allTasks]);
  const visibleEmojis = useMemo(
    () => searchEmojiCategories(emojiSearch, emojiCategory),
    [emojiCategory, emojiSearch]
  );
  const activeKey = () => (active?.type === 'group' ? active.group.channelKey : active ? dmKey(user.id, active.user.id) : null);
  const selfChatActive = active?.type === 'dm' && active.user.id === user.id;

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
    if ((!text.trim() && !pendingAttachment) || !active) return;
    const body = text.trim() || `ส่งไฟล์: ${pendingAttachment.name}`;
    const channelType = active.type === 'group' ? 'group' : 'dm';
    const channelKey = activeKey();
    const payload = { channelType, channelKey, body, taskId: pendingTaskId || null, attachment: pendingAttachment || null };
    // Snapshot the composer so we can restore it if delivery fails, instead of
    // clearing first and losing the message when the REST fallback rejects.
    const snapshot = { text, pendingTaskId, pendingAttachment };
    setText(''); setPendingTaskId(null); setPendingAttachment(null);
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('chat:send', payload, (ack) => {
        if (ack?.message) setMessages((prev) => (prev.some((m) => m.id === ack.message.id) ? prev : [...prev, ack.message]));
        else if (ack?.error) { setText(snapshot.text); setPendingTaskId(snapshot.pendingTaskId); setPendingAttachment(snapshot.pendingAttachment); alert(ack.error); }
      });
    } else {
      try {
        const { message } = await api.sendMessage({ ...payload, to: active.type === 'dm' ? active.user.id : undefined });
        setMessages((prev) => [...prev, message]);
      } catch (err) {
        setText(snapshot.text); setPendingTaskId(snapshot.pendingTaskId); setPendingAttachment(snapshot.pendingAttachment);
        alert(err.message || 'ส่งข้อความไม่สำเร็จ');
      }
    }
  };

  const canUnsend = (m) =>
    !m.system &&
    m.senderId === user.id &&
    Date.now() - new Date(m.createdAt).getTime() < UNSEND_WINDOW_MS;
  const unsend = async (id) => {
    if (!confirm('ยกเลิกข้อความนี้? จะถูกลบออกจากทุกคนแบบเงียบๆ')) return;
    try {
      await api.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) { alert(err.message); }
  };

  const attachFile = async (file) => {
    try {
      setPendingAttachment(await readChatFile(file));
    } catch (error) {
      alert(error.message);
    }
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
    <div className="fixed right-4 bottom-4 w-[560px] max-w-[calc(100vw-2rem)] h-[min(440px,calc(100vh-5.5rem))] min-h-[320px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 z-40 flex overflow-hidden max-sm:inset-0 max-sm:w-full max-sm:max-w-none max-sm:h-full max-sm:min-h-0 max-sm:rounded-none">
      {/* conversation list */}
      <div className="w-44 sm:w-48 border-r border-gray-100 dark:border-zinc-800 flex flex-col bg-gray-50 dark:bg-zinc-950">
        <div className="px-3 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
          <span className="font-bold text-sm text-gray-900 dark:text-zinc-100 flex items-center gap-1.5" title="ข้อความเข้ารหัสไว้ในระบบ">
            <MessageSquare size={16} className="text-blue-600" /> แชตทีม <Lock size={11} className="text-gray-300" />
          </span>
          <button onClick={() => setShowNewGroup((v) => !v)} title="สร้างกลุ่มแชต" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Plus size={16} /></button>
        </div>

        {showNewGroup && (
          <form onSubmit={createGroup} className="p-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="ชื่อกลุ่ม…" required
              className="w-full p-1.5 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-xs" />
            <div className="max-h-24 overflow-y-auto space-y-1">
              {users.filter((u) => u.id !== user.id).map((u) => (
                <label key={u.id} className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-zinc-300">
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
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white dark:hover:bg-zinc-800 text-left ${active?.type === 'group' && active.group.id === g.id ? 'bg-white dark:bg-zinc-800' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Users size={15} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">{g.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{g.lastMessage?.body || 'เริ่มแชตกลุ่ม'}</p>
                  </div>
                  {g.unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5">{g.unread}</span>}
                </button>
              ))}
            </>
          )}
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
            <Lock size={9} /> แชทส่วนตัว
          </p>
          {conversations.map((c) => (
            <button
              key={c.user.id}
              onClick={() => openChat(c.user)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white dark:hover:bg-zinc-800 text-left ${active?.type === 'dm' && active.user.id === c.user.id ? 'bg-white dark:bg-zinc-800' : ''}`}
            >
              {c.self ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <NotebookPen size={15} />
                </div>
              ) : (
                <div className="relative">
                  <Avatar user={c.user} size={32} />
                  <Circle size={9} className={`absolute -bottom-0.5 -right-0.5 ${c.user.online ? 'text-emerald-500 fill-emerald-500' : 'text-gray-300 fill-gray-300'}`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">{c.self ? 'บันทึกส่วนตัว' : c.user.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{c.lastMessage?.body || (c.self ? 'โน้ตและข้อความเตือนของฉัน' : 'เริ่มแชต')}</p>
              </div>
              {c.unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5">{c.unread}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* thread */}
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="font-bold text-sm text-gray-800 dark:text-zinc-100">
            {active?.type === 'group' ? active.group.name : selfChatActive ? 'บันทึกส่วนตัว' : active?.type === 'dm' ? active.user.name : 'เลือกคนเพื่อเริ่มแชต'}
          </span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-zinc-950">
          {!active ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">เลือกเพื่อนร่วมงานหรือกลุ่มทางซ้าย</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">{selfChatActive ? 'จดโน้ตส่วนตัวไว้ที่นี่ได้เลย' : 'ยังไม่มีข้อความ'}</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user.id && !m.system;
              const senderName = active.type === 'group' && !mine ? users.find((u) => u.id === m.senderId)?.name : null;
              const taggedTask = m.taskId ? taskById[m.taskId] : null;
              const gifUrl = directGifUrl(m.body);
              const attachmentKind = attachmentCategory(m.attachment);
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group relative max-w-[82%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 rounded-bl-sm'}`}>
                    {m.system && <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-amber-600"><Bot size={11} /> เตือนอัตโนมัติ</p>}
                    {senderName && <p className="text-[10px] font-bold text-indigo-500 mb-0.5">{senderName}</p>}
                    {taggedTask && (
                      <button onClick={() => onOpenTask?.(taggedTask.id)}
                        className={`flex items-center gap-1 text-[10px] font-bold mb-1 px-1.5 py-0.5 rounded ${mine ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'} hover:underline`}>
                        <Tag size={10} /> {taggedTask.title}
                      </button>
                    )}
                    <p className="whitespace-pre-wrap break-words">{normalizeEmoticonsForDisplay(m.body)}</p>
                    {gifUrl && (
                      <a href={gifUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-black/10 bg-black/5">
                        <img src={gifUrl} alt="GIF preview" loading="lazy" referrerPolicy="no-referrer" className="max-h-48 w-full object-contain" />
                      </a>
                    )}
                    {m.attachment && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-black/10 bg-black/5">
                        {attachmentKind === 'image' && (
                          <a href={m.attachment.url} target="_blank" rel="noreferrer" className="block">
                            <img src={m.attachment.url} alt={m.attachment.name || 'Image attachment'} loading="lazy" className="max-h-48 w-full object-contain" />
                          </a>
                        )}
                        {attachmentKind === 'video' && (
                          <video controls preload="metadata" className="max-h-48 w-full bg-black">
                            <source src={m.attachment.url} type={m.attachment.type} />
                          </video>
                        )}
                        <div className={`flex min-w-0 items-center gap-2 px-2 py-1.5 text-[10px] font-bold ${mine ? 'text-blue-100' : 'text-blue-600'}`}>
                          {attachmentKind === 'video' ? <Film size={12} /> : attachmentKind === 'image' ? <Paperclip size={12} /> : <FileText size={12} />}
                          <span className="min-w-0 flex-1 truncate">{m.attachment.name || 'attachment'}</span>
                          {attachmentKind !== 'archive' && (
                            <a href={m.attachment.url} target="_blank" rel="noreferrer" className="underline">เปิด</a>
                          )}
                          <a href={m.attachment.url} download={m.attachment.name || true} title="ดาวน์โหลด" aria-label={`ดาวน์โหลด ${m.attachment.name || 'ไฟล์'}`}>
                            <Download size={12} />
                          </a>
                        </div>
                      </div>
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
          <div className="border-t border-gray-100 dark:border-zinc-800">
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
                  className="w-full p-1.5 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-xs mb-1" />
                <div className="max-h-28 overflow-y-auto border border-gray-100 rounded">
                  {filteredTasks.map((t) => (
                    <button key={t.id} type="button" onClick={() => { setPendingTaskId(t.id); setShowTagPicker(false); setTaskFilter(''); }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 truncate">{t.title}</button>
                  ))}
                  {filteredTasks.length === 0 && <p className="text-[11px] text-gray-400 p-2">ไม่พบงาน</p>}
                </div>
              </div>
            )}
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-2 right-2 z-20 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800 sm:left-auto sm:right-3 sm:w-[340px]">
                <div
                  data-testid="emoji-picker"
                  className="flex max-h-[min(320px,calc(100vh-5rem))] min-w-0 max-w-full flex-col overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-gray-100 p-2 dark:border-zinc-700">
                    <Search size={14} className="shrink-0 text-gray-400" />
                    <input
                      value={emojiSearch}
                      onChange={(event) => setEmojiSearch(event.target.value)}
                      placeholder="ค้นหาหมวดอีโมจิ…"
                      aria-label="ค้นหาอีโมจิ"
                      className="min-w-0 flex-1 bg-transparent text-xs text-gray-800 outline-none dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-gray-100 px-1 py-1 dark:border-zinc-700" aria-label="หมวดอีโมจิ">
                    {EMOJI_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        title={category.label}
                        aria-label={`หมวด ${category.label}`}
                        onClick={() => { setEmojiCategory(category.id); setEmojiSearch(''); }}
                        className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg text-base ${emojiCategory === category.id && !emojiSearch ? 'bg-blue-100 dark:bg-blue-950' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                      >
                        {category.icon}
                      </button>
                    ))}
                  </div>
                  <div
                    className="grid min-h-20 flex-1 gap-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(2rem, 1fr))' }}
                  >
                    {visibleEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setText((current) => `${current}${emoji}`);
                          queueMicrotask(() => textInputRef.current?.focus());
                        }}
                        className="grid h-8 min-w-0 place-items-center rounded-lg text-lg hover:bg-blue-50 dark:hover:bg-zinc-700"
                        aria-label={`เพิ่มอีโมจิ ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    {visibleEmojis.length === 0 && (
                      <p className="col-span-full p-4 text-center text-xs text-gray-400">ไม่พบหมวดอีโมจิ</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={send} className="p-3 flex gap-2 items-center">
              <label title={`แนบไฟล์ (สูงสุด ${Math.ceil(MAX_CHAT_FILE_BYTES / 1024 / 1024)} MB)`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer">
                <Paperclip size={16} />
                <input type="file" accept={CHAT_ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) attachFile(file);
                  e.target.value = '';
                }} />
              </label>
              <button type="button" onClick={() => setShowTagPicker((v) => !v)} title="แท็กงาน" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full"><Tag size={16} /></button>
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker((value) => !value);
                  setShowTagPicker(false);
                }}
                title="เพิ่มอีโมจิ"
                aria-label="เปิดตัวเลือกอีโมจิ"
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
              >
                <SmilePlus size={16} />
              </button>
              <input
                ref={textInputRef}
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder={selfChatActive ? 'จดบันทึกส่วนตัว…' : 'พิมพ์ข้อความ…'}
                className="flex-1 min-w-0 px-3 py-2 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-full text-sm outline-none focus:border-blue-500"
              />
              <button type="submit" disabled={!text.trim() && !pendingAttachment} className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40"><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
