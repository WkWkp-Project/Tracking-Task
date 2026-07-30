import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Paperclip } from 'lucide-react';
import api from '../api/client.js';
import { Avatar } from './ui.jsx';
import NewAETaskModal from './NewAETaskModal.jsx';
import { AE_PRIORITY, AE_STATUS, AE_MANHOUR, aePriority, aeStatus, dueSeverity, fmtDate } from '../utils.js';

const DUE_TINT = {
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  done: 'bg-gray-50 text-gray-500 ring-gray-200',
  none: 'bg-white text-gray-700 ring-gray-200',
};
const KNOWN_PROJECTS = ['AE work', 'New client', 'Falcon', 'Thychef', 'Kirin', 'Tulip', 'Debic'];

// shared cell field styling — same solid-white/gray-border form language as the rest of the app
const FIELD =
  'w-full bg-white text-sm text-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-300 ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors';

function PillSelect({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`appearance-none cursor-pointer text-[11px] font-bold px-2.5 py-1 rounded-full outline-none focus:ring-2 focus:ring-blue-200 ${className}`}
    >
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

export default function AEBoard({ users, currentUser }) {
  const aePeople = useMemo(() => users.filter((u) => u.role === 'ae'), [users]);
  const [rows, setRows] = useState(null);
  const [brands, setBrands] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showNewTask, setShowNewTask] = useState(false);

  const load = async () => {
    const { tasks } = await api.aeTasks();
    setRows(tasks);
  };
  const loadBrands = async () => {
    const { brands } = await api.brands();
    setBrands(brands);
  };
  useEffect(() => { load(); loadBrands(); }, []);

  const projectOptions = useMemo(() => {
    const set = new Set(KNOWN_PROJECTS);
    (rows || []).forEach((r) => r.project && set.add(r.project));
    return [...set];
  }, [rows]);

  const personById = (id) => users.find((u) => u.id === id);
  const filtered = (rows || []).filter((r) => filter === 'all' || r.inChargeId === filter);

  // optimistic patch
  const patch = async (id, p) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    try { await api.updateAeTask(id, p); } catch { load(); }
  };
  const removeRow = async (id) => {
    if (!confirm('ลบงานนี้?')) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    try { await api.deleteAeTask(id); } catch { load(); }
  };

  return (
    <div>
      {/* toolbar — same chip/button vocabulary as the rest of the app */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold ${filter === 'all' ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
            ทั้งหมด
          </button>
          {aePeople.map((p) => (
            <button key={p.id} onClick={() => setFilter(p.id)}
              className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border text-xs font-bold ${filter === p.id ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Avatar user={p} size={20} /> {p.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 tabular-nums">{filtered.length} งาน</span>
          <button onClick={() => setShowNewTask(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm">
            <Plus size={16} /> เพิ่มงาน
          </button>
        </div>
      </div>

      {/* board card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1180px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                {['Assign', 'In charge', 'Project', 'Work Details', 'Priority', 'Status', 'Start', 'Due', 'Man Hour', 'Workday', 'Docs', 'Notes', ''].map((h, i) => (
                  <th key={i} className="text-left font-bold px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows === null ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={13} className="px-3 py-3"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="px-3 py-12 text-center text-gray-400 text-sm">
                  ยังไม่มีงาน AE {filter !== 'all' ? 'ของคนนี้' : ''} — กด “เพิ่มงาน” เพื่อเริ่มแถวแรก
                </td></tr>
              ) : filtered.map((r) => {
                const pri = aePriority(r.priority);
                const st = aeStatus(r.status);
                const sev = dueSeverity(r.dueDate, r.status);
                const person = personById(r.inChargeId);
                return (
                  <tr key={r.id} className="group hover:bg-gray-50/70 align-middle">
                    <td className="px-2 py-1.5"><input type="date" value={r.assignDate || ''} onChange={(e) => patch(r.id, { assignDate: e.target.value })} className={`${FIELD} tabular-nums min-w-[130px]`} /></td>

                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Avatar user={person} size={22} />
                        <select value={r.inChargeId || ''} onChange={(e) => patch(r.id, { inChargeId: e.target.value })}
                          className={`${FIELD} font-bold text-xs min-w-[70px]`}>
                          {!person && <option value="">—</option>}
                          {aePeople.map((p) => <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>)}
                        </select>
                      </div>
                    </td>

                    <td className="px-2 py-1.5">
                      <input list="ae-projects" value={r.project || ''} onChange={(e) => patch(r.id, { project: e.target.value })}
                        className={`${FIELD} font-medium min-w-[110px]`} placeholder="—" />
                    </td>

                    <td className="px-2 py-1.5">
                      <input value={r.workDetails || ''} onChange={(e) => patch(r.id, { workDetails: e.target.value })}
                        className={`${FIELD} min-w-[280px]`} placeholder="รายละเอียดงาน…" />
                    </td>

                    <td className="px-2 py-1.5">
                      <PillSelect value={r.priority} onChange={(e) => patch(r.id, { priority: e.target.value })} options={AE_PRIORITY} className={pri.chip} />
                    </td>
                    <td className="px-2 py-1.5">
                      <PillSelect value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })} options={AE_STATUS} className={st.chip} />
                    </td>

                    <td className="px-2 py-1.5"><input type="date" value={r.startDate || ''} onChange={(e) => patch(r.id, { startDate: e.target.value })} className={`${FIELD} tabular-nums min-w-[130px]`} /></td>

                    <td className="px-2 py-1.5">
                      <div className={`flex items-center gap-1.5 rounded-md ring-1 ${DUE_TINT[sev]} px-1`}>
                        <input type="date" value={r.dueDate || ''} onChange={(e) => patch(r.id, { dueDate: e.target.value })}
                          className="bg-transparent text-sm font-bold px-1.5 py-1.5 outline-none tabular-nums min-w-[122px] text-inherit" />
                      </div>
                    </td>

                    <td className="px-2 py-1.5">
                      <PillSelect value={r.manHour} onChange={(e) => patch(r.id, { manHour: e.target.value })} options={AE_MANHOUR} className="bg-gray-100 text-gray-700" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" step="0.5" min="0" value={r.estWorkday} onChange={(e) => patch(r.id, { estWorkday: e.target.value })}
                        className={`${FIELD} w-16 text-center tabular-nums`} />
                    </td>

                    <td className="px-2 py-1.5">
                      <button onClick={() => alert('เดโม: อัปโหลดไฟล์จริงจะต่อ storage — เก็บลิงก์ไฟล์ต่องานได้')}
                        className="inline-flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-1.5 hover:text-blue-600 hover:border-blue-300">
                        <Paperclip size={13} /> File
                      </button>
                    </td>

                    <td className="px-2 py-1.5">
                      <input value={r.notes || ''} onChange={(e) => patch(r.id, { notes: e.target.value })}
                        className={`${FIELD} text-gray-500 min-w-[150px]`} placeholder="—" />
                    </td>

                    <td className="px-1 py-1.5">
                      <button onClick={() => removeRow(r.id)} title="ลบ"
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="ae-projects">{projectOptions.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
      </div>

      {/* legend — same quiet caption style */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400 flex-wrap px-1">
        {AE_PRIORITY.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />{p.label}</span>
        ))}
        <span className="ml-auto flex items-center gap-3">
          Due:
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />ด่วน/เลย</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />ใกล้</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />มีเวลา</span>
        </span>
      </div>

      <NewAETaskModal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        users={users}
        brands={brands}
        presetInChargeId={filter !== 'all' ? filter : null}
        existingProjects={projectOptions}
        onCreated={(task) => { setRows((rs) => [task, ...(rs || [])]); loadBrands(); }}
      />
    </div>
  );
}
