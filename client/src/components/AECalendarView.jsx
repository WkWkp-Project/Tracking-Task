import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client.js';
import { Avatar } from './ui.jsx';
import { monthGrid, todayKey, dueSeverity } from '../utils.js';

const DAY_TINT = { danger: 'bg-red-50 border-red-100', warn: 'bg-amber-50 border-amber-100', ok: 'bg-white', done: 'bg-white', none: 'bg-white' };
const CHIP_TINT = { danger: 'bg-red-100 text-red-700', warn: 'bg-amber-100 text-amber-700', ok: 'bg-emerald-50 text-emerald-700', done: 'bg-gray-100 text-gray-500', none: 'bg-gray-100 text-gray-600' };

// Built-in calendar for AE work — separate from the PM/project calendar so
// AE due dates don't get crowded together with PM task bars on the same days.
export default function AECalendarView({ users, refreshKey, onOpenAeBoard }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedDay, setExpandedDay] = useState(null); // day key showing all items

  const aePeople = useMemo(() => (users || []).filter((u) => u.role === 'ae'), [users]);

  const load = useCallback(async () => {
    const { tasks } = await api.aeTasks();
    setRows(tasks);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const tKey = todayKey();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const move = (delta) => {
    setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const jumpMonth = (val) => {
    const [y, m] = val.split('-').map(Number);
    if (y && m) setCursor({ y, m: m - 1 });
  };

  const byDay = useMemo(() => {
    const map = {};
    (rows || []).forEach((r) => {
      if (!r.dueDate) return;
      if (filter !== 'all' && r.inChargeId !== filter) return;
      (map[r.dueDate] ||= []).push(r);
    });
    return map;
  }, [rows, filter]);

  const personById = (id) => (users || []).find((u) => u.id === id);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <span className="font-bold text-gray-800 w-36 text-center">{monthLabel}</span>
          <button onClick={() => move(1)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronRight size={16} /></button>
          <button onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })} className="ml-1 px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50">วันนี้</button>
          <input type="month" value={`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`} onChange={(e) => jumpMonth(e.target.value)} className="ml-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
        </div>

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
      </div>

      <div className="flex items-center gap-4 mb-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> ด่วน/เลย due</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 inline-block" /> ใกล้ due</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 inline-block" /> มีเวลา</span>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((w) => <div key={w} className="text-center text-[11px] font-bold text-gray-400 py-1">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const items = (byDay[cell.key] || []);
          const worst = items.reduce((acc, r) => {
            const sev = dueSeverity(r.dueDate, r.status);
            const rank = { danger: 0, warn: 1, ok: 2, none: 3, done: 4 };
            return rank[sev] < rank[acc] ? sev : acc;
          }, 'none');
          const isToday = cell.key === tKey;
          return (
            <div key={cell.key} className={`min-h-[84px] rounded-lg border p-1.5 ${cell.inMonth ? DAY_TINT[worst] : 'bg-gray-50/50 border-gray-100 opacity-50'} ${isToday ? 'ring-2 ring-blue-400' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold ${isToday ? 'text-blue-600' : cell.inMonth ? 'text-gray-600' : 'text-gray-300'}`}>{cell.day}</span>
                {items.length > 0 && <span className="text-[9px] font-bold text-gray-400">{items.length} งาน</span>}
              </div>
              {items.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {(expandedDay === cell.key ? items : items.slice(0, 3)).map((r) => {
                    const sev = dueSeverity(r.dueDate, r.status);
                    const person = personById(r.inChargeId);
                    return (
                      <button key={r.id} onClick={() => onOpenAeBoard?.()} title={`${r.workDetails || r.project} • ${person?.name || ''}`}
                        className={`w-full flex items-center gap-1 text-left text-[9px] truncate px-1 py-0.5 rounded ${CHIP_TINT[sev]} hover:opacity-80`}>
                        <Avatar user={person} size={11} />
                        <span className="truncate">{r.workDetails || r.project || 'งาน'}</span>
                      </button>
                    );
                  })}
                  {items.length > 3 && (
                    <button onClick={() => setExpandedDay(expandedDay === cell.key ? null : cell.key)}
                      className="text-[9px] font-bold text-blue-500 hover:underline">
                      {expandedDay === cell.key ? 'ย่อ' : `+${items.length - 3} อื่นๆ`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
