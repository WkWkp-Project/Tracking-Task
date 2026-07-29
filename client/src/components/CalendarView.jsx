import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarDays } from 'lucide-react';
import api from '../api/client.js';
import { Avatar } from './ui.jsx';
import { fmtDate } from '../utils.js';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// build a YYYY-MM-DD key anchored at UTC-noon (matches the server's day keys)
function keyOf(y, m, d) {
  return new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);
}
function todayKey() {
  const n = new Date();
  return keyOf(n.getFullYear(), n.getMonth(), n.getDate());
}

export default function CalendarView({ projects, onOpenTask, defaultAssigneeId }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(defaultAssigneeId || null);
  const [loading, setLoading] = useState(false);

  // 6-week grid covering the month
  const grid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1, 12));
    const startDow = first.getUTCDay();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setUTCDate(1 - startDow + i);
      cells.push({
        key: d.toISOString().slice(0, 10),
        day: d.getUTCDate(),
        inMonth: d.getUTCMonth() === cursor.m,
      });
    }
    return cells;
  }, [cursor]);

  const rangeFrom = grid[0].key;
  const rangeTo = grid[grid.length - 1].key;

  const load = async () => {
    setLoading(true);
    try {
      const { members } = await api.teamWorkload(rangeFrom, rangeTo);
      setMembers(members);
      if (!selectedId && members.length) {
        // default to the person with the most conflicts (best demo of overload)
        const worst = [...members].sort((a, b) => b.overloadedCount - a.overloadedCount)[0];
        setSelectedId(worst.user.id);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rangeFrom, rangeTo]);

  const selected = members.find((m) => m.user.id === selectedId) || members[0];
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const tKey = todayKey();

  const move = (delta) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const jumpMonth = (val) => {
    const [y, m] = val.split('-').map(Number);
    if (y && m) setCursor({ y, m: m - 1 });
  };
  const projName = (id) => projects.find((p) => p.id === id)?.brand || '';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {/* controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <span className="font-bold text-gray-800 w-36 text-center">{monthLabel}</span>
          <button onClick={() => move(1)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronRight size={16} /></button>
          <button onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })} className="ml-1 px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50">วันนี้</button>
          <input type="month" value={`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`} onChange={(e) => jumpMonth(e.target.value)} className="ml-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
        </div>

        {/* member selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {members.map((m) => (
            <button key={m.user.id} onClick={() => setSelectedId(m.user.id)}
              className={`relative flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border ${selectedId === m.user.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <Avatar user={m.user} size={22} />
              <span className="text-xs font-bold text-gray-700">{m.user.name.split(' ')[0]}</span>
              {m.overloadedCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full">{m.overloadedCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!selected ? (
        <div className="p-8 text-center text-gray-400 text-sm">{loading ? 'กำลังโหลด…' : 'ไม่มีข้อมูล'}</div>
      ) : (
        <>
          {/* legend */}
          <div className="flex items-center gap-4 mb-2 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> ปกติ</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 inline-block" /> เกือบเต็ม</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300 inline-block" /> เกิน capacity (งานชน)</span>
            <span className="ml-auto font-bold">capacity {selected.capacityPerDay} ชม./วัน</span>
          </div>

          {/* weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => <div key={w} className="text-center text-[11px] font-bold text-gray-400 py-1">{w}</div>)}
          </div>

          {/* day cells */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell) => {
              const info = selected.days[cell.key];
              const cap = selected.capacityPerDay;
              const ratio = info ? info.load / cap : 0;
              let bg = 'bg-white';
              if (info) bg = info.over ? 'bg-red-50 border-red-200' : ratio >= 0.8 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100';
              const isToday = cell.key === tKey;
              return (
                <div key={cell.key} className={`min-h-[84px] rounded-lg border p-1.5 ${cell.inMonth ? bg : 'bg-gray-50/50 border-gray-100 opacity-50'} ${isToday ? 'ring-2 ring-blue-400' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${isToday ? 'text-blue-600' : cell.inMonth ? 'text-gray-600' : 'text-gray-300'}`}>{cell.day}</span>
                    {info && <span className={`text-[9px] font-bold ${info.over ? 'text-red-600' : 'text-gray-500'}`}>{info.load}/{cap}h</span>}
                  </div>
                  {info && (
                    <div className="mt-1 space-y-0.5">
                      {info.over && <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-600"><AlertTriangle size={9} /> ชน</div>}
                      {info.tasks.slice(0, 3).map((t) => (
                        <button key={t.taskId} onClick={() => onOpenTask(t.taskId)} title={`${t.title} • ${t.hours}h`}
                          className="w-full text-left text-[9px] truncate px-1 py-0.5 rounded bg-white/70 border border-gray-200 hover:bg-blue-50">
                          {t.title}
                        </button>
                      ))}
                      {info.tasks.length > 3 && <div className="text-[9px] text-gray-400">+{info.tasks.length - 3} อื่นๆ</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* overlap list = "งานที่ชนกันในคนเดียว" */}
          <div className="mt-5">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-amber-500" /> งานที่ทับช่วงเวลากันของ {selected.user.name.split(' ')[0]}
              <span className="text-xs font-normal text-gray-400">({selected.overlaps.length} คู่)</span>
            </h3>
            {selected.overlaps.length === 0 ? (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">ไม่มีงานทับซ้อนกันในช่วงนี้ 🎉</p>
            ) : (
              <div className="space-y-2">
                {selected.overlaps.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                    <button onClick={() => onOpenTask(o.a.id)} className="flex-1 text-left hover:underline">
                      <span className="font-bold text-gray-800">{o.a.title}</span>
                      <span className="text-gray-400 ml-1">[{projName(o.a.projectId)}] {fmtDate(o.a.start)}–{fmtDate(o.a.end)}</span>
                    </button>
                    <span className="text-amber-600 font-bold shrink-0">⇄ ชน</span>
                    <button onClick={() => onOpenTask(o.b.id)} className="flex-1 text-right hover:underline">
                      <span className="font-bold text-gray-800">{o.b.title}</span>
                      <span className="text-gray-400 ml-1">[{projName(o.b.projectId)}] {fmtDate(o.b.start)}–{fmtDate(o.b.end)}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
