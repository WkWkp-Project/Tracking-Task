import React, { useEffect, useState } from 'react';
import {
  X, Clock, CheckCircle, CalendarDays, Mail, Send, Paperclip, Plus, FileText,
  Image as ImageIcon, Link as LinkIcon, PlaySquare, Trash2, AlertCircle, AlertTriangle, Gauge,
} from 'lucide-react';
import api from '../api/client.js';
import { Avatar, RiskBadge } from './ui.jsx';
import { riskStyle, daysLeftText, fmtDate } from '../utils.js';

const STATUSES = ['To Do', 'Draft 1', 'Draft 2', 'Final', 'Client Review', 'Approval', 'Done', 'Cancelled'];
const DRAFT_STATUSES = ['Pending', 'In Progress', 'Revising', 'Approved'];

export default function TaskDrawer({ taskId, users, project, googleStatus, onClose, onChanged, onOpenChat }) {
  const [task, setTask] = useState(null);
  const [tab, setTab] = useState('pipeline');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { task } = await api.task(taskId);
    setTask(task);
  };
  useEffect(() => { if (taskId) load(); /* eslint-disable-next-line */ }, [taskId]);

  if (!taskId) return null;
  if (!task) return (
    <div className="w-[560px] bg-white border-l border-gray-200 shadow-2xl flex items-center justify-center text-gray-400">กำลังโหลด…</div>
  );

  const pm = users.find((u) => u.id === task.pmId);
  const assignee = users.find((u) => u.id === task.assigneeId);
  const risk = task.risk;
  const rs = riskStyle(risk?.level);
  const pmOptions = users.filter((u) => u.role === 'pm' || u.role === 'admin');
  const workerOptions = users.filter((u) => !['pm', 'admin'].includes(u.role));

  const patchTask = async (patch) => {
    setBusy(true);
    try { const { task: t } = await api.updateTask(task.id, patch); setTask(t); onChanged?.(); }
    finally { setBusy(false); }
  };

  return (
    <div className="w-[560px] bg-white border-l border-gray-200 shadow-2xl flex flex-col z-30 shrink-0">
      {/* header */}
      <div className="h-14 px-5 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
        <span className="text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded">รายละเอียดงาน</span>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* overview */}
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-xl font-black text-gray-900 leading-tight mb-2">{task.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <RiskBadge level={risk?.level} />
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${rs.chip}`}>{daysLeftText(risk?.calendarDaysLeft)}</span>
            {task.syncCalendar && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600 flex items-center gap-1"><CalendarDays size={11} /> Synced</span>}
          </div>

          {/* status */}
          <div className="mt-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase">สถานะ</label>
            <select value={task.status} onChange={(e) => patchTask({ status: e.target.value })} disabled={busy}
              className="ml-2 text-sm border border-gray-300 rounded-lg px-2 py-1 font-bold">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* ownership (editable — reassign worker / PM) */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <EditOwner label="PM (ผู้ดู)" current={pm} options={pmOptions} disabled={busy}
              onChange={(id) => patchTask({ pmId: id })} onChat={pm ? () => onOpenChat(pm.id) : null} />
            <EditOwner label="ผู้ทำงาน (เปลี่ยน/ทดแทนได้)" current={assignee} options={workerOptions} disabled={busy}
              onChange={(id) => patchTask({ assigneeId: id })} onChat={assignee ? () => onOpenChat(assignee.id) : null} />
          </div>

          {/* hours + editable deadline */}
          <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1"><Clock size={14} /> ชั่วโมง</span>
              <span className={`font-bold ${task.loggedHours > task.estimatedHours ? 'text-red-600' : 'text-gray-800'}`}>
                {task.loggedHours} / {task.estimatedHours} ชม.
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${task.loggedHours > task.estimatedHours ? 'bg-red-500' : 'bg-violet-500'}`}
                style={{ width: `${Math.min(100, (task.loggedHours / (task.estimatedHours || 1)) * 100)}%` }} />
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px]">
              <span className="text-gray-500">เริ่ม</span>
              <input type="date" value={task.startDate} disabled={busy} onChange={(e) => patchTask({ startDate: e.target.value })} className="border border-gray-300 rounded px-1.5 py-1" />
              <span className="text-gray-500">ส่ง</span>
              <input type="date" value={task.endDate} disabled={busy} onChange={(e) => patchTask({ endDate: e.target.value })} className="border border-gray-300 rounded px-1.5 py-1" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">เลื่อนวันส่ง (deadline ปลายทาง) เพื่อล้างสถานะวิกฤตได้</p>
          </div>
        </div>

        {/* risk panel */}
        {risk && (
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><Gauge size={15} className="text-blue-600" /> วิเคราะห์ความเสี่ยง</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="โอกาสเสร็จทัน" value={`${Math.round(risk.onTimeProbability * 100)}%`} />
              <Stat label="ค่าความเสี่ยง (exposure)" value={risk.riskExposure} />
              <Stat label="capacity ว่าง" value={`${risk.availableHoursForTask} ชม.`} />
              <Stat label="งานค้างรวม" value={`${risk.expectedRemainingHours} ชม.`} />
            </div>

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
                        <span className="font-bold text-gray-700 w-20 truncate">{p.step}</span>
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
                <li key={i} className="text-[11px] text-gray-600 flex gap-1.5">
                  {risk.level === 'Critical' ? <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />}
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* tabs */}
        <div className="flex border-b border-gray-200 px-5 sticky top-0 bg-white z-10">
          {[['pipeline', 'ดราฟ & ชั่วโมง'], ['briefs', 'ไฟล์/Brief'], ['client', 'อีเมลลูกค้า']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`py-2.5 px-3 text-sm font-bold border-b-2 ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>{l}</button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'pipeline' && <Pipeline task={task} phases={risk?.phases || []} onReload={() => { load(); onChanged?.(); }} />}
          {tab === 'briefs' && <Briefs task={task} onReload={load} />}
          {tab === 'client' && <ClientEmail task={task} project={project} pm={pm} assignee={assignee} googleStatus={googleStatus} />}
        </div>
      </div>

      <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
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
    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold text-gray-500 uppercase">{label}</p>
        {onChat && <button onClick={onChat} className="text-[10px] text-blue-600 hover:underline">แชต</button>}
      </div>
      <div className="flex items-center gap-2">
        <Avatar user={current} size={24} />
        <select value={current?.id || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 text-xs font-bold bg-white border border-gray-300 rounded px-1.5 py-1">
          {!current && <option value="">—</option>}
          {options.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
      <p className="text-gray-500">{label}</p>
      <p className="font-bold text-gray-800 text-sm">{value}</p>
    </div>
  );
}

function Pipeline({ task, phases, onReload }) {
  const [logging, setLogging] = useState(null); // draftId
  const [hours, setHours] = useState('');
  const [editing, setEditing] = useState(null); // draftId
  const [edit, setEdit] = useState({ estDays: 0, estHours: 0, dueDate: '' });

  const phaseFor = (draftId) => (phases || []).find((p) => p.draftId === draftId);

  const log = async (draftId) => {
    const h = Number(hours);
    if (!h || h <= 0) return;
    await api.logHours(task.id, { draftId, hours: h });
    setHours(''); setLogging(null); onReload();
  };

  const setStatus = async (draftId, status) => { await api.updateDraft(task.id, draftId, { status }); onReload(); };
  const attachFile = async (draftId) => {
    const name = prompt('ชื่อไฟล์งาน (เช่น KV_Draft1.jpg)');
    if (!name) return;
    const type = /\.(mp4|mov)$/i.test(name) ? 'video' : /\.(jpg|jpeg|png|gif)$/i.test(name) ? 'image' : 'file';
    await api.updateDraft(task.id, draftId, { fileName: name, fileType: type, status: 'In Progress' });
    onReload();
  };
  const startEdit = (d) => { setEditing(d.id); setEdit({ estDays: d.estDays || 0, estHours: d.estHours || 0, dueDate: d.dueDate || '' }); };
  const saveEdit = async (draftId) => {
    await api.updateDraft(task.id, draftId, {
      estDays: Number(edit.estDays) || 0, estHours: Number(edit.estHours) || 0, dueDate: edit.dueDate || null,
    });
    setEditing(null); onReload();
  };

  return (
    <div className="space-y-3 relative">
      <div className="absolute top-2 bottom-2 left-2 w-0.5 bg-gray-200" />
      {task.drafts.map((d) => {
        const est = d.effortHours ?? d.estHours;
        const over = d.loggedHours > est;
        const done = d.status === 'Approved';
        const dayLabel = d.estDays > 0 ? `${d.estDays} วัน${d.estHours ? ` + ${d.estHours} ชม.` : ''}` : `${d.estHours} ชม.`;
        const ph = phaseFor(d.id);
        const pst = ph ? riskStyle(ph.level) : null;
        return (
          <div key={d.id} className="relative flex gap-3 pl-0">
            <div className={`w-4 h-4 rounded-full border-2 bg-white mt-1 z-10 flex items-center justify-center ${done ? 'border-emerald-500 text-emerald-500' : ph && ph.level === 'Critical' ? 'border-red-500' : 'border-gray-300'}`}>
              {done && <CheckCircle size={10} />}
            </div>
            <div className={`flex-1 bg-white border rounded-lg p-3 shadow-sm ${ph && ph.level === 'Critical' ? 'border-red-300' : ph && ph.level === 'High' ? 'border-orange-300' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900">{d.step}</span>
                  {ph && !done && ph.level !== 'Low' && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pst.chip}`}>{pst.label}</span>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{d.loggedHours}/{est} ชม.</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-1">
                <span className="text-blue-600 font-bold">⏱ {dayLabel}</span>
                {d.dueDate ? <> · กำหนด {fmtDate(d.dueDate)}</> : ph?.dueDate ? <> · กำหนด(auto) {fmtDate(ph.dueDate)}</> : null}
                {ph && !done && ph.level !== 'Low' && <span className={`ml-1 font-bold ${ph.daysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`}>· {ph.daysLeft < 0 ? `เลย ${Math.abs(ph.daysLeft)} วัน` : `เหลือ ${ph.daysLeft} วัน`}</span>}
              </p>

              <div className="flex items-center gap-2 mb-2">
                <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value)} className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5">
                  {DRAFT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {d.fileName ? (
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1">
                    {d.fileType === 'video' ? <PlaySquare size={11} /> : <ImageIcon size={11} />} {d.fileName}
                  </span>
                ) : (
                  <button onClick={() => attachFile(d.id)} className="text-[11px] text-blue-600 hover:underline">+ แนบไฟล์งาน</button>
                )}
              </div>

              {editing === d.id ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500 w-8">วัน</span>
                    <input type="number" min="0" value={edit.estDays} onChange={(e) => setEdit({ ...edit, estDays: e.target.value })} className="w-14 p-1 border border-gray-300 rounded text-center" />
                    <span className="text-gray-500 w-8">ชม.</span>
                    <input type="number" min="0" value={edit.estHours} onChange={(e) => setEdit({ ...edit, estHours: e.target.value })} className="w-14 p-1 border border-gray-300 rounded text-center" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500 w-8">ส่ง</span>
                    <input type="date" value={edit.dueDate} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} className="p-1 border border-gray-300 rounded" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => saveEdit(d.id)} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-bold">บันทึก</button>
                    <button onClick={() => setEditing(null)} className="text-xs px-2 text-gray-500">ยกเลิก</button>
                  </div>
                </div>
              ) : logging === d.id ? (
                <div className="flex gap-1.5">
                  <input autoFocus type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="ชม." className="w-20 p-1 border border-gray-300 rounded text-xs" />
                  <button onClick={() => log(d.id)} className="text-xs px-2 bg-blue-600 text-white rounded font-bold">บันทึก</button>
                  <button onClick={() => setLogging(null)} className="text-xs px-2 text-gray-500">ยกเลิก</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => { setLogging(d.id); setHours(''); }} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"><Clock size={11} /> ลงชั่วโมง</button>
                  <button onClick={() => startEdit(d)} className="text-[11px] font-bold text-gray-500 hover:text-blue-600 hover:underline">ปรับเวลา/เลื่อนส่ง</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Briefs({ task, onReload }) {
  const add = async () => {
    const name = prompt('ชื่อไฟล์/ลิงก์ brief');
    if (!name) return;
    const url = prompt('URL (ถ้ามี)') || null;
    const type = url ? 'link' : /\.(pdf)$/i.test(name) ? 'pdf' : /\.(jpg|png)$/i.test(name) ? 'image' : 'file';
    await api.addAttachment(task.id, { name, type, url });
    onReload();
  };
  const ICON = { pdf: <FileText size={15} className="text-red-500" />, image: <ImageIcon size={15} className="text-violet-500" />, video: <PlaySquare size={15} className="text-indigo-500" />, link: <LinkIcon size={15} className="text-emerald-500" /> };
  return (
    <div>
      <button onClick={add} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mb-3"><Plus size={12} /> เพิ่ม brief / reference</button>
      <div className="space-y-2">
        {task.attachments.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4 border border-dashed rounded-lg">ยังไม่มีไฟล์อ้างอิง</p>
        ) : task.attachments.map((f) => (
          <div key={f.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              {ICON[f.type] || ICON.link}
              {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 truncate hover:underline">{f.name}</a> : <span className="text-sm text-gray-700 truncate">{f.name}</span>}
            </div>
            <button onClick={() => api.deleteAttachment(task.id, f.id).then(onReload)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientEmail({ task, project, pm, assignee, googleStatus }) {
  const [to, setTo] = useState(project?.clientEmail || '');
  const [subject, setSubject] = useState(`อัปเดตงาน: ${task.title}`);
  const [body, setBody] = useState(`เรียน ทีมงาน,\n\nขออัปเดตสถานะงาน "${task.title}" — สถานะปัจจุบัน: ${task.status}\n\nรบกวนตรวจสอบและให้คอมเมนต์ด้วยครับ\n\nขอบคุณครับ\n${pm?.name?.split(' ')[0] || ''}`);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const cc = [pm?.email, assignee?.email].filter(Boolean).join(', ');

  const send = async () => {
    setSending(true); setResult(null);
    try {
      await api.sendGmail({ to, cc, subject, text: body, taskId: task.id });
      setResult({ ok: true, msg: 'ส่งอีเมลเรียบร้อย ✓' });
    } catch (e) {
      setResult({ ok: false, msg: e.code === 'GOOGLE_NOT_CONFIGURED' ? 'ยังไม่ได้ตั้งค่า Google API ในเซิร์ฟเวอร์' : e.code === 'GOOGLE_NOT_LINKED' ? 'บัญชีนี้ยังไม่ได้ login ด้วย Google' : e.message });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-2">
      <div className="bg-indigo-50 text-indigo-800 text-[11px] font-bold px-3 py-2 rounded-lg flex items-center gap-1">
        <Mail size={13} /> ส่งผ่าน Gmail ของคุณ {!googleStatus?.linked && <span className="text-indigo-400 font-normal">(ต้อง login Google ก่อน)</span>}
      </div>
      <Field label="To"><input value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" /></Field>
      <Field label="Cc"><span className="text-xs text-gray-500">{cc || '—'}</span></Field>
      <Field label="หัวข้อ"><input value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" /></Field>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full h-36 p-2.5 text-sm border border-gray-200 rounded-lg resize-none outline-none focus:border-blue-500" />
      {result && <p className={`text-xs font-bold ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.msg}</p>}
      <button onClick={send} disabled={sending || !to} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
        <Send size={15} /> {sending ? 'กำลังส่ง…' : 'ส่งถึงลูกค้า'}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 pb-1">
      <span className="w-12 text-xs font-bold text-gray-500">{label}</span>
      {children}
    </div>
  );
}
