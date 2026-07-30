import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../../api/client.js';
import { Avatar, Spinner } from '../ui.jsx';
import { riskStyle, daysLeftText } from '../../utils.js';
import { StatCard, SectionCard, PersonRow } from './DashboardParts.jsx';

const ACTIVE_STATUSES = ['To Do', 'Draft 1', 'Draft 2', 'Final', 'Client Review', 'Approval'];
const RISK_BAR = { Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-amber-400', Low: 'bg-emerald-400', Done: 'bg-gray-300' };

export default function PMDashboard({ users, projects }) {
  const [tasks, setTasks] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  const load = async () => {
    const { tasks } = await api.tasks();
    setTasks(tasks);
    setLoadedAt(new Date());
  };
  useEffect(() => { load(); }, []);

  const projectById = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p])), [projects]);
  const pms = useMemo(() => (users || []).filter((u) => u.role === 'pm' || u.role === 'admin'), [users]);

  const stats = useMemo(() => {
    if (!tasks) return null;
    const active = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
    const overdue = active.filter((t) => (t.risk?.calendarDaysLeft ?? 1) < 0);
    const critHigh = active.filter((t) => ['Critical', 'High'].includes(t.risk?.level));
    const avgOnTime = active.length
      ? Math.round((active.reduce((s, t) => s + (t.risk?.onTimeProbability || 0), 0) / active.length) * 100)
      : 100;

    const byPm = pms.map((pm) => {
      const mine = active.filter((t) => t.pmId === pm.id);
      const segments = ['Critical', 'High', 'Medium', 'Low'].map((lvl) => ({
        label: lvl, color: RISK_BAR[lvl], count: mine.filter((t) => t.risk?.level === lvl).length,
      }));
      return {
        person: pm, total: mine.length, segments,
        critical: mine.filter((t) => t.risk?.level === 'Critical').length,
        high: mine.filter((t) => t.risk?.level === 'High').length,
        overdue: mine.filter((t) => (t.risk?.calendarDaysLeft ?? 1) < 0).length,
      };
    }).sort((a, b) => b.total - a.total);

    const topRisk = [...critHigh]
      .sort((a, b) => (a.risk?.calendarDaysLeft ?? 0) - (b.risk?.calendarDaysLeft ?? 0))
      .slice(0, 8);

    return { active, overdue, critHigh, avgOnTime, byPm, topRisk };
  }, [tasks, pms]);

  if (!stats) return <Spinner label="กำลังสรุปข้อมูล PM…" />;

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
        <StatCard label="งาน PM ที่กำลังทำ" value={stats.active.length} tone="info" />
        <StatCard label="เสี่ยงสูง/วิกฤต" value={stats.critHigh.length} tone={stats.critHigh.length ? 'danger' : 'ok'} />
        <StatCard label="เลยกำหนด" value={stats.overdue.length} tone={stats.overdue.length ? 'danger' : 'ok'} sub={`เฉลี่ยเสร็จทัน ${stats.avgOnTime}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="งานฝั่ง PM ต่อคน" subtitle="โปรเจกต์/งานที่แต่ละ PM ดูแลอยู่ตอนนี้">
          {stats.byPm.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">ยังไม่มี PM ในระบบ</p>
          ) : stats.byPm.map((row) => (
            <PersonRow key={row.person.id} person={row.person} total={row.total} segments={row.segments}
              chips={[
                row.critical > 0 && <span key="c" className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">วิกฤต {row.critical}</span>,
                row.high > 0 && <span key="h" className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">เสี่ยงสูง {row.high}</span>,
                row.overdue > 0 && <span key="o" className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">เลยกำหนด {row.overdue}</span>,
              ].filter(Boolean)} />
          ))}
        </SectionCard>

        <SectionCard title="งานเสี่ยงสูงสุด (PM)" subtitle="เรียงตามวันที่เหลือน้อยที่สุด">
          {stats.topRisk.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 flex items-center justify-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> ไม่มีงานเสี่ยงตอนนี้</p>
          ) : (
            <div className="space-y-2">
              {stats.topRisk.map((t) => {
                const rs = riskStyle(t.risk?.level);
                const assignee = (users || []).find((u) => u.id === t.assigneeId);
                const proj = projectById[t.projectId];
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    {t.risk?.level === 'Critical' ? <AlertCircle size={14} className="text-red-500 shrink-0" /> : <AlertTriangle size={14} className={`${rs.dot} shrink-0`} />}
                    <span className="font-bold text-gray-800 truncate flex-1">{t.title}</span>
                    <span className="text-gray-400 truncate max-w-[100px] hidden sm:block">{proj?.brand}</span>
                    <Avatar user={assignee} size={18} title={assignee?.name} />
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${rs.chip}`}>{daysLeftText(t.risk?.calendarDaysLeft)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
