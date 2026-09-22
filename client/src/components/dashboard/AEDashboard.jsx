import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import api from '../../api/client.js';
import { Avatar, Spinner } from '../ui.jsx';
import { aePriority, dueSeverity, fmtDate, AE_STATUS } from '../../utils.js';
import { StatCard, SectionCard, PersonRow } from './DashboardParts.jsx';
import BrandProjectCards from './BrandProjectCards.jsx';

const AE_BAR = { not_started: 'bg-gray-300', in_progress: 'bg-violet-400', waiting_client: 'bg-amber-400', waiting_internal: 'bg-amber-400', done: 'bg-emerald-400' };
const DUE_BAR = { danger: 'bg-red-500', warn: 'bg-amber-400', ok: 'bg-emerald-400', done: 'bg-gray-300', none: 'bg-gray-200' };

export default function AEDashboard({ users, projects, brands, refreshKey, onOpenBrand, onManageBrands, onOpenAeBoard }) {
  const [aeRows, setAeRows] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { tasks: ae } = await api.aeTasks();
      setAeRows(ae);
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to load AE dashboard');
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const aePeople = useMemo(() => (users || []).filter((u) => u.role === 'ae'), [users]);

  const stats = useMemo(() => {
    if (!aeRows) return null;
    const notDone = aeRows.filter((r) => r.status !== 'done');
    const urgent = notDone.filter((r) => r.priority === 'urgent');
    const overdue = notDone.filter((r) => dueSeverity(r.dueDate, r.status) === 'danger');

    const byPerson = aePeople.map((p) => {
      const mine = notDone.filter((r) => r.inChargeId === p.id);
      const segments = AE_STATUS.map((s) => ({
        label: s.label, color: AE_BAR[s.key], count: mine.filter((r) => r.status === s.key).length,
      }));
      return {
        person: p, total: mine.length, segments,
        urgent: mine.filter((r) => r.priority === 'urgent').length,
        overdue: mine.filter((r) => dueSeverity(r.dueDate, r.status) === 'danger').length,
      };
    }).sort((a, b) => b.total - a.total);

    const topUrgent = [...notDone]
      .sort((a, b) => {
        const sa = dueSeverity(a.dueDate, a.status), sb = dueSeverity(b.dueDate, b.status);
        const rank = { danger: 0, warn: 1, ok: 2, none: 3, done: 4 };
        return (rank[sa] - rank[sb]) || (a.dueDate || '').localeCompare(b.dueDate || '');
      })
      .slice(0, 8);

    return { notDone, urgent, overdue, byPerson, topUrgent };
  }, [aeRows, aePeople]);

  if (!stats && error) return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-bold text-red-700">{error}</p>
      <button onClick={load} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">Retry</button>
    </div>
  );

  if (!stats) return <Spinner label="กำลังสรุปข้อมูล AE…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          อัปเดตล่าสุด {loadedAt?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1.5">
          <RefreshCw size={13} /> รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="งาน AE ที่กำลังทำ" value={stats.notDone.length} tone="info" />
        <StatCard label="Urgent" value={stats.urgent.length} tone={stats.urgent.length ? 'danger' : 'ok'} />
        <StatCard label="ใกล้/เลย due" value={stats.overdue.length} tone={stats.overdue.length ? 'danger' : 'ok'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="งานฝั่ง AE ต่อคน" subtitle="สถานะงานของแต่ละ Account Executive">
          {stats.byPerson.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">ยังไม่มี AE ในระบบ</p>
          ) : stats.byPerson.map((row) => (
            <PersonRow key={row.person.id} person={row.person} total={row.total} segments={row.segments}
              chips={[
                row.urgent > 0 && <span key="u" className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Urgent {row.urgent}</span>,
                row.overdue > 0 && <span key="o" className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ใกล้/เลย due {row.overdue}</span>,
              ].filter(Boolean)} />
          ))}
        </SectionCard>

        <SectionCard title="งาน AE ที่ต้องตามด่วน" subtitle="เรียงตามความเร่งด่วนของ due date">
          {stats.topUrgent.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 flex items-center justify-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> ไม่มีงานค้างตอนนี้</p>
          ) : (
            <div className="space-y-2">
              {stats.topUrgent.map((r) => {
                const sev = dueSeverity(r.dueDate, r.status);
                const pri = aePriority(r.priority);
                const person = (users || []).find((u) => u.id === r.inChargeId);
                return (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${pri.dot}`} />
                    <span className="font-bold text-gray-800 truncate flex-1">{r.workDetails || r.project || 'งานไม่มีชื่อ'}</span>
                    <span className="text-gray-400 truncate max-w-[100px] hidden sm:block">{r.project}</span>
                    <Avatar user={person} size={18} title={person?.name} />
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 ${DUE_BAR[sev]} ${sev === 'ok' ? 'text-emerald-900' : 'text-white'}`}>
                      <Clock size={9} />{fmtDate(r.dueDate) || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <BrandProjectCards
        mode="ae"
        projects={projects}
        brands={brands}
        refreshKey={refreshKey}
        onOpenBrand={onOpenBrand}
        onManageBrands={onManageBrands}
        onNewProject={onOpenAeBoard}
      />
    </div>
  );
}
