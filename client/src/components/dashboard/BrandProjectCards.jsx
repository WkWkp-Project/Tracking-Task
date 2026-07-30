import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, FolderPlus, Tag } from 'lucide-react';
import api from '../../api/client.js';

const CLOSED = new Set(['Done', 'Cancelled']);

function taskProgress(task) {
  if (task.status === 'Done') return 100;
  const drafts = task.drafts || [];
  const estimated = drafts.reduce((sum, draft) => sum + (Number(draft.estDays) || 0) * 8 + (Number(draft.estHours) || 0), 0);
  const logged = drafts.reduce((sum, draft) => sum + (Number(draft.loggedHours) || 0), 0);
  if (estimated > 0) return Math.min(99, Math.round((logged / estimated) * 100));
  const taskEstimate = Number(task.estimatedHours) || 0;
  return taskEstimate > 0 ? Math.min(99, Math.round(((Number(task.loggedHours) || 0) / taskEstimate) * 100)) : 0;
}

export default function BrandProjectCards({
  mode = 'pm',
  projects = [],
  brands = [],
  onOpenProject,
  onOpenBrand,
  onManageBrands,
  onNewProject,
}) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let active = true;
    const request = mode === 'ae' ? api.aeTasks() : api.tasks();
    request
      .then(({ tasks: rows }) => { if (active) setTasks(rows || []); })
      .catch(() => { if (active) setTasks([]); });
    return () => { active = false; };
  }, [mode, projects.length]);

  const groups = useMemo(() => {
    if (mode === 'ae') {
      const map = new Map();
      tasks.forEach((task) => {
        const brand = task.project?.trim() || 'ไม่ระบุแบรนด์';
        if (!map.has(brand)) map.set(brand, []);
        map.get(brand).push(task);
      });
      return [...map.entries()]
        .map(([brand, rows]) => {
          const open = rows.filter((task) => task.status !== 'done').length;
          const danger = rows.filter((task) => {
            if (task.status === 'done') return false;
            const overdue = task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);
            return task.priority === 'urgent' || overdue;
          }).length;
          const done = rows.length - open;
          const logoUrl = brands.find((entry) => entry.name?.trim().toLowerCase() === brand.toLowerCase())?.logoUrl || '';
          return {
            brand,
            logoUrl,
            projects: [{
              id: `ae:${brand}`,
              name: 'งานประสานงาน AE',
              taskCount: rows.length,
              open,
              danger,
              progress: rows.length ? Math.round((done / rows.length) * 100) : 0,
            }],
          };
        })
        .sort((a, b) => a.brand.localeCompare(b.brand, 'th'));
    }

    const map = new Map();
    projects.forEach((project) => {
      const brand = project.brand?.trim() || 'ไม่ระบุแบรนด์';
      if (!map.has(brand)) map.set(brand, []);
      const projectTasks = tasks.filter((task) => task.projectId === project.id && task.status !== 'Cancelled');
      const open = projectTasks.filter((task) => !CLOSED.has(task.status)).length;
      const danger = projectTasks.filter((task) => !CLOSED.has(task.status) && ['Critical', 'High'].includes(task.risk?.level)).length;
      const progress = projectTasks.length
        ? Math.round(projectTasks.reduce((sum, task) => sum + taskProgress(task), 0) / projectTasks.length)
        : 0;
      map.get(brand).push({ ...project, taskCount: projectTasks.length, open, danger, progress });
    });
    return [...map.entries()]
      .map(([brand, rows]) => ({
        brand,
        logoUrl: rows.find((project) => project.logoUrl)?.logoUrl || '',
        projects: rows.sort((a, b) => a.name.localeCompare(b.name, 'th')),
      }))
      .sort((a, b) => a.brand.localeCompare(b.brand, 'th'));
  }, [mode, projects, tasks, brands]);

  const sideLabel = mode === 'ae' ? 'AE' : 'PM';

  return (
    <section className="pt-1" aria-labelledby="brand-workspaces-title">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{sideLabel} brand workspaces</p>
          <h3 id="brand-workspaces-title" className="text-lg font-black text-gray-950 dark:text-white mt-0.5">แบรนด์และโปรเจกต์</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">แสดงเฉพาะงานฝั่ง {sideLabel} — ไม่รวมตัวเลขจากอีกฝั่ง</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onManageBrands} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[10px] font-bold text-gray-600 dark:text-zinc-300 hover:text-blue-600 flex items-center gap-1.5">
            <Tag size={13} /> จัดการแบรนด์
          </button>
          <button onClick={onNewProject} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
            <FolderPlus size={13} /> {mode === 'ae' ? 'เปิดตารางงาน AE' : 'เพิ่มโปรเจกต์ PM'}
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-10 text-center">
          <BriefcaseBusiness size={22} className="mx-auto text-gray-300" />
          <p className="text-xs text-gray-400 mt-2">ยังไม่มีแบรนด์หรือโปรเจกต์</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((group) => (
            <article key={group.brand} className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                {group.logoUrl ? (
                  <img src={group.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100 dark:border-zinc-700" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-teal-400 text-white grid place-items-center text-sm font-black">{group.brand.charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-gray-950 dark:text-white truncate">{group.brand}</h4>
                  <p className="text-[9px] text-gray-400">{mode === 'ae' ? `${group.projects[0]?.taskCount || 0} งาน AE ในแบรนด์นี้` : `${group.projects.length} โปรเจกต์ PM ในแบรนด์นี้`}</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${mode === 'ae' ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'}`}>{sideLabel} workspace</span>
              </div>

              <div className="px-3 py-2.5 bg-gray-50/70 dark:bg-black/10">
                <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-3">
                  {mode === 'ae' ? 'งาน AE ภายใต้แบรนด์' : 'โปรเจกต์ภายใต้แบรนด์'}
                </p>
                <div className={`ml-1.5 pl-2.5 border-l-2 space-y-1 ${mode === 'ae' ? 'border-violet-200 dark:border-violet-900' : 'border-blue-200 dark:border-blue-900'}`}>
                  {group.projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => mode === 'ae' ? onOpenBrand?.(group.brand) : onOpenProject?.(project)}
                      className="w-full text-left p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-200 dark:hover:border-blue-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-bold text-gray-900 dark:text-zinc-100 truncate">{project.name}</p>
                            {project.danger > 0 && <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-[8px] font-bold text-red-600 dark:text-red-300">{project.danger} เสี่ยง</span>}
                          </div>
                          <p className="text-[9px] text-gray-400 mt-0.5">{project.open} งาน{sideLabel}ที่ยังไม่ปิด · ทั้งหมด {project.taskCount} งาน</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-400" style={{ width: `${project.progress}%` }} />
                            </div>
                            <span className="w-8 text-right text-[9px] font-black text-blue-600 dark:text-blue-300">{project.progress}%</span>
                          </div>
                        </div>
                        <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 group-hover:bg-blue-600 group-hover:text-white grid place-items-center transition-colors shrink-0">
                          <ArrowUpRight size={13} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
