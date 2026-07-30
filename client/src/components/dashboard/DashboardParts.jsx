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

export function SectionCard({ title, subtitle, icon, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">{icon}{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}
