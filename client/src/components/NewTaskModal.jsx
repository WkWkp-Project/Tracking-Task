import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Clock, Trash2, AlertTriangle, AlertCircle, CheckCircle, CalendarDays } from 'lucide-react';
import api from '../api/client.js';
import { Modal, ModalHeader } from './ui.jsx';
import { riskStyle } from '../utils.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const STD_DAY = 8; // 1 วัน = 8 ชม. (ใช้แปลงวัน -> ชั่วโมง effort)
const effort = (d) => (Number(d.estDays) || 0) * STD_DAY + (Number(d.estHours) || 0);

export default function NewTaskModal({ open, onClose, project, users, currentUser, onCreated }) {
  const pms = users.filter((u) => u.role === 'pm' || u.role === 'admin');
  const assignees = users.filter((u) => !['pm', 'admin', 'ae'].includes(u.role) && !u.disabled);

  const [form, setForm] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        title: '',
        description: '',
        pmId: project?.pmId || pms[0]?.id || currentUser.id,
        assigneeId: assignees[0]?.id || '',
        startDate: todayStr(),
        endDate: plus(7),
        priority: 'normal',
        syncCalendar: false,
      });
      setDrafts([
        { step: 'Draft 1', estDays: 1, estHours: 0 },
        { step: 'Draft 2', estDays: 0, estHours: 4 },
        { step: 'Final', estDays: 0, estHours: 4 },
      ]);
      setPreview(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalHours = useMemo(() => drafts.reduce((s, d) => s + effort(d), 0), [drafts]);

  // live conflict check (debounced)
  useEffect(() => {
    if (!open || !form?.assigneeId || !form?.startDate || !form?.endDate || totalHours <= 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.conflictCheck({
          assigneeId: form.assigneeId,
          startDate: form.startDate,
          endDate: form.endDate,
          estimatedHours: totalHours,
          title: form.title,
        });
        setPreview(res);
      } catch { setPreview(null); }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form?.assigneeId, form?.startDate, form?.endDate, totalHours]);

  if (!open || !form) return null;

  const setDraft = (i, patch) => setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const addDraft = () => setDrafts((p) => [...p, { step: `Draft ${p.length + 1}`, estDays: 0, estHours: 2 }]);
  const removeDraft = (i) => setDrafts((p) => p.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (!project?.id) throw new Error('ไม่พบโปรเจกต์ปลายทาง กรุณาปิดหน้าต่างและเลือกโปรเจกต์ใหม่');
      const { task, calendarWarning } = await api.createTask({
        projectId: project.id,
        ...form,
        drafts: drafts.map((d) => ({ step: d.step, estDays: Number(d.estDays) || 0, estHours: Number(d.estHours) || 0, dueDate: d.dueDate || null })),
      });
      onCreated?.(task, calendarWarning);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const risk = preview?.risk;
  const conflict = preview?.conflict;
  // headline should reflect capacity conflict too — a task can finish "on time"
  // yet still push the person over capacity on shared days.
  const displayLevel = conflict?.hasConflict && (risk?.level === 'Low' || risk?.level === 'Medium')
    ? 'High' : risk?.level;
  const rs = risk ? riskStyle(displayLevel) : null;

  return (
    <Modal open={open} onClose={onClose} width="max-w-4xl" z="z-[60]">
      <ModalHeader title="สร้างงานใหม่" icon={<Plus size={18} className="text-blue-600" />} onClose={onClose} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto">
        <div className="mx-6 mt-5 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">โปรเจกต์ปลายทาง</p>
            <p className="text-sm font-black text-blue-900 dark:text-blue-100 mt-0.5 truncate">{project?.brand || '—'} · {project?.name || '—'}</p>
            <p className="text-[10px] text-blue-600/80 dark:text-blue-300/80 mt-1">งานและไฟล์ทั้งหมดจะถูกบันทึกภายใต้โปรเจกต์นี้เท่านั้น</p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 text-[9px] font-bold text-blue-600 dark:text-blue-300">ล็อกโปรเจกต์แล้ว</span>
        </div>
        <div className="grid grid-cols-3 gap-0">
          {/* left: form */}
          <div className="col-span-2 p-6 space-y-4 border-r border-gray-100">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">ชื่องาน</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold" placeholder="เช่น Key Visual Concept" />
            </div>

            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1">PM (คนดูโปรเจกต์)</label>
                <select value={form.pmId} onChange={(e) => setForm({ ...form, pmId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  {pms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-600 uppercase mb-1">ผู้ทำงาน (Creative/Content)</label>
                <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">เลือก…</option>
                  {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">เริ่ม</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">กำหนดส่ง</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ความสำคัญ</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  <option value="low">ต่ำ</option>
                  <option value="normal">ปกติ</option>
                  <option value="high">สูง</option>
                </select>
              </div>
            </div>

            {/* drafts allocation */}
            <div className="p-3 border border-blue-200 bg-blue-50/40 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-blue-800 flex items-center gap-1"><Clock size={14} /> แบ่งเวลาต่อดราฟ (วัน + ชม.)</h3>
                <span className="text-xs font-bold text-blue-700">รวม {totalHours} ชม.</span>
              </div>
              <div className="grid grid-cols-[1fr_56px_56px_120px_24px] gap-2 mb-1 px-0.5 text-[10px] font-bold text-gray-400">
                <span>ชื่อดราฟ</span><span className="text-center">วัน</span><span className="text-center">ชม.</span><span>กำหนดส่ง</span><span></span>
              </div>
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <div key={i} className="grid grid-cols-[1fr_56px_56px_120px_24px] gap-2 items-center">
                    <input value={d.step} onChange={(e) => setDraft(i, { step: e.target.value })} className="p-1.5 border border-gray-300 rounded text-xs" placeholder="ชื่อดราฟ" />
                    <input type="number" min="0" value={d.estDays} onChange={(e) => setDraft(i, { estDays: e.target.value })} className="p-1.5 border border-gray-300 rounded text-xs text-center" title="วัน (1 วัน = 8 ชม.)" />
                    <input type="number" min="0" value={d.estHours} onChange={(e) => setDraft(i, { estHours: e.target.value })} className="p-1.5 border border-gray-300 rounded text-xs text-center" title="ชั่วโมงเพิ่ม" />
                    <input type="date" value={d.dueDate || ''} onChange={(e) => setDraft(i, { dueDate: e.target.value })} className="p-1.5 border border-gray-300 rounded text-xs" />
                    <button type="button" onClick={() => removeDraft(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    {(Number(d.estDays) > 0) && (
                      <span className="col-span-5 text-[10px] text-blue-600 -mt-1 pl-0.5">= {effort(d)} ชม. ({d.estDays} วัน × 8 + {d.estHours || 0} ชม.)</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">* 1 วัน = 8 ชม. — ใส่ได้ทั้งวันและชั่วโมง เช่น 1 วัน + 7 ชม. = 15 ชม.</p>
              <button type="button" onClick={addDraft} className="mt-2 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> เพิ่มดราฟ</button>
            </div>

            <label className="flex items-center gap-3 p-2.5 border border-gray-200 bg-gray-50 rounded-lg cursor-pointer">
              <input type="checkbox" checked={form.syncCalendar} onChange={(e) => setForm({ ...form, syncCalendar: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm font-bold text-gray-800 flex items-center gap-1"><CalendarDays size={14} /> Sync เข้า Google Calendar</span>
            </label>
          </div>

          {/* right: live risk/conflict preview */}
          <div className="p-5 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">การประเมินความเสี่ยง (สด)</h3>
            {!preview || !risk || !conflict ? (
              <p className="text-xs text-gray-400">เลือกผู้ทำงาน + วันที่ + ชั่วโมง เพื่อดูการวิเคราะห์</p>
            ) : (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${rs.chip} border-current/20`}>
                  <div className="flex items-center gap-2">
                    {displayLevel === 'Critical' ? <AlertCircle size={18} /> : displayLevel === 'Low' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    <span className="font-bold text-sm">{rs.label}{conflict.hasConflict ? ' · งานชน' : ''}</span>
                  </div>
                  <p className="text-xs mt-1">โอกาสเสร็จทันงานนี้ <b>{Math.round(risk.onTimeProbability * 100)}%</b></p>
                  {conflict.hasConflict && (
                    <p className="text-xs mt-0.5 font-bold">⚠️ ทำให้ {preview.assignee?.name?.split(' ')[0]} เกิน capacity {conflict.overloadedDays.length} วัน</p>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-3 text-xs space-y-1.5">
                  <Row label="Capacity ว่างสำหรับงานนี้" value={`${risk.availableHoursForTask} ชม.`} />
                  <Row label="ต้องใช้ (PERT)" value={`${risk.expectedRemainingHours} ชม.`} />
                  <Row label="โหลดสูงสุด/วัน" value={`${conflict.peakUtilization}×`} danger={conflict.peakUtilization > 1} />
                  <Row label="วันที่เกิน capacity" value={`${conflict.overloadedDays.length} วัน`} danger={conflict.overloadedDays.length > 0} />
                </div>

                {conflict.overlapsWith.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-amber-800 mb-1">⚠️ งานชนกับ:</p>
                    <ul className="text-[11px] text-amber-700 list-disc list-inside">
                      {conflict.overlapsWith.map((o) => <li key={o.taskId}>{o.title} ({o.sharedDays} วัน)</li>)}
                    </ul>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <p className="text-[11px] font-bold text-gray-600 mb-1">คำแนะนำ</p>
                  <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                    {risk.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white sticky bottom-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">ยกเลิก</button>
          <button type="submit" disabled={busy || !form.assigneeId || !project?.id} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 shadow-sm">
            {busy ? 'กำลังสร้าง…' : 'สร้างงาน'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value, danger }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-bold ${danger ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}
