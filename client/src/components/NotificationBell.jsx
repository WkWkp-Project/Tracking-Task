import React, { useEffect, useRef, useState } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import api from '../api/client.js';
import { getSocket } from '../socket.js';
import { fmtTime } from '../utils.js';

const ICON = {
  critical: <AlertCircle size={16} className="text-red-500" />,
  warning: <AlertTriangle size={16} className="text-amber-500" />,
  info: <Info size={16} className="text-violet-500" />,
};

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { notifications, unread } = await api.notifications();
      setItems(notifications);
      setUnread(unread);
    } catch {}
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;
    const handler = (n) => {
      setItems((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    await api.readAllNotifications();
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const clickItem = async (n) => {
    if (!n.read) {
      await api.readNotification(n.id).catch(() => {});
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.meta?.taskId && onNavigate) onNavigate({ type: 'task', id: n.meta.taskId });
    if (n.meta?.channelKey && onNavigate) onNavigate({ type: 'chat', channelKey: n.meta.channelKey });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-bold text-sm text-gray-800">การแจ้งเตือน</span>
            <button onClick={markAll} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Check size={12} /> อ่านทั้งหมด
            </button>
          </div>
          <div className="overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">ยังไม่มีการแจ้งเตือน</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => clickItem(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex gap-3 ${n.read ? 'opacity-60' : 'bg-blue-50/40'}`}
                >
                  <div className="mt-0.5">{ICON[n.severity] || ICON.info}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{fmtTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
