import React, { useEffect, useState } from 'react';
import {
  X, Clock, CheckCircle, CalendarDays, Mail, Send, Paperclip, Plus, FileText,
  Image as ImageIcon, Link as LinkIcon, MessageSquareText, PlaySquare, StickyNote,
  Trash2, AlertCircle, AlertTriangle, Gauge,
} from 'lucide-react';
import api from '../api/client.js';
import { Avatar, RiskBadge } from './ui.jsx';
import { riskStyle, daysLeftText, fmtDate } from '../utils.js';

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function uploadType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'pdf';
  return 'file';
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('ไม่พบไฟล์'));
    if (file.size > MAX_FILE_BYTES) return reject(new Error('ไฟล์ต้องมีขนาดไม่เกิน 3 MB'));
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: uploadType(file), mimeType: file.type || 'application/octet-stream', size: file.size, url: reader.result });
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

export default function TaskDrawer({ taskId, users, project, projects, googleStatus, onClose, onChanged, onOpenChat }) {
  const [task, setTask] = useState(null);
  const [tab, setTab] = useState('pipeline');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [schedule, setSchedule] = useState({ startDate: '', endDate: '' });
  const [scheduleMessage, setScheduleMessage] = useState('');

  const load = async () => {
    setError('');
    try {
      const { task } = await api.task(taskId);
      setTask(task);
    } catch (err) {
      setError(err.message || 'Unable to load task');
    }
  };
  useEffect(() => {
    setTask(null);
    if (taskId) load();
    /* eslint-disable-next-line */
  }, [taskId]);
  useEffect(() => {
    if (task) setSchedule({ startDate: task.startDate || '', endDate: task.endDate || '' });
  }, [task?.id, task?.startDate, task?.endDate]);

  if (!taskId) return null;
  if (!task && error) return (
    <div className="w-[560px] bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col items-center justify-center gap-3 p-8">
      <AlertCircle size={22} className="text-red-500" />
      <p role="alert" className="text-center text-sm text-red-600">{error}</p>
      <button onClick={load} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold">Retry</button>
    </div>
  );
  if (!task) return (
    <div className="w-[560px] bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex items-center justify-center text-gray-400">กำลังโหลด…</div>
  );

  const pm = users.find((u) => u.id === task.pmId);
  const assignee = users.find((u) => u.id === task.assigneeId);
  const taskProject = projects?.find((entry) => entry.id === task.projectId) || project;
  const risk = task.risk;
  const rs = riskStyle(risk?.level);
  const pmOptions = users.filter((u) => u.role === 'pm' || u.role === 'admin');
  const workerOptions = users.filter((u) => !['pm', 'admin', 'ae'].includes(u.role) && !u.disabled);
  const canManage = Boolean(task.workflow?.canManage);
  const statusOptions = [task.status, ...(task.workflow?.allowedTransitions || [])];

  const patchTask = async (patch) => {
    setBusy(true);
    setError('');
    try {
      const { task: t } = await api.updateTask(task.id, patch);
      setTask(t);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Unable to update task');
    }
    finally { setBusy(false); }
  };

  const saveSchedule = async () => {
    if (!schedule.startDate || !schedule.endDate) {
      setError('กรุณาระบุวันเริ่มและวันส่งให้ครบ');
      return;
    }
    if (schedule.startDate > schedule.endDate) {
      setError('วันเริ่มต้องไม่อยู่หลังวันส่ง');
      return;
    }
    setBusy(true);
    setError('');
    setScheduleMessage('');
    try {
      const result = await api.updateTask(task.id, schedule);
      setTask(result.task);
      const adjusted = result.scheduleAdjustments?.length || 0;
      setScheduleMessage(adjusted
        ? `บันทึกแล้ว และปรับกำหนดส่งของ ${adjusted} ขั้นตอนให้อยู่ในช่วงงาน`
        : 'บันทึกช่วงวันแล้ว — Timeline และ Workload อัปเดตเรียบร้อย');
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Unable to update schedule');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-[560px] bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col z-30 shrink-0">
      {/* header */}
      <div className="h-14 px-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-900 shrink-0">
        <span className="text-xs font-bold text-gray-800 dark:text-zinc-100 px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded">รายละเอียดงาน</span>
        <button onClick={onClose} aria-label="ปิดรายละเอียดงาน" className="p-1.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* overview */}
        <div className="p-5 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-2">{task.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <RiskBadge level={risk?.level} />
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${rs.chip}`}>{daysLeftText(risk?.calendarDaysLeft)}</span>
            {task.syncCalendar && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600 flex items-center gap-1"><CalendarDays size={11} /> Synced</span>}
          </div>

          {/* status */}
          <div className="mt-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase">สถานะ</label>
            <select value={task.status} onChange={(e) => patchTask({ status: e.target.value })} disabled={busy || statusOptions.length <= 1}
              className="ml-2 text-sm text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-2 py-1 font-bold">
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="ml-2 text-[10px] text-gray-400">Valid next steps only</span>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}

          {/* ownership (editable — reassign worker / PM) */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <EditOwner label="PM (ผู้ดู)" current={pm} options={pmOptions} disabled={busy}
              onChange={(id) => patchTask({ pmId: id })} onChat={pm ? () => onOpenChat(pm.id) : null} />
            <EditOwner label="ผู้ทำงาน (เปลี่ยน/ทดแทนได้)" current={assignee} options={workerOptions} disabled={busy}
              onChange={(id) => patchTask({ assigneeId: id })} onChat={assignee ? () => onOpenChat(assignee.id) : null} />
          </div>

          {/* hours + editable deadline */}
          <div className="mt-4 bg-gray-50 dark:bg-zinc-900 rounded-lg p-3 border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-zinc-300 flex items-center gap-1"><Clock size={14} /> ชั่วโมง</span>
              <span className={`font-bold ${task.loggedHours > task.estimatedHours ? 'text-red-600' : 'text-gray-800 dark:text-zinc-100'}`}>
                {task.loggedHours} / {task.estimatedHours} ชม.
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div className={`h-full ${task.loggedHours > task.estimatedHours ? 'bg-red-500' : 'bg-violet-500'}`}
                style={{ width: `${Math.min(100, (task.loggedHours / (task.estimatedHours || 1)) * 100)}%` }} />
            </div>
            <div className="flex items-end gap-2 mt-3 text-[11px] flex-wrap">
              <label className="text-gray-500">เริ่ม
                <input type="date" value={schedule.startDate} max={schedule.endDate || undefined} disabled={busy || !canManage} onChange={(e) => { setSchedule((current) => ({ ...current, startDate: e.target.value })); setScheduleMessage(''); }} className="block mt-1 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded px-1.5 py-1" />
              </label>
              <label className="text-gray-500">ส่ง
                <input type="date" value={schedule.endDate} min={schedule.startDate || undefined} disabled={busy || !canManage} onChange={(e) => { setSchedule((current) => ({ ...current, endDate: e.target.value })); setScheduleMessage(''); }} className="block mt-1 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded px-1.5 py-1" />
              </label>
              {canManage && (
                <button type="button" onClick={saveSchedule} disabled={busy || (schedule.startDate === task.startDate && schedule.endDate === task.endDate)} className="px-2.5 py-1.5 rounded bg-blue-600 text-white font-bold disabled:opacity-40">
                  บันทึกช่วงวัน
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">บันทึกวันเริ่มและวันส่งพร้อมกัน เพื่อคำนวณ Timeline, วันทำงาน และ Workload ใหม่อย่างสอดคล้องกัน</p>
            {scheduleMessage && <p role="status" className="text-[10px] font-bold text-emerald-600 mt-1">{scheduleMessage}</p>}
          </div>
        </div>

        {/* risk panel */}
        {risk && (
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-100 mb-2 flex items-center gap-2"><Gauge size={15} className="text-blue-600" /> วิเคราะห์ความเสี่ยง</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="โอกาสเสร็จทัน" value={`${Math.round(risk.onTimeProbability * 100)}%`} />
              <Stat label="ค่าความเสี่ยง (exposure)" value={risk.riskExposure} />
              <Stat label="capacity ว่าง" value={`${risk.availableHoursForTask} ชม.`} />
              <Stat label="งานค้างรวม" value={`${risk.expectedRemainingHours} ชม.`} />
              <Stat label="วันทำงานคงเหลือ" value={`${risk.workdaysLeft} วัน`} />
              <Stat label="capacity ต่อวัน" value={`${risk.capacityPerDay} ชม.`} />
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              เมตริกวันทำงาน: {risk.workweek?.label || 'Monday–Friday'} · เสาร์–อาทิตย์ไม่ใช้ capacity และไม่นับในวันทำงาน
            </p>

            {/* per-phase risk (deadline-first) */}
            {risk.phases?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">ความเสี่ยงรายเฟส (ยึดเดดไลน์)</p>
                <div className="space-y-1">
                  {risk.phases.map((p) => {
                    const pst = riskStyle(p.level);
                    return (
                      <div key={p.draftId} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-2 h-2 rounded-full ${pst.bar}`} />
                        <span className="font-bold text-gray-700 dark:text-zinc-200 w-20 truncate">{p.step}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${pst.chip}`}>{p.level === 'Done' ? 'เสร็จ' : pst.label}</span>
                        <span className="text-gray-400">
                          {p.level === 'Done' ? '' : `${p.daysLeft < 0 ? `เลย ${Math.abs(p.daysLeft)} วัน` : `เหลือ ${p.daysLeft} วัน`} · ค้าง ${p.remainingHours} ชม. · ส่ง ${fmtDate(p.dueDate)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <ul className="mt-3 space-y-1">
              {risk.recommendations.map((r, i) => (
                <li key={i} className="text-[11px] text-gray-600 dark:text-zinc-300 flex gap-1.5">
                  {risk.level === 'Critical' ? <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />}
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* tabs */}
        <div className="flex border-b border-gray-200 dark:border-zinc-800 px-5 sticky top-0 bg-white dark:bg-zinc-950 z-10">
          {[['pipeline', 'ดราฟ & ชั่วโมง'], ['briefs', 'ไฟล์/Brief'], ['client', 'อีเมลลูกค้า']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`py-2.5 px-3 text-sm font-bold border-b-2 ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>{l}</button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'pipeline' && <Pipeline task={task} phases={risk?.phases || []} canManage={canManage} onReload={() => { load(); onChanged?.(); }} />}
          {tab === 'briefs' && <Briefs task={task} onReload={load} />}
          {tab === 'client' && <ClientEmail task={task} project={taskProject} pm={pm} assignee={assignee} googleStatus={googleStatus} />}
        </div>
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex gap-2">
        <button onClick={() => { if (confirm('ลบงานนี้?')) api.deleteTask(task.id).then(() => { onChanged?.(); onClose(); }); }}
          className="px-3 py-2 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1">
          <Trash2 size={14} /> ลบงาน
        </button>
        <button onClick={() => task.syncCalendar ? api.calendarUnsync(task.id).then(load) : api.calendarSync(task.id).then(load).catch((e) => alert(e.message))}
          className="flex-1 px-3 py-2 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-1">
          <CalendarDays size={14} /> {task.syncCalendar ? 'ยกเลิก Calendar' : 'Sync Calendar'}
        </button>
      </div>
    </div>
  );
}

function EditOwner({ label, current, options, onChange, onChat, disabled }) {
  return (
    <div className="bg-gray-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold text-gray-500 uppercase">{label}</p>
        {onChat && <button onClick={onChat} className="text-[10px] text-blue-600 hover:underline">แชต</button>}
      </div>
      <div className="flex items-center gap-2">
        <Avatar user={current} size={24} />
        <select value={current?.id || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 text-xs font-bold text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded px-1.5 py-1 disabled:opacity-100">
          {!current && <option value="">—</option>}
          {options.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-2 border border-gray-100 dark:border-zinc-800">
      <p className="text-gray-500">{label}</p>
      <p className="font-bold text-gray-800 dark:text-zinc-100 text-sm">{value}</p>
    </div>
  );
}

function Pipeline({ task, phases, canManage, onReload }) {
  const [logging, setLogging] = useState(null); // draftId
  const [hours, setHours] = useState('');
  const [editing, setEditing] = useState(null); // draftId
  const [edit, setEdit] = useState({ step: '', estDays: 0, estHours: 0, dueDate: '' });
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ step: '', estDays: 0, estHours: 0, dueDate: '' });
  const [draftUpdates, setDraftUpdates] = useState([]);
  const [editError, setEditError] = useState('');

  const phaseFor = (draftId) => (phases || []).find((p) => p.draftId === draftId);
  useEffect(() => {
    api.taskUpdates(task.id).then(({ updates }) => setDraftUpdates(updates)).catch(() => setDraftUpdates([]));
  }, [task.id]);

  const log = async (draftId) => {
    const h = Number(hours);
    if (!h || h <= 0) return;
    await api.logHours(task.id, { draftId, hours: h });
    setHours(''); setLogging(null); onReload();
  };

  const setStatus = async (draftId, status) => { await api.updateDraft(task.id, draftId, { status }); onReload(); };
  const attachFile = async (draftId, file) => {
    try {
      const uploaded = await readFile(file);
      await api.updateDraft(task.id, draftId, {
        fileName: uploaded.name, fileType: uploaded.type, fileUrl: uploaded.url, status: 'In Progress',
      });
      onReload();
    } catch (error) {
      alert(error.message);
    }
  };
  const clearFile = async (draftId) => {
    await api.updateDraft(task.id, draftId, { fileName: null, fileType: null, fileUrl: null });
    onReload();
  };
  const startEdit = (d) => { setEditing(d.id); setEdit({ step: d.step || '', estDays: d.estDays || 0, estHours: d.estHours || 0, dueDate: d.dueDate || '' }); };
  const saveEdit = async (draftId) => {
    setEditError('');
    try {
      await api.updateDraft(task.id, draftId, {
        step: edit.step.trim() || 'Draft',
        estDays: Number(edit.estDays) || 0, estHours: Number(edit.estHours) || 0, dueDate: edit.dueDate || null,
      });
      setEditing(null); onReload();
    } catch (error) {
      setEditError(error.message || 'แก้ไขเวลาและกำหนดส่งไม่สำเร็จ');
    }
  };
  const addDraft = async () => {
    if (!newDraft.step.trim()) return;
    await api.addDraft(task.id, {
      step: newDraft.step.trim(),
      estDays: Number(newDraft.estDays) || 0,
      estHours: Number(newDraft.estHours) || 0,
      dueDate: newDraft.dueDate || null,
    });
    setNewDraft({ step: '', estDays: 0, estHours: 0, dueDate: '' });
    setAdding(false);
    onReload();
  };
  const removeDraft = async (draft) => {
    const logged = Number(draft.loggedHours) || 0;
    const message = logged > 0
      ? `ลบขั้นตอน "${draft.step}" พร้อมประวัติลงเวลา ${logged} ชั่วโมงใช่ไหม?`
      : `ลบขั้นตอน "${draft.step}" ใช่ไหม?`;
    if (!confirm(message)) return;
    await api.deleteDraft(task.id, draft.id);
    onReload();
  };
  const addDraftComment = async (draftId, body) => {
    const { update } = await api.addTaskUpdate(task.id, { type: 'comment', draftId, body });
    setDraftUpdates((current) => [update, ...current]);
  };
  const deleteDraftComment = async (entry) => {
    if (!confirm('ลบคอมเมนต์ลูกค้านี้ใช่ไหม?')) return;
    await api.deleteTaskUpdate(task.id, entry.id);
    setDraftUpdates((current) => current.filter((item) => item.id !== entry.id));
  };

  return (
    <div className="space-y-3 relative">
      {editError && <p role="alert" className="text-xs font-bold text-red-600">{editError}</p>}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div>
          <p className="text-xs font-bold text-gray-800 dark:text-zinc-100">ขั้นตอนการทำงาน</p>
          <p className="text-[10px] text-gray-400">{task.drafts.length} ขั้นตอน · เพิ่ม แก้ไข หรือลบได้</p>
        </div>
        <button onClick={() => setAdding((value) => !value)} disabled={!canManage} title={canManage ? '' : 'Only the task PM can change workflow phases'} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40">
          {adding ? <X size={13} /> : <Plus size={13} />} {adding ? 'ยกเลิก' : 'เพิ่มขั้นตอน'}
        </button>
      </div>
      {adding && (
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 space-y-2">
          <input
            autoFocus
            value={newDraft.step}
            onChange={(e) => setNewDraft({ ...newDraft, step: e.target.value })}
            placeholder="ชื่อขั้นตอน เช่น Final export"
            className="w-full p-2 text-sm text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
          />
          <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-2">
            <label className="text-[10px] text-gray-500">วัน
              <input type="number" min="0" value={newDraft.estDays} onChange={(e) => setNewDraft({ ...newDraft, estDays: e.target.value })} className="mt-1 w-full p-1.5 text-xs text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg" />
            </label>
            <label className="text-[10px] text-gray-500">ชั่วโมง
              <input type="number" min="0" value={newDraft.estHours} onChange={(e) => setNewDraft({ ...newDraft, estHours: e.target.value })} className="mt-1 w-full p-1.5 text-xs text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg" />
            </label>
            <label className="text-[10px] text-gray-500">กำหนดส่ง
              <input type="date" min={task.startDate} max={task.endDate} value={newDraft.dueDate} onChange={(e) => setNewDraft({ ...newDraft, dueDate: e.target.value })} className="mt-1 w-full p-1.5 text-xs text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg" />
            </label>
          </div>
          <button onClick={addDraft} disabled={!newDraft.step.trim()} className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-40">บันทึกขั้นตอนใหม่</button>
        </div>
      )}
      <div className={`absolute ${adding ? 'top-[220px]' : 'top-20'} bottom-2 left-2 w-0.5 bg-gray-200 dark:bg-zinc-700`} />
      {task.drafts.length === 0 && <p className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">ยังไม่มีขั้นตอน กด “เพิ่มขั้นตอน” เพื่อเริ่มสร้าง Workflow</p>}
      {task.drafts.map((d) => {
        const est = d.effortHours ?? d.estHours;
        const over = d.loggedHours > est;
        const done = d.status === 'Approved';
        const dayLabel = d.estDays > 0 ? `${d.estDays} วัน${d.estHours ? ` + ${d.estHours} ชม.` : ''}` : `${d.estHours} ชม.`;
        const ph = phaseFor(d.id);
        const pst = ph ? riskStyle(ph.level) : null;
        const draftStatusOptions = [d.status, ...(d.workflow?.allowedTransitions || [])];
        return (
          <div key={d.id} className="relative flex gap-3 pl-0">
            <div className={`w-4 h-4 rounded-full border-2 bg-white dark:bg-zinc-950 mt-1 z-10 flex items-center justify-center ${done ? 'border-emerald-500 text-emerald-500' : ph && ph.level === 'Critical' ? 'border-red-500' : 'border-gray-300 dark:border-zinc-600'}`}>
              {done && <CheckCircle size={10} />}
            </div>
            <div className={`flex-1 bg-white dark:bg-zinc-900 border rounded-lg p-3 shadow-sm ${ph && ph.level === 'Critical' ? 'border-red-300 dark:border-red-800' : ph && ph.level === 'High' ? 'border-orange-300 dark:border-orange-800' : 'border-gray-200 dark:border-zinc-800'}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{d.step}</span>
                  {ph && !done && ph.level !== 'Low' && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pst.chip}`}>{pst.label}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-600' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'}`}>{d.loggedHours}/{est} ชม.</span>
                  <button onClick={() => removeDraft(d)} className="w-6 h-6 rounded-md grid place-items-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="ลบขั้นตอน"><Trash2 size={12} /></button>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mb-1">
                <span className="text-blue-600 font-bold">⏱ {dayLabel}</span>
                {d.dueDate ? <> · กำหนด {fmtDate(d.dueDate)}</> : ph?.dueDate ? <> · กำหนด(auto) {fmtDate(ph.dueDate)}</> : null}
                {ph && !done && ph.level !== 'Low' && <span className={`ml-1 font-bold ${ph.daysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`}>· {ph.daysLeft < 0 ? `เลย ${Math.abs(ph.daysLeft)} วัน` : `เหลือ ${ph.daysLeft} วัน`}</span>}
              </p>

              <div className="flex items-center gap-2 mb-2">
                <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value)} className="text-[11px] text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded px-1.5 py-0.5 disabled:opacity-100">
                  {draftStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {d.fileName && d.fileUrl ? (
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" download={d.fileName}
                    className="max-w-[190px] text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-lg flex items-center gap-1 hover:underline">
                    {d.fileType === 'video' ? <PlaySquare size={11} /> : d.fileType === 'image' ? <ImageIcon size={11} /> : <FileText size={11} />}
                    <span className="truncate">{d.fileName}</span>
                  </a>
                ) : d.fileName ? (
                  <span className="max-w-[160px] text-[11px] text-gray-500 dark:text-zinc-400 truncate">{d.fileName} (ยังไม่มีข้อมูลไฟล์)</span>
                ) : null}
                <label className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap">
                  {d.fileName ? 'เปลี่ยนไฟล์' : '+ แนบไฟล์งาน'}
                  <input type="file" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) attachFile(d.id, file);
                    e.target.value = '';
                  }} />
                </label>
                {d.fileName && (
                  <button onClick={() => clearFile(d.id)} className="text-gray-400 hover:text-red-500" title="ลบไฟล์แนบ">
                    <X size={12} />
                  </button>
                )}
              </div>

              {editing === d.id ? (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-2 space-y-1.5">
                  <input value={edit.step} onChange={(e) => setEdit({ ...edit, step: e.target.value })} placeholder="ชื่อขั้นตอน" className="w-full p-1.5 text-xs text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded" />
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500 w-8">วัน</span>
                    <input type="number" min="0" value={edit.estDays} onChange={(e) => setEdit({ ...edit, estDays: e.target.value })} className="w-14 p-1 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-center" />
                    <span className="text-gray-500 w-8">ชม.</span>
                    <input type="number" min="0" value={edit.estHours} onChange={(e) => setEdit({ ...edit, estHours: e.target.value })} className="w-14 p-1 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-center" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500 w-8">ส่ง</span>
                    <input type="date" min={task.startDate} max={task.endDate} value={edit.dueDate} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} className="p-1 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => saveEdit(d.id)} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-bold">บันทึก</button>
                    <button onClick={() => setEditing(null)} className="text-xs px-2 text-gray-500">ยกเลิก</button>
                  </div>
                </div>
              ) : logging === d.id ? (
                <div className="flex gap-1.5">
                  <input autoFocus type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="ชม." className="w-20 p-1 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-xs" />
                  <button onClick={() => log(d.id)} className="text-xs px-2 bg-blue-600 text-white rounded font-bold">บันทึก</button>
                  <button onClick={() => setLogging(null)} className="text-xs px-2 text-gray-500">ยกเลิก</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => { setLogging(d.id); setHours(''); }} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"><Clock size={11} /> ลงชั่วโมง</button>
                  <button onClick={() => startEdit(d)} className="text-[11px] font-bold text-gray-500 hover:text-blue-600 hover:underline">ปรับเวลา/เลื่อนส่ง</button>
                </div>
              )}
              <DraftClientNotes
                draft={d}
                updates={draftUpdates.filter((entry) => entry.draftId === d.id)}
                onAdd={(body) => addDraftComment(d.id, body)}
                onDelete={deleteDraftComment}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Briefs({ task, onReload }) {
  const [showLink, setShowLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const addLink = async () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    await api.addAttachment(task.id, { name: linkName.trim(), type: 'link', url: linkUrl.trim() });
    setLinkName('');
    setLinkUrl('');
    setShowLink(false);
    onReload();
  };
  const addFile = async (file) => {
    try {
      const uploaded = await readFile(file);
      await api.addAttachment(task.id, uploaded);
      onReload();
    } catch (error) {
      alert(error.message);
    }
  };
  const ICON = { pdf: <FileText size={15} className="text-red-500" />, image: <ImageIcon size={15} className="text-violet-500" />, video: <PlaySquare size={15} className="text-indigo-500" />, link: <LinkIcon size={15} className="text-emerald-500" /> };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 flex items-center gap-1 cursor-pointer">
          <Paperclip size={13} /> อัปโหลดไฟล์
          <input type="file" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addFile(file);
            e.target.value = '';
          }} />
        </label>
        <button onClick={() => setShowLink((v) => !v)} className="text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1"><Plus size={12} /> เพิ่มลิงก์</button>
        <span className="text-[9px] text-gray-400">สูงสุด 3 MB</span>
      </div>
      {showLink && (
        <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 mb-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
          <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="ชื่อ reference" className="min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-zinc-600" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-zinc-600" />
          <button onClick={addLink} disabled={!linkName.trim() || !linkUrl.trim()} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-40">บันทึก</button>
        </div>
      )}
      <div className="space-y-2">
        {task.attachments.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg">ยังไม่มีไฟล์อ้างอิง</p>
        ) : task.attachments.map((f) => (
          <div key={f.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 min-w-0">
              {ICON[f.type] || ICON.link}
              {f.url ? <a href={f.url} target="_blank" rel="noreferrer" download={f.type === 'link' ? undefined : f.name} className="text-sm text-blue-700 dark:text-blue-300 truncate hover:underline">{f.name}</a> : <span className="text-sm text-gray-700 dark:text-zinc-300 truncate">{f.name}</span>}
            </div>
            <button onClick={() => api.deleteAttachment(task.id, f.id).then(onReload)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftClientNotes({ draft, updates, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = updates[0];

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onAdd(body.trim());
      setBody('');
      setOpen(true);
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen((value) => !value)} className="text-[11px] font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1 hover:underline">
          <MessageSquareText size={12} /> คอมเมนต์ลูกค้า {updates.length > 0 ? `(${updates.length})` : ''}
        </button>
        {latest && !open && <span className="max-w-[250px] truncate text-[10px] text-gray-400">ล่าสุด: {latest.body}</span>}
      </div>

      {latest && !open && (
        <button onClick={() => setOpen(true)} className="mt-2 w-full text-left px-2.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 line-clamp-2">
          “{latest.body}”
        </button>
      )}

      {open && (
        <div className="mt-2 space-y-2">
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {updates.length === 0 ? (
              <p className="text-[10px] text-gray-400 py-2">ยังไม่มี Feedback สำหรับ {draft.step}</p>
            ) : updates.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] leading-4 text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">{entry.body}</p>
                  <p className="mt-1 text-[9px] text-amber-600/70 dark:text-amber-300/70">
                    บันทึกโดย {entry.author?.name || 'ทีมงาน'} · {new Date(entry.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {entry.canDelete && <button onClick={() => onDelete(entry)} title="ลบคอมเมนต์" className="text-amber-300 hover:text-red-500"><Trash2 size={11} /></button>}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`จด Feedback ลูกค้าสำหรับ ${draft.step}…`}
              className="flex-1 min-w-0 h-16 resize-none p-2 text-[11px] leading-4 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-amber-400"
            />
            <button onClick={submit} disabled={busy || !body.trim()} className="self-end px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold disabled:opacity-40">
              {busy ? 'บันทึก…' : 'เพิ่ม'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskUpdates({ task }) {
  const [updates, setUpdates] = useState(null);
  const [type, setType] = useState('comment');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadUpdates = async () => {
    const { updates } = await api.taskUpdates(task.id);
    setUpdates(updates);
  };
  useEffect(() => { loadUpdates(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [task.id]);

  const pickFile = async (file) => {
    try {
      setAttachment(await readFile(file));
    } catch (error) {
      alert(error.message);
    }
  };
  const submit = async () => {
    if (!body.trim() && !attachment) return;
    setBusy(true);
    try {
      const { update } = await api.addTaskUpdate(task.id, { type, body: body.trim(), attachment });
      setUpdates((current) => [update, ...(current || [])]);
      setBody('');
      setAttachment(null);
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entry) => {
    if (!confirm(`ลบ${entry.type === 'note' ? 'โน้ต' : 'คอมเมนต์'}นี้ใช่ไหม?`)) return;
    await api.deleteTaskUpdate(task.id, entry.id);
    setUpdates((current) => current.filter((item) => item.id !== entry.id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex p-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg">
            <button onClick={() => setType('comment')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${type === 'comment' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-zinc-300'}`}>
              <MessageSquareText size={12} /> คอมเมนต์ทีม
            </button>
            <button onClick={() => setType('note')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${type === 'note' ? 'bg-amber-500 text-white' : 'text-gray-500 dark:text-zinc-300'}`}>
              <StickyNote size={12} /> โน้ต
            </button>
          </div>
          <span className="text-[10px] text-gray-400">แนบไฟล์ได้ไม่เกิน 3 MB</span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={type === 'note' ? 'จดโน้ต รายละเอียด หรือสิ่งที่ต้องจำ…' : 'เขียนคอมเมนต์ อัปเดต หรือ Feedback ให้ทีม…'}
          className="w-full h-24 resize-y p-3 text-sm leading-6 text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none focus:border-blue-500"
        />
        {attachment && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
            <Paperclip size={13} className="text-blue-600" />
            <span className="flex-1 min-w-0 truncate text-xs font-bold text-gray-700 dark:text-zinc-200">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30">
            <Paperclip size={13} /> แนบไฟล์
            <input type="file" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pickFile(file);
              e.target.value = '';
            }} />
          </label>
          <button onClick={submit} disabled={busy || (!body.trim() && !attachment)} className={`flex-1 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40 ${type === 'note' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {busy ? 'กำลังบันทึก…' : type === 'note' ? 'บันทึกโน้ต' : 'ส่งคอมเมนต์'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {updates === null ? (
          <p className="py-6 text-center text-xs text-gray-400">กำลังโหลด…</p>
        ) : updates.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">ยังไม่มีโน้ตหรือคอมเมนต์</p>
        ) : updates.map((entry) => (
          <div key={entry.id} className={`p-3 rounded-xl border ${entry.type === 'note' ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700'}`}>
            <div className="flex items-start gap-2">
              <Avatar user={entry.author} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate">{entry.author?.name || 'สมาชิกทีม'}</p>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${entry.type === 'note' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300'}`}>{entry.type === 'note' ? 'โน้ต' : 'คอมเมนต์'}</span>
                  <span className="text-[9px] text-gray-400">{new Date(entry.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {entry.body && <p className="mt-1.5 text-xs leading-5 text-gray-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{entry.body}</p>}
                {entry.attachment && (
                  <a href={entry.attachment.url} target="_blank" rel="noreferrer" download={entry.attachment.name} className="mt-2 inline-flex max-w-full items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[11px] font-bold text-blue-600 dark:text-blue-300 hover:underline">
                    <Paperclip size={11} /><span className="truncate">{entry.attachment.name}</span>
                  </a>
                )}
              </div>
              {entry.canDelete && <button onClick={() => remove(entry)} title="ลบรายการ" className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientEmail({ task, project, pm, assignee, googleStatus }) {
  const makeBody = (type) => {
    const greeting = 'เรียน ทีมงาน,';
    const signoff = `ขอบคุณครับ\n${pm?.name?.split(' ')[0] || ''}`;
    if (type === 'approval') return `${greeting}\n\nงาน "${task.title}" พร้อมให้ตรวจสอบและอนุมัติแล้วครับ\n\nรบกวนตรวจสอบไฟล์งานและแจ้งผลอนุมัติหรือคอมเมนต์กลับมาได้เลยครับ\n\n${signoff}`;
    if (type === 'deadline') return `${greeting}\n\nขอแจ้งกำหนดส่งงาน "${task.title}" ภายในวันที่ ${fmtDate(task.endDate)}\nสถานะปัจจุบัน: ${task.status}\n\nหากมีข้อมูลหรือคอมเมนต์เพิ่มเติม รบกวนส่งกลับภายในกำหนดเพื่อไม่ให้กระทบ Timeline ครับ\n\n${signoff}`;
    return `${greeting}\n\nขออัปเดตสถานะงาน "${task.title}"\n• สถานะปัจจุบัน: ${task.status}\n• ผู้รับผิดชอบ: ${assignee?.name || 'ยังไม่ระบุ'}\n• กำหนดส่ง: ${fmtDate(task.endDate)}\n• ชั่วโมงที่ใช้: ${task.loggedHours || 0}/${task.estimatedHours || 0} ชม.\n\nรบกวนตรวจสอบและให้คอมเมนต์ด้วยครับ\n\n${signoff}`;
  };
  const [template, setTemplate] = useState('status');
  const [to, setTo] = useState(project?.clientEmail || '');
  const [cc, setCc] = useState([pm?.email, assignee?.email].filter(Boolean).join(', '));
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(`อัปเดตงาน: ${task.title}`);
  const [body, setBody] = useState(() => makeBody('status'));
  const [emailAttachments, setEmailAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const applyTemplate = (value) => {
    setTemplate(value);
    setSubject(value === 'approval' ? `ขออนุมัติงาน: ${task.title}` : value === 'deadline' ? `แจ้งกำหนดส่ง: ${task.title}` : `อัปเดตงาน: ${task.title}`);
    setBody(makeBody(value));
  };
  const addEmailAttachments = async (files) => {
    try {
      const uploaded = await Promise.all(Array.from(files).map(readFile));
      const total = [...emailAttachments, ...uploaded].reduce((sum, file) => sum + (Number(file.size) || 0), 0);
      if (total > MAX_FILE_BYTES) throw new Error('ไฟล์แนบอีเมลรวมกันต้องไม่เกิน 3 MB');
      setEmailAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      alert(error.message);
    }
  };

  const send = async () => {
    setSending(true); setResult(null);
    try {
      await api.sendGmail({
        to: to.trim(), cc: cc.trim(), bcc: bcc.trim(), subject: subject.trim(), text: body,
        attachments: emailAttachments.map(({ name, mimeType, url }) => ({ name, mimeType, url })),
        taskId: task.id,
      });
      setResult({ ok: true, msg: 'ส่งอีเมลเรียบร้อย ✓' });
    } catch (e) {
      setResult({ ok: false, msg: e.code === 'GOOGLE_NOT_CONFIGURED' ? 'ยังไม่ได้ตั้งค่า Google API ในเซิร์ฟเวอร์' : e.code === 'GOOGLE_NOT_LINKED' ? 'บัญชีนี้ยังไม่ได้ login ด้วย Google' : e.message });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-2">
      <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 text-[11px] font-bold px-3 py-2 rounded-lg flex items-center gap-1">
        <Mail size={13} /> ส่งผ่าน Gmail ของคุณ {!googleStatus?.linked && <span className="text-indigo-400 font-normal">(ต้อง login Google ก่อน)</span>}
      </div>
      <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 p-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900">
        <label className="text-[11px] font-bold text-gray-500 self-center">รูปแบบอีเมล</label>
        <select value={template} onChange={(e) => applyTemplate(e.target.value)} className="p-2 text-xs text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg">
          <option value="status">อัปเดตสถานะงาน</option>
          <option value="approval">ขอตรวจสอบ/อนุมัติ</option>
          <option value="deadline">แจ้งกำหนดส่ง</option>
        </select>
        <span className="text-[11px] font-bold text-gray-500 self-center">ส่งจาก</span>
        <span className="p-2 text-xs text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 rounded-lg">{googleStatus?.email || 'บัญชี Gmail ที่เชื่อมต่อ'}</span>
        <label className="text-[11px] font-bold text-gray-500 self-center">ถึง (To) *</label>
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" className="p-2 text-sm text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500" />
        <label className="text-[11px] font-bold text-gray-500 self-center">สำเนา (Cc)</label>
        <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="คั่นหลายอีเมลด้วย comma" className="p-2 text-xs text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500" />
        <label className="text-[11px] font-bold text-gray-500 self-center">สำเนาลับ (Bcc)</label>
        <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="ไม่บังคับ" className="p-2 text-xs text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500" />
        <label className="text-[11px] font-bold text-gray-500 self-center">หัวข้อ *</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="p-2 text-sm text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-gray-500">ข้อความ</label>
          <span className="text-[10px] text-gray-400">{body.length} ตัวอักษร</span>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full h-52 p-3 text-sm leading-6 text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl resize-y outline-none focus:border-blue-500" />
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-gray-700 dark:text-zinc-200 flex items-center gap-1"><Paperclip size={12} /> ไฟล์แนบในอีเมล</p>
            <p className="text-[9px] text-gray-400">แนบไปกับ Gmail จริง · รวมไม่เกิน 3 MB</p>
          </div>
          <label className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold cursor-pointer hover:bg-indigo-100">
            + เลือกไฟล์
            <input type="file" multiple className="hidden" onChange={(e) => {
              if (e.target.files?.length) addEmailAttachments(e.target.files);
              e.target.value = '';
            }} />
          </label>
        </div>
        {emailAttachments.length === 0 ? (
          <p className="py-3 text-center text-[10px] text-gray-400 border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg">ยังไม่มีไฟล์แนบ</p>
        ) : (
          <div className="space-y-1.5">
            {emailAttachments.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800">
                <Paperclip size={11} className="text-indigo-500" />
                <span className="flex-1 min-w-0 truncate text-[11px] font-bold text-gray-700 dark:text-zinc-200">{file.name}</span>
                <span className="text-[9px] text-gray-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                <button onClick={() => setEmailAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="เอาไฟล์ออก" className="text-gray-400 hover:text-red-500"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      {result && <p className={`text-xs font-bold ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.msg}</p>}
      <button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
        <Send size={15} /> {sending ? 'กำลังส่ง…' : 'ส่งถึงลูกค้า'}
      </button>
    </div>
  );
}
