import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import api from '../api/client.js';
import { Modal, ModalHeader } from './ui.jsx';

// Edit a brand/project's details: name, client, description, logo, media links.
export default function ProjectModal({ open, project, users, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [links, setLinks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pms = users.filter((u) => u.role === 'pm' || u.role === 'admin');

  useEffect(() => {
    if (open && project) {
      setForm({
        brand: project.brand || '',
        name: project.name || '',
        clientEmail: project.clientEmail || '',
        description: project.description || '',
        logoUrl: project.logoUrl || '',
        pmId: project.pmId || pms[0]?.id || '',
      });
      setLinks(project.links?.length ? project.links : []);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  if (!open || !form) return null;

  const setLink = (i, patch) => setLinks((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLink = () => setLinks((p) => [...p, { label: '', url: '' }]);
  const removeLink = (i) => setLinks((p) => p.filter((_, idx) => idx !== i));

  const save = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { project: updated } = await api.updateProject(project.id, {
        ...form,
        links: links.filter((l) => l.label || l.url),
      });
      onSaved?.(updated);
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <ModalHeader title="รายละเอียดแบรนด์ / โปรเจกต์" icon={<Pencil size={17} className="text-blue-600" />} onClose={onClose} />
      <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        {/* logo preview + url */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
            {form.logoUrl ? <img src={form.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <ImageIcon size={22} className="text-gray-300" />}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 mb-1">โลโก้ (URL รูป)</label>
            <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://…/logo.png" className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-bold text-gray-600 mb-1">Brand</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-bold text-gray-600 mb-1">ชื่อแคมเปญ</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm" /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-bold text-gray-600 mb-1">อีเมลลูกค้า</label><input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">PM ที่ดูแล</label>
            <select value={form.pmId} onChange={(e) => setForm({ ...form, pmId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
              {pms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">คำอธิบายแบรนด์</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="โทนแบรนด์, กลุ่มเป้าหมาย, ข้อกำหนด ฯลฯ" />
        </div>

        {/* media / page links */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-gray-600 flex items-center gap-1"><LinkIcon size={13} /> ลิงก์เพจ / สื่อ</label>
            <button type="button" onClick={addLink} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> เพิ่มลิงก์</button>
          </div>
          <div className="space-y-2">
            {links.length === 0 && <p className="text-[11px] text-gray-400">ยังไม่มีลิงก์ (เช่น Facebook Page, IG, Drive, เว็บไซต์)</p>}
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="ชื่อ (เช่น FB Page)" className="w-32 p-1.5 border border-gray-300 rounded text-xs" />
                <input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://…" className="flex-1 p-1.5 border border-gray-300 rounded text-xs" />
                <button type="button" onClick={() => removeLink(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">ยกเลิก</button>
          <button type="submit" disabled={busy} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
