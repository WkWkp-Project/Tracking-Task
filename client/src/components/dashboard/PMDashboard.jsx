import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BriefcaseBusiness, CalendarClock,
  Clock3, ListChecks, RefreshCw, Sparkles, UsersRound,
} from 'lucide-react';
import api from '../../api/client.js';
import { Avatar, Spinner } from '../ui.jsx';
import { SectionCard } from './DashboardParts.jsx';
import BrandProjectCards from './BrandProjectCards.jsx';

const ACTIVE = new Set(['To Do', 'Draft 1', 'Draft 2', 'Final', 'Client Review', 'Approval']);

function taskProgress(task) {
  if (task.status === 'Done') return 100;
  const drafts = task.drafts || [];
  const estimated = drafts.reduce((sum, draft) => sum + (Number(draft.estDays) || 0) * 8 + (Number(draft.estHours) || 0), 0);
  const logged = drafts.reduce((sum, draft) => sum + (Number(draft.loggedHours) || 0), 0);
  if (estimated > 0) return Math.min(99, Math.round((logged / estimated) * 100));
  const taskEstimate = Number(task.estimatedHours) || 0;
  return taskEstimate > 0 ? Math.min(99, Math.round(((Number(task.loggedHours) || 0) / taskEstimate) * 100)) : 0;
}

function dangerScore(task) {
  const level = { Critical: 1000, High: 700, Medium: 250, Low: 0 }[task.risk?.level] || 0;
  const priority = { high: 400, normal: 50, low: 0 }[task.priority] || 0;
  const days = task.risk?.calendarDaysLeft;
  const deadline = Number.isFinite(days) ? Math.max(0, 30 - days) * 5 : 0;
  return level + priority + deadline;
}

function taskSignal(task) {
  const level = task.risk?.level || 'Low';
  const days = task.risk?.calendarDaysLeft;
  if ((days ?? 99) < 0) return { label: `เลยกำหนด ${Math.abs(days)} วัน`, tone: 'danger' };
  if (level === 'Critical') return { label: 'วิกฤต', tone: 'danger' };
  if (level === 'High') return { label: days <= 1 ? `เหลือ ${Math.max(0, days)} วัน` : 'เสี่ยงสูง', tone: 'warn' };
  if (task.priority === 'high') return { label: 'Priority สูง', tone: 'warn' };
  if (days <= 7) return { label: `ส่งใน ${Math.max(0, days)} วัน`, tone: 'soon' };
  return { label: 'ตามแผน', tone: 'normal' };
}

const signalTone = {
  danger: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-200 dark:border-red-900',
  warn: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-900',
  soon: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  normal: 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-300 border-gray-200 dark:border-zinc-700',
};

