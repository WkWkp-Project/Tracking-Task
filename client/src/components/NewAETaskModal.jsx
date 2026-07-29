import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client.js';
import { Modal, ModalHeader } from './ui.jsx';
import { AE_PRIORITY, AE_STATUS, AE_MANHOUR } from '../utils.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const estFromManHour = (mh) => (mh === '<0.5' ? 0.5 : Number(mh) || 0);
const KNOWN_PROJECTS = ['AE work', 'New client', 'Falcon', 'Thychef', 'Kirin', 'Tulip', 'Debic'];

export default function NewAETaskModal({ open, onClose, users, presetInChargeId, existingProjects = [], onCreated }) {
  const aePeople = users.filter((u) => u.role === 'ae');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        workDetails: '',
        project: 'AE work',
        inChargeId: presetInChargeId || aePeople[0]?.id || '',
        priority: 'daily',
        status: 'not_started',
        assignDate: todayStr(),
        startDate: todayStr(),
        dueDate: plus(3),
        manHour: '<0.5',
        estWorkday: 0.5,
        notes: '',
      });
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetInChargeId]);

  if (!open || !form) return null;

  const setManHour = (mh) => setForm((f) => ({ ...f, manHour: mh, estWorkday: estFromManHour(mh) }));
  const projectOptions = [...new Set([...KNOWN_PROJECTS, ...existingProjects])];

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { task } = await api.createAeTask({ ...form, estWorkday: Number(form.estWorkday) || 0 });
      onCreated?.(task);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" z="z-[60]">
      <ModalHeader title="สร้างงาน AE ใหม่" icon={<Plus size={18} className="text-blue-600" />} onClose={onClose} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">รายละเอียดงาน</label>
          <input
            value={form.workDetails} onChange={(e) => setForm({ ...form, workDetails: e.target.value })} required
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold"
            placeholder="เช่น Tipco Budget breakdown ratecard"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1">In charge (AE)</label>
            <select value={form.inChargeId} onChange={(e) => setForm({ ...form, inChargeId: e.target.value })} required
              className="w-full p-2 border border-gray-300 rounded-lg text-sm">
              <option value="">เลือก…</option>
              {aePeople.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-indigo-600 uppercase mb-1">Project</label>
            <input list="ae-new-projects" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="เช่น Falcon" />
            <datalist id="ae-new-projects">{projectOptions.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Assign date</label>
            <input type="date" value={form.assignDate} onChange={(e) => setForm({ ...form, assignDate: e.target.value })} required
              className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Start date</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required
              className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Due date</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required
              className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm">
              {AE_PRIORITY.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm">
              {AE_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Man Hour</label>
            <select value={form.manHour} onChange={(e) => setManHour(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm">
              {AE_MANHOUR.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Est. Workday</label>
            <input type="number" step="0.5" min="0" value={form.estWorkday} onChange={(e) => setForm({ ...form, estWorkday: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm resize-none" placeholder="หมายเหตุ (ถ้ามี)" />
        </div>

        <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">ยกเลิก</button>
          <button type="submit" disabled={busy || !form.inChargeId} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 shadow-sm">
            {busy ? 'กำลังสร้าง…' : 'สร้างงาน'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
