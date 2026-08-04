import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import api from '../api/client.js';
import { Avatar, RiskBadge, Spinner } from './ui.jsx';
import { fmtDate } from '../utils.js';
import {
  DEFAULT_KANBAN_COLUMNS,
  groupTasksByColumn,
  replaceTaskCard,
  resolveKanbanMove,
  restoreKanbanColumns,
} from '../kanbanModel.js';

function BoardError({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
      <p className="text-sm font-bold text-red-700">{message}</p>
      <button onClick={onRetry} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">
        Retry
      </button>
    </div>
  );
}

export default function KanbanBoard({ users, projects, currentUser, onOpenTask, onAddTask, onChanged, refreshKey = 0 }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [columns, setColumns] = useState(() => restoreKanbanColumns());
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const canConfigure = ['pm', 'admin'].includes(currentUser?.role);

  const load = useCallback(async () => {
    setError('');
    try {
      const [{ tasks: rows }, config] = await Promise.all([
        api.tasks(),
        api.kanbanConfig(),
      ]);
      setTasks(rows);
      setColumns(restoreKanbanColumns(config.columns));
    } catch (err) {
      setError(err.message || 'Unable to load the board');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const visibleTasks = useMemo(
    () => (tasks || []).filter((task) => !projectId || task.projectId === projectId),
    [tasks, projectId]
  );

  const archiveCount = visibleTasks.filter((task) =>
    ['Cancelled', 'Archive'].includes(task.status)
  ).length;
  const tasksByColumn = useMemo(
    () => groupTasksByColumn(visibleTasks, columns),
    [visibleTasks, columns]
  );

  const updateTaskStatus = async (task, nextStatus) => {
    if (nextStatus === task.status) return;
    if (!task.workflow?.allowedTransitions?.includes(nextStatus)) {
      setError(`ย้าย "${task.title}" จาก ${task.status} ไป ${nextStatus} ไม่ได้ กรุณาใช้ transition ที่ workflow อนุญาต`);
      return;
    }
    setBusyTaskId(task.id);
    setError('');
    try {
      const { task: updated } = await api.updateTask(task.id, { status: nextStatus });
      setTasks((current) => replaceTaskCard(current, updated));
      onChanged?.(updated);
    } catch (err) {
      setError(err.message || 'Unable to move task');
    } finally {
      setBusyTaskId(null);
    }
  };

  const moveTask = async (task, column) => {
    const move = resolveKanbanMove(task, column);
    if (move.noop) return;
    if (!move.allowed) {
      setError(`ย้าย "${task.title}" จาก ${task.status} ไป ${move.nextStatus} ไม่ได้ กรุณาใช้ transition ที่ workflow อนุญาต`);
      return;
    }
    await updateTaskStatus(task, move.nextStatus);
  };

  const saveColumns = async (next) => {
    setConfigSaving(true);
    setError('');
    try {
      const preferences = next.map(({ id, label, visible }) => ({ id, label, visible }));
      const result = await api.updateKanbanConfig(preferences);
      setColumns(restoreKanbanColumns(result.columns));
      setConfigOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save board configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  if (!tasks && !error) return <Spinner label="Loading board..." />;
  if (!tasks && error) return <BoardError message={error} onRetry={load} />;

  const displayedColumns = columns.filter(
    (column) => column.visible && (!column.archive || showArchive)
  );

  return (
    <div className="max-w-[1500px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-xs font-bold text-blue-600">PM KANBAN</p>
          <h3 className="mt-1 text-xl font-black text-gray-950 dark:text-white">บอร์ดงานครีเอทีฟ</h3>
          <p className="mt-1 text-xs text-gray-400">1 การ์ด = 1 งาน · เพิ่ม draft/ขั้นตอนไม่สร้างการ์ดซ้ำ · ลากได้เฉพาะ transition ที่ workflow อนุญาต</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="min-w-[180px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 lg:flex-none"
          >
            <option value="">ทุกโปรเจกต์</option>
            {(projects || []).map((project) => (
              <option key={project.id} value={project.id}>{project.brand}: {project.name}</option>
            ))}
          </select>
          <button
            onClick={() => onAddTask?.(projectId)}
            disabled={!projectId}
            title={projectId ? 'Add a task to the selected project' : 'Select a project first'}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} /> Add Task
          </button>
          <button onClick={() => setShowArchive((value) => !value)} className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {showArchive ? <EyeOff size={13} /> : <Eye size={13} />}
            {showArchive ? 'ซ่อนงานเก็บถาวร' : `เก็บถาวร (${archiveCount})`}
          </button>
          {canConfigure && (
            <button onClick={() => setConfigOpen(true)} className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <Settings2 size={13} /> ตั้งค่าบอร์ด
            </button>
          )}
          <button onClick={load} className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800" aria-label="Refresh board">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && <BoardError message={error} onRetry={load} />}

      <div className="flex gap-3 overflow-x-auto rounded-[28px] border border-gray-200 bg-white p-4 pb-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {displayedColumns.map((column) => {
          const rows = tasksByColumn.get(column.id) || [];
          return (
            <section
              key={column.id}
              className={`w-[270px] shrink-0 rounded-2xl border p-2.5 ${
                column.archive
                  ? 'border-slate-300 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-950/50'
                  : 'border-gray-200 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-950/40'
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const task = tasks.find((item) => item.id === event.dataTransfer.getData('text/task-id'));
                if (task) moveTask(task, column);
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-700 dark:text-zinc-200">
                  {column.archive && <Archive size={13} />} {column.label}
                </h4>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-zinc-800">{rows.length}</span>
              </div>
              <div className="space-y-2 min-h-[88px]">
                {rows.map((task) => {
                  const assignee = users.find((user) => user.id === task.assigneeId);
                  const project = projects.find((item) => item.id === task.projectId);
                  return (
                    <article
                      key={task.id}
                      draggable={!busyTaskId}
                      onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                      className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 ${
                        busyTaskId === task.id ? 'opacity-50' : 'cursor-grab'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button onClick={() => onOpenTask(task.id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-[10px] font-bold uppercase tracking-wide text-blue-600">
                            {project ? `${project.brand}: ${project.name}` : 'Unknown project'}
                          </p>
                          <h5 className="mt-0.5 text-sm font-black leading-snug text-gray-900 dark:text-white">{task.title}</h5>
                        </button>
                        <button onClick={() => onOpenTask(task.id)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" aria-label={`Edit ${task.title}`}>
                          <Pencil size={13} />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar user={assignee} size={20} />
                          <span className="truncate text-[10px] text-gray-500">{assignee?.name || 'Unassigned'}</span>
                        </div>
                        <RiskBadge level={task.risk?.level} />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-gray-500">
                        <span>ส่ง <b className="text-gray-700 dark:text-zinc-200">{fmtDate(task.endDate) || '—'}</b></span>
                        <span className="text-right"><b className="text-gray-700 dark:text-zinc-200">{task.loggedHours || 0}/{task.estimatedHours || 0}h</b></span>
                        <span>ตรงเวลา <b className="text-gray-700 dark:text-zinc-200">{Math.round((task.risk?.onTimeProbability || 0) * 100)}%</b></span>
                        <span className="text-right capitalize">Priority <b className={task.priority === 'high' ? 'text-red-600' : 'text-gray-700 dark:text-zinc-200'}>{task.priority === 'high' ? 'สูง' : task.priority === 'low' ? 'ต่ำ' : 'ปกติ'}</b></span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-zinc-700">
                        <select
                          value={task.status}
                          disabled={busyTaskId === task.id || !(task.workflow?.allowedTransitions?.length)}
                          onChange={(event) => updateTaskStatus(task, event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          aria-label={`Change status for ${task.title}`}
                        >
                          <option value={task.status}>{task.status}</option>
                          {(task.workflow?.allowedTransitions || []).map((status) => (
                            <option key={status} value={status}>→ {status}</option>
                          ))}
                        </select>
                        <span className="shrink-0 text-[9px] font-bold text-gray-400">{task.drafts?.length || 0} ขั้นตอน</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {configOpen && canConfigure && (
        <BoardConfig
          columns={columns}
          saving={configSaving}
          onClose={() => setConfigOpen(false)}
          onSave={saveColumns}
        />
      )}
    </div>
  );
}

function BoardConfig({ columns, saving, onClose, onSave }) {
  const [draft, setDraft] = useState(columns);

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-zinc-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h3 className="font-black text-gray-900 dark:text-white">ตั้งค่าคอลัมน์บอร์ด</h3>
            <p className="text-[11px] text-gray-500">ปรับชื่อ ลำดับ และการแสดงผลเท่านั้น · ไม่เพิ่มการ์ดและไม่เปลี่ยนสถานะหลักของ Workflow</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>
        <div className="space-y-2 p-5">
          {draft.map((column, index) => (
            <div key={column.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-gray-200 p-2 dark:border-zinc-700">
              <div>
                <input
                  value={column.label}
                  onChange={(event) => setDraft((current) => current.map((item) => item.id === column.id ? { ...item, label: event.target.value.slice(0, 40) } : item))}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-800"
                />
                <p className="mt-1 text-[9px] text-gray-400">{column.statuses.join(' + ')}</p>
              </div>
              <button
                onClick={() => setDraft((current) => current.map((item) => item.id === column.id ? { ...item, visible: !item.visible } : item))}
                disabled={column.archive}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-40 dark:border-zinc-700"
                title={column.archive ? 'Archive visibility is controlled from the board' : 'Toggle column'}
              >
                {column.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <div className="flex">
                <button onClick={() => move(index, -1)} className="p-1 text-gray-500" aria-label="Move left"><ArrowLeft size={14} /></button>
                <button onClick={() => move(index, 1)} className="p-1 text-gray-500" aria-label="Move right"><ArrowRight size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-zinc-800">
          <button onClick={() => setDraft(DEFAULT_KANBAN_COLUMNS)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold dark:border-zinc-700">คืนค่าเริ่มต้น</button>
          <button disabled={saving} onClick={() => onSave(draft.map((column) => ({ ...column, label: column.label.trim() || DEFAULT_KANBAN_COLUMNS.find((item) => item.id === column.id).label })))} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}
