import React from 'react';
import { Avatar } from '../ui.jsx';

export function StatCard({ label, value, sub, tone = 'default', icon }) {
  const tones = {
    default: 'bg-white border-gray-200 text-gray-900',
    danger: 'bg-red-50 border-red-200 text-red-700',
    warn: 'bg-amber-50 border-amber-200 text-amber-700',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info: 'bg-violet-50 border-violet-200 text-violet-700',
  };
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 flex items-center gap-1">{icon}{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export function MiniBar({ segments, total }) {
  if (!total) return <div className="h-1.5 rounded-full bg-gray-100 w-full" />;
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex w-full">
      {segments.filter((s) => s.count > 0).map((s, i) => (
        <div key={i} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
      ))}
    </div>
  );
}

export function PersonRow({ person, total, segments, chips }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <Avatar user={person} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-800 truncate">{person?.name || 'ไม่ระบุ'}</span>
          <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{total} งาน</span>
        </div>
        <div className="mt-1.5"><MiniBar segments={segments} total={total} /></div>
        {chips?.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">{chips}</div>
        )}
      </div>
    </div>
  );
}

export function SectionCard({ title, subtitle, icon, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-sm ${className}`}>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">{icon}{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}

export function ProjectProgress({ value = 0, done = 0, active = 0, waiting = 0, compact = false }) {
  const safe = Math.max(0, Math.min(100, Math.round(value || 0)));
  const total = Math.max(1, done + active + waiting);
  return (
    <div className={`w-full ${compact ? 'min-w-[112px]' : ''}`} aria-label={`ความคืบหน้า ${safe}%`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`${compact ? 'text-2xl' : 'text-4xl'} font-black text-gray-950 dark:text-white tabular-nums leading-none`}>{safe}<span className="text-sm text-gray-400">%</span></p>
          <p className="text-[9px] text-gray-400 mt-1">Project completed</p>
        </div>
        {!compact && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-full">{done + active + waiting} tasks</span>}
      </div>
      <div className={`${compact ? 'h-2' : 'h-3'} mt-3 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden flex gap-0.5 p-0.5`}>
        {done > 0 && <span className="h-full rounded-full bg-blue-600" style={{ width: `${(done / total) * 100}%` }} />}
        {active > 0 && <span className="h-full rounded-full bg-teal-400" style={{ width: `${(active / total) * 100}%` }} />}
        {waiting > 0 && <span className="h-full rounded-full bg-gray-300 dark:bg-zinc-600" style={{ width: `${(waiting / total) * 100}%` }} />}
        {done + active + waiting === 0 && <span className="h-full rounded-full bg-gray-200 dark:bg-zinc-700" style={{ width: `${safe}%` }} />}
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-2 text-center"><b className="block text-lg text-blue-600">{done}</b><span className="text-[9px] text-gray-500 dark:text-zinc-400">เสร็จแล้ว</span></div>
          <div className="rounded-xl bg-teal-50 dark:bg-teal-950/30 p-2 text-center"><b className="block text-lg text-teal-500">{active}</b><span className="text-[9px] text-gray-500 dark:text-zinc-400">กำลังทำ</span></div>
          <div className="rounded-xl bg-gray-100 dark:bg-zinc-800 p-2 text-center"><b className="block text-lg text-gray-500 dark:text-zinc-300">{waiting}</b><span className="text-[9px] text-gray-500 dark:text-zinc-400">รอเริ่ม</span></div>
        </div>
      )}
    </div>
  );
}
