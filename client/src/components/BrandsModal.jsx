import React, { useState } from 'react';
import { Tag, Trash2, Pencil, Check, X as XIcon, Image as ImageIcon } from 'lucide-react';
import api from '../api/client.js';
import { Modal, ModalHeader } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function LogoThumb({ url, size = 32 }) {
  return (
    <div style={{ width: size, height: size }} className="rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={size * 0.5} className="text-gray-300" />}
    </div>
  );
}

export default function BrandsModal({ open, onClose, brands, onChanged }) {
  const { isAdmin } = useAuth();
  const [newName, setNewName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError(''); setBusy(true);
    try {
      await api.createBrand({ name, logoUrl: newLogoUrl.trim() || undefined });
      setNewName(''); setNewLogoUrl('');
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const startEdit = (b) => { setEditingId(b.id); setEditValue(b.name); setEditLogoUrl(b.logoUrl || ''); };
  const saveEdit = async (id) => {
    const name = editValue.trim();
    if (!name) return;
    try {
      await api.updateBrand(id, { name, logoUrl: editLogoUrl.trim() });
      setEditingId(null);
      await onChanged?.();
    } catch (err) { setError(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('ลบแบรนด์นี้? (โปรเจกต์/งานที่อ้างอิงชื่อนี้อยู่จะไม่ถูกลบ แต่จะไม่อยู่ในทะเบียนแบรนด์อีก)')) return;
    try {
      await api.deleteBrand(id);
      await onChanged?.();
    } catch (err) { alert(err.message); }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-md">
      <ModalHeader title="จัดการแบรนด์" icon={<Tag size={18} className="text-blue-600" />} onClose={onClose} />
      <div className="p-5 space-y-4 overflow-y-auto">
        <p className="text-xs text-gray-500 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-lg p-3">
          ทะเบียนแบรนด์กลาง — ใช้ชื่อเดียวกันทั้งฝั่ง PM (โปรเจกต์) และ AE (ตารางงาน) เพื่อให้ระบบรู้ว่าเป็นแบรนด์เดียวกัน
          โดยไม่ต้องแสดงงานภายในของอีกฝั่งให้เห็น
        </p>
        <p className="text-[10px] text-gray-400">พบ {brands.length} แบรนด์จากทะเบียน โปรเจกต์ PM และงาน AE</p>

        {isAdmin && (
          <form onSubmit={add} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-100 dark:border-zinc-700">
            <LogoThumb url={newLogoUrl} />
            <div className="flex-1 space-y-1.5">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อแบรนด์ใหม่…"
                className="w-full p-1.5 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm" />
              <input value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} placeholder="ลิงก์โลโก้ (URL รูป) — ไม่บังคับ"
                className="w-full p-1.5 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs" />
            </div>
            <button type="submit" disabled={busy || !newName.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shrink-0">เพิ่ม</button>
          </form>
        )}
        {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {brands.length === 0 && <p className="text-xs text-gray-400 text-center py-6">ยังไม่มีแบรนด์ในทะเบียน</p>}
          {brands.map((b) => (
            <div key={b.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              {editingId === b.id ? (
                <>
                  <LogoThumb url={editLogoUrl} />
                  <div className="flex-1 space-y-1.5">
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
                      className="w-full p-1.5 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-sm" />
                    <input value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} placeholder="ลิงก์โลโก้ (URL รูป)"
                      className="w-full p-1.5 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-xs" />
                  </div>
                  <button onClick={() => saveEdit(b.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={15} /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><XIcon size={15} /></button>
                </>
              ) : (
                <>
                  <LogoThumb url={b.logoUrl} />
                  <span className="flex-1 text-sm font-bold text-gray-800 dark:text-zinc-100 truncate self-center">{b.name}</span>
                  {isAdmin && (
                    <>
                      <button onClick={() => startEdit(b)} title="แก้ชื่อ/โลโก้" className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => remove(b.id)} title="ลบ" className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
