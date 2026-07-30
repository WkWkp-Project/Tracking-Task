import React, { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react';
import { Avatar } from './ui.jsx';

const DAY = 86400000;

function progress(task) {
  if (task.status === 'Done') return 100;
  const drafts = task.drafts || [];
  const draftEst = drafts.reduce((sum, draft) => sum + (Number(draft.estDays) || 0) * 8 + (Number(draft.estHours) || 0), 0);
  const draftLogged = drafts.reduce((sum, draft) => sum + (Number(draft.loggedHours) || 0), 0);
  if (draftEst > 0) return Math.min(99, Math.round((draftLogged / draftEst) * 100));
  const est = Number(task.estimatedHours) || 0;
  return est ? Math.min(99, Math.round(((Number(task.loggedHours) || 0) / est) * 100)) : 0;
}

export default function ProjectTimeline({ project, tasks, users, onAddTask, onOpenTask }) {
  const bounds = useMemo(() => {
    if (!tasks.length) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      return { start, days: 35 };
    }
    const starts = tasks.map((t) => new Date(`${t.startDate}T00:00:00`).getTime());
    const ends = tasks.map((t) => new Date(`${t.endDate}T00:00:00`).getTime());
    const start = new Date(Math.min(...starts) - DAY * 2);
    const end = new Date(Math.max(...ends) + DAY * 3);
    return { start, days: Math.max(21, Math.round((end - start) / DAY)) };
  }, [tasks]);

  const ticks = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const date = new Date(bounds.start.getTime() + (bounds.days * i / 5) * DAY);
    return { date, left: i * 20 };
  }), [bounds]);

  const todayLeft = ((new Date().setHours(0, 0, 0, 0) - bounds.start.getTime()) / DAY / bounds.days) * 100;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold text-blue-600">PROJECT TIMELINE</p>
          <h2 className="text-2xl font-bold text-gray-950 dark:text-white mt-1">{project ? `${project.brand} · ${project.name}` : 'เลือกโปรเจกต์'}</h2>
          <p className="text-xs text-gray-400 mt-1">กดที่แถบงานเพื่อดู progress และรายละเอียดทั้งหมด</p>
        </div>
        <button onClick={onAddTask} disabled={!project} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm">
          <Plus size={16} /> เพิ่มงาน
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-[28px] p-4 sm:p-7 shadow-sm overflow-hidden">
        <div className="flex gap-2 mb-7 overflow-x-auto pb-1">
          <span className="px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap"><CalendarDays size={14} /> Project timeline</span>
        </div>

        <div className="relative min-w-[720px] min-h-[390px] rounded-3xl bg-gray-50/70 dark:bg-black/20 border border-gray-100 dark:border-zinc-800 px-5 py-8 overflow-hidden">
          {ticks.map((tick) => (
            <div key={tick.left} className="absolute top-0 bottom-9 border-l border-dashed border-gray-200 dark:border-zinc-800" style={{ left: `${tick.left}%` }}>
              <span className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400">{tick.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
          {todayLeft >= 0 && todayLeft <= 100 && (
            <div className="absolute top-3 bottom-9 border-l-2 border-dashed border-blue-900/60 z-10" style={{ left: `${todayLeft}%` }}>
              <span className="absolute -top-1 -left-[5px] w-2.5 h-2.5 bg-blue-900 rounded-full" />
              <span className="absolute -bottom-5 -translate-x-1/2 text-[9px] font-bold text-blue-700">วันนี้</span>
            </div>
          )}

          <div className="relative z-20 space-y-5 pt-2">
            {tasks.length === 0 ? (
              <div className="h-56 grid place-items-center text-sm text-gray-400">ยังไม่มีงานในโปรเจกต์นี้</div>
            ) : tasks.map((task, index) => {
              const start = (new Date(`${task.startDate}T00:00:00`) - bounds.start) / DAY;
              const duration = Math.max(2, (new Date(`${task.endDate}T00:00:00`) - new Date(`${task.startDate}T00:00:00`)) / DAY + 1);
              const left = Math.max(0, (start / bounds.days) * 100);
              const width = Math.max(20, Math.min(66, (duration / bounds.days) * 100));
              const person = users.find((u) => u.id === task.assigneeId);
              const pct = progress(task);
              const colors = ['bg-blue-600', 'bg-teal-500', 'bg-violet-600', 'bg-orange-500'];
              const fillColor = colors[index % colors.length];
              return (
                <button key={task.id} onClick={() => onOpenTask?.(task.id)}
                  className="relative h-14 rounded-full overflow-hidden border border-gray-300 dark:border-zinc-600 bg-gray-400 dark:bg-zinc-700 text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all flex items-center gap-2 px-3 text-left"
                  style={{ marginLeft: `${left}%`, width: `${Math.min(width, 100 - left)}%`, minWidth: 220 }}>
                  <span className={`absolute inset-y-0 left-0 ${fillColor} rounded-full transition-[width] duration-500`} style={{ width: `${pct}%` }} aria-hidden="true" />
                  <span className="relative z-10 shrink-0"><Avatar user={person} size={30} /></span>
                  <div className="relative z-10 min-w-0 flex-1 drop-shadow-[0_1px_1px_rgba(0,0,0,.45)]">
                    <p className="text-xs font-bold truncate">{task.title}</p>
                    <p className="text-[9px] opacity-90">{task.startDate} – {task.endDate}</p>
                  </div>
                  <span className="relative z-10 px-2.5 py-1 bg-black/20 border border-white/20 rounded-full text-[9px] font-bold whitespace-nowrap">{pct}%</span>
                  <span className="relative z-10 w-7 h-7 rounded-full bg-black/25 grid place-items-center shrink-0" aria-hidden="true"><ArrowUpRight size={14} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