export default function PMDashboard({ users, projects, refreshKey, onOpenTask, onOpenProject, onManageBrands, onNewProject }) {
  const [tasks, setTasks] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { tasks: rows } = await api.tasks();
      setTasks(rows);
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to load PM dashboard');
    }
  }, []);
  // Reload on mount and whenever refreshKey bumps (a task was edited/deleted
  // from the drawer, a project changed, etc.) so metrics never go stale.
  useEffect(() => { load(); }, [load, refreshKey]);

  const model = useMemo(() => {
    if (!tasks) return null;
    const active = tasks.filter((task) => ACTIVE.has(task.status));
    const projectById = Object.fromEntries((projects || []).map((project) => [project.id, project]));
    const actionQueue = [...active]
      .sort((a, b) => dangerScore(b) - dangerScore(a) || (a.endDate || '').localeCompare(b.endDate || ''))
      .slice(0, 6);

    const workload = (users || [])
      .filter((person) => !person.disabled && !['admin', 'pm', 'ae'].includes(person.role))
      .map((person) => {
        const mine = active.filter((task) => task.assigneeId === person.id);
        const dailyDemand = mine.reduce((sum, task) => {
          const days = Math.max(1, Number(task.risk?.workdaysLeft) || 1);
          return sum + (Number(task.risk?.expectedRemainingHours) || 0) / days;
        }, 0);
        const capacity = Number(person.capacityHoursPerDay) || 8;
        return { person, count: mine.length, percent: Math.min(140, Math.round((dailyDemand / capacity) * 100)) };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.percent - a.percent);

    const dangerCount = active.filter((task) =>
      ['Critical', 'High'].includes(task.risk?.level) || (task.risk?.calendarDaysLeft ?? 1) < 0
    ).length;
    const dueSoonCount = active.filter((task) => {
      const days = task.risk?.calendarDaysLeft;
      return Number.isFinite(days) && days >= 0 && days <= 7;
    }).length;
    const overloadedCount = workload.filter((row) => row.percent > 100).length;
    const activeProjectCount = new Set(active.map((task) => task.projectId)).size;

    return {
      actionQueue, workload, projectById,
      dangerCount, dueSoonCount, overloadedCount, activeProjectCount,
    };
  }, [tasks, users, projects]);

  if (!model && error) return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-bold text-red-700">{error}</p>
      <button onClick={load} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">Retry</button>
    </div>
  );

  if (!model) return <Spinner label="กำลังเตรียม Dashboard…" />;

  return (
    <div className="space-y-5 max-w-[1500px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-blue-600 flex items-center gap-1"><Sparkles size={13} /> PM OVERVIEW</p>
          <h2 className="text-2xl font-bold text-gray-950 dark:text-white mt-1">ภาพรวมที่ต้องตัดสินใจวันนี้</h2>
          <p className="text-xs text-gray-400 mt-1">อัปเดต {loadedAt?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ตัวเลขทั้งหมดคำนวณจากงานที่ยังไม่ปิด</p>
        </div>
        <button onClick={load} className="w-9 h-9 grid place-items-center rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-500 hover:text-blue-600" aria-label="รีเฟรช dashboard">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <OverviewMetric label="งานเสี่ยง" value={model.dangerCount} detail="วิกฤตหรือเสี่ยงสูง" tone="red" icon={<AlertTriangle size={15} />} />
        <OverviewMetric label="ส่งภายใน 7 วัน" value={model.dueSoonCount} detail="ไม่นับงานที่ปิดแล้ว" tone="amber" icon={<CalendarClock size={15} />} />
        <OverviewMetric label="คนที่งานล้น" value={model.overloadedCount} detail="มากกว่า 100% capacity" tone="violet" icon={<UsersRound size={15} />} />
        <OverviewMetric label="โปรเจกต์ที่กำลังเดิน" value={model.activeProjectCount} detail="มีงานที่ยังไม่ปิด" tone="blue" icon={<BriefcaseBusiness size={15} />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <SectionCard
          title="งานที่ต้องจัดการก่อน"
          subtitle="เรียงจากความเสี่ยง Priority และกำหนดส่ง"
          icon={<ListChecks size={17} className="text-blue-600" />}
          className="md:col-span-2"
        >
          <div className="space-y-2">
            {model.actionQueue.length === 0 ? <Empty text="ไม่มีงานค้างที่ต้องจัดการ" /> : model.actionQueue.map((task, index) => (
              <ActionTask
                key={task.id}
                index={index}
                task={task}
                person={users.find((person) => person.id === task.assigneeId)}
                project={model.projectById[task.projectId]}
                onOpen={() => onOpenTask?.(task.id)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="ภาระทีม"
          subtitle="เรียงจากคนที่รับงานเกินกำลังก่อน"
          icon={<UsersRound size={17} className="text-teal-500" />}
        >
          <div className="space-y-4">
            {model.workload.length === 0 ? <Empty text="ยังไม่มีสมาชิกที่ถืองาน" /> : model.workload.map(({ person, count, percent }) => (
              <div key={person.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar user={person} size={27} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">{person.name}</p>
                    <p className="text-[9px] text-gray-400">{count} งานที่ยังไม่ปิด</p>
                  </div>
                  <span className={`text-xs font-black tabular-nums ${percent > 100 ? 'text-red-500' : percent > 80 ? 'text-amber-500' : 'text-emerald-500'}`}>{percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div className={`h-full rounded-full ${percent > 100 ? 'bg-red-500' : percent > 80 ? 'bg-amber-400' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <BrandProjectCards
        mode="pm"
        projects={projects}
        refreshKey={refreshKey}
        onOpenProject={onOpenProject}
        onManageBrands={onManageBrands}
        onNewProject={onNewProject}
      />
    </div>
  );
}

function OverviewMetric({ label, value, detail, tone, icon }) {
  const tones = {
    red: 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900',
    amber: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900',
    violet: 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900',
    blue: 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-black mt-1 tabular-nums">{value}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{detail}</p>
    </div>
  );
}

function ActionTask({ index, task, person, project, onOpen }) {
  const progress = taskProgress(task);
  const signal = taskSignal(task);
  return (
    <button onClick={onOpen} className="w-full text-left flex gap-2.5 items-center px-3 py-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
      <span className="w-5 shrink-0 text-[10px] font-black text-gray-300 dark:text-zinc-600 tabular-nums">#{index + 1}</span>
      <span className="shrink-0"><Avatar user={person} size={32} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">{task.title}</p>
          <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[9px] font-bold ${signalTone[signal.tone]}`}>{signal.label}</span>
        </div>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{project?.brand || 'ไม่ระบุโปรเจกต์'} · {person?.name || 'ยังไม่ระบุผู้รับผิดชอบ'} · ส่ง {task.endDate || '—'}</p>
        <Progress value={progress} className="mt-2" />
      </div>
      <span className="ml-auto w-8 shrink-0 text-right text-[10px] font-black text-blue-600 tabular-nums">{progress}%</span>
    </button>
  );
}

function Progress({ value, className = '' }) {
  const safe = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={`h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-400" style={{ width: `${safe}%` }} />
    </div>
  );
}

function Empty({ text }) {
  return <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5"><Clock3 size={14} /> {text}</div>;
}
