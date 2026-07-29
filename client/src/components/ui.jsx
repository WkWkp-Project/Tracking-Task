import React from 'react';
import { X } from 'lucide-react';
import { initials, riskStyle } from '../utils.js';

export function Avatar({ user, size = 28, title }) {
  const s = { width: size, height: size, fontSize: size * 0.4 };
  if (user?.avatarUrl)
    return <img src={user.avatarUrl} alt={user.name} title={title || user?.name} style={s} className="rounded-full object-cover border border-white" />;
  return (
    <div
      title={title || user?.name}
      style={{ ...s, background: user?.avatarColor || '#94a3b8' }}
      className="rounded-full flex items-center justify-center text-white font-bold border border-white shrink-0"
    >
      {initials(user?.name)}
    </div>
  );
}

export function RiskBadge({ level, children }) {
  const st = riskStyle(level);
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${st.chip}`}>
      {children || st.label}
    </span>
  );
}

export function Modal({ open, onClose, children, width = 'max-w-lg', z = 'z-50' }) {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm ${z} flex items-center justify-center p-4`} onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, icon, onClose }) {
  return (
    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
      <h2 className="font-bold text-gray-900 flex items-center gap-2">{icon}{title}</h2>
      <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full"><X size={18} /></button>
    </div>
  );
}

export function Spinner({ label = 'กำลังโหลด…' }) {
  return <div className="p-8 text-center text-gray-400 text-sm">{label}</div>;
}
