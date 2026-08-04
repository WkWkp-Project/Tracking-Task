import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, FolderPlus, Settings, MessageSquare, LogOut,
  X, CalendarDays, GanttChartSquare, ChevronDown, Moon, Sun, Layers3, Columns3,
} from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Spinner } from '../components/ui.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import TeamModal from '../components/TeamModal.jsx';
import NewTaskModal from '../components/NewTaskModal.jsx';
import TaskDrawer from '../components/TaskDrawer.jsx';
import CalendarView from '../components/CalendarView.jsx';
import ProjectModal from '../components/ProjectModal.jsx';
import AEBoard from '../components/AEBoard.jsx';
import AECalendarView from '../components/AECalendarView.jsx';
import PMDashboard from '../components/dashboard/PMDashboard.jsx';
import AEDashboard from '../components/dashboard/AEDashboard.jsx';
import BrandsModal from '../components/BrandsModal.jsx';
import ProjectTimeline from '../components/ProjectTimeline.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import useDashboardData from '../hooks/useDashboardData.js';
import { resolveBrandName } from '../brand.js';
import { Pencil, Link as LinkIcon, ClipboardList } from 'lucide-react';

const PM_NAV = [
  { key: 'dashboard-pm', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { key: 'timeline', label: 'ไทม์ไลน์', icon: GanttChartSquare },
  { key: 'calendar', label: 'ปฏิทิน', icon: CalendarDays },
  { key: 'board', label: 'Kanban', icon: Columns3 },
];
const AE_NAV = [
  { key: 'dashboard-ae', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { key: 'calendar-ae', label: 'ปฏิทิน', icon: CalendarDays },
  { key: 'ae', label: 'ตารางงาน', icon: ClipboardList },
];

// collapsible nav drawer — keeps the sidebar from showing both PM and AE
// item lists at once; only the relevant group needs to stay open
function NavGroup({ label, items, open, onToggle, view, onSelect }) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-2 py-1 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden min-h-0">
          <div className="space-y-0.5">
            {items.map((item) => (
              <button key={item.key} onClick={() => onSelect(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  view === item.key
                    ? 'bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)]'
                    : 'text-gray-600 dark:text-zinc-300 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-zinc-800'
                }`}>
                <item.icon size={16} className="shrink-0" /> {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState(null);
  const {
    projects,
    users,
    brands,
    googleStatus,
    status: coreStatus,
    error: coreError,
    tasks,
    taskStatus,
    taskError,
    reloadCore: loadCore,
    reloadTasks: loadTasks,
    clearTasks,
  } = useDashboardData(selected?.id);
  const [boardVersion, setBoardVersion] = useState(0);

  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [drawerProjectId, setDrawerProjectId] = useState(null);
  const [showTeam, setShowTeam] = useState(false);
  const [showBrands, setShowBrands] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskProject, setNewTaskProject] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [aeBrandFilter, setAeBrandFilter] = useState(null);
  const [chat, setChat] = useState({ open: false, presetUserId: null });
  const [theme, setTheme] = useState(() => localStorage.getItem('pmhub_theme') || 'light');
  // AE-role lands on the AE side by default; everyone else lands on the PM dashboard
  const [view, setView] = useState(user.role === 'ae' ? 'dashboard-ae' : 'dashboard-pm');
  // 'dashboard-pm' | 'dashboard-ae' | 'timeline' | 'calendar' | 'calendar-ae' | 'ae'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('pmhub_theme', theme);
  }, [theme]);

  // sidebar nav groups (drawers) — only the group matching the landing view starts open
  const [openGroups, setOpenGroups] = useState({ pm: user.role !== 'ae', ae: user.role === 'ae' });
  const toggleGroup = (key) => setOpenGroups((g) => ({ ...g, [key]: !g[key] }));
  // whichever group owns the active view auto-opens (e.g. jumping to the AE board from a notification)
  useEffect(() => {
    const aeView = ['dashboard-ae', 'calendar-ae', 'ae'].includes(view);
    setOpenGroups((g) => (aeView ? (g.ae ? g : { ...g, ae: true }) : (g.pm ? g : { ...g, pm: true })));
  }, [view]);

  useEffect(() => {
    setSelected((current) =>
      current ? projects.find((project) => project.id === current.id) || null : current
    );
  }, [projects]);

  const handleViewSelect = (targetView) => {
    if (targetView === 'dashboard-pm') {
      setSelected(null);
      clearTasks();
      setDrawerTaskId(null);
      setDrawerProjectId(null);
    }
    if (targetView === 'ae') setAeBrandFilter(null);
    setView(targetView);
  };

  const openProjectWorkspace = (project) => {
    setSelected(project);
    setDrawerTaskId(null);
    setDrawerProjectId(null);
    setView('timeline');
  };

  const openNewTask = (project) => {
    if (!project) return;
    setNewTaskProject(project);
    setShowNewTask(true);
  };

  const createProject = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const brand = await resolveBrandName(f.get('brand'), brands);
    const { project } = await api.createProject({
      brand, name: f.get('name'), clientEmail: f.get('clientEmail'), pmId: f.get('pmId') || user.id,
    });
    await loadCore();
    openProjectWorkspace(project);
    setShowNewProject(false);
  };

  const handleNavigate = (target) => {
    if (target.type === 'task') {
      // Resolve the owning project from the task itself. Dashboard stays neutral;
      // the drawer receives an explicit project context without selecting a brand.
      api.task(target.id).then(({ task }) => {
        const proj = projects.find((p) => p.id === task.projectId);
        setDrawerProjectId(task.projectId);
        if (proj && view !== 'dashboard-pm') setSelected(proj);
        setDrawerTaskId(target.id);
      }).catch(() => {});
    } else if (target.type === 'chat') {
      const otherId = target.channelKey?.split('::').find((id) => id !== user.id);
      setChat({ open: true, presetUserId: otherId });
    }
  };

  const pms = users.filter((u) => u.role === 'pm' || u.role === 'admin');

  return (
    <div className="flex h-screen bg-[#f6f7f9] dark:bg-zinc-950 text-gray-800 dark:text-zinc-100 overflow-hidden transition-colors">
      {/* SIDEBAR */}
      <aside className="w-56 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col shrink-0">
        <div className="h-[72px] flex items-center px-5 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-400 grid place-items-center text-white shadow-lg shadow-blue-200 dark:shadow-none">
            <Layers3 size={20} />
          </div>
          <div className="ml-3 min-w-0">
            <h1 className="text-sm font-bold text-gray-950 dark:text-white font-poppins tracking-wide">Tracking Task</h1>
            <p className="text-[10px] text-gray-400">Creative workspace</p>
          </div>
        </div>

        <div className="px-3 py-3 border-y border-gray-100 dark:border-zinc-800 shrink-0 space-y-2">
          <NavGroup label="PM" items={PM_NAV} open={openGroups.pm} onToggle={() => toggleGroup('pm')} view={view} onSelect={handleViewSelect} />
          <NavGroup label="AE" items={AE_NAV} open={openGroups.ae} onToggle={() => toggleGroup('ae')} view={view} onSelect={handleViewSelect} />
        </div>

        <div className="flex-1" />
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 grid grid-cols-2 gap-2">
          <button onClick={() => setChat({ open: true, presetUserId: null })} className="flex flex-col items-center justify-center gap-1.5 py-2.5 bg-gray-50 dark:bg-zinc-800 rounded-xl text-[10px] font-bold text-gray-600 dark:text-zinc-300 hover:text-blue-600 transition-colors">
            <MessageSquare size={15} /> แชตทีม
          </button>
          <button onClick={() => setShowTeam(true)} className="flex flex-col items-center justify-center gap-1.5 py-2.5 bg-gray-50 dark:bg-zinc-800 rounded-xl text-[10px] font-bold text-gray-600 dark:text-zinc-300 hover:text-blue-600 transition-colors">
            <Settings size={15} /> จัดการทีม
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-[72px] px-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            {view === 'dashboard-pm' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">แดชบอร์ด PM</h2>
                <p className="text-[11px] text-gray-500">ภาพรวมงานฝั่ง PM ทุกโปรเจกต์ — ใช้สรุปให้ทีม/ลูกค้าดูได้ทันที</p>
              </div>
            ) : view === 'dashboard-ae' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">แดชบอร์ด AE</h2>
                <p className="text-[11px] text-gray-500">ภาพรวมงานฝั่ง AE ทั้งหมด — ใช้สรุปให้ทีม/ลูกค้าดูได้ทันที</p>
              </div>
            ) : view === 'calendar-ae' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">ปฏิทิน AE</h2>
                <p className="text-[11px] text-gray-500">Due date ของงาน AE แยกจากปฏิทิน PM เพื่อไม่ให้งานทับกัน</p>
              </div>
            ) : view === 'ae' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">งาน AE</h2>
                <p className="text-[11px] text-gray-500">ตารางงานประสาน — In charge, priority, deadline</p>
              </div>
            ) : view === 'board' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">บอร์ดงาน PM</h2>
                <p className="text-[11px] text-gray-500">มุมมองการ์ดของงานชุดเดียวกับ Timeline และปฏิทิน</p>
              </div>
            ) : (
              <>
                {selected?.logoUrl && (
                  <img src={selected.logoUrl} alt={selected.brand} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{selected ? `${selected.brand} : ${selected.name}` : 'เลือกโปรเจกต์'}</h2>
                    {selected && (
                      <button onClick={() => setShowEditProject(true)} title="แก้ไขรายละเอียดแบรนด์" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  {selected && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] text-gray-500">ลูกค้า: {selected.clientEmail || '—'}</p>
                      {selected.description && <p className="text-[11px] text-gray-400 truncate max-w-[280px]">• {selected.description}</p>}
                      {selected.links?.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5">
                          <LinkIcon size={10} /> {l.label || 'ลิงก์'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-full" aria-label="เลือกธีม">
              <button onClick={() => setTheme('light')} className={`w-8 h-8 rounded-full grid place-items-center transition-all ${theme === 'light' ? 'bg-white text-amber-500 shadow-sm' : 'text-gray-400'}`} title="โหมดสว่าง"><Sun size={15} /></button>
              <button onClick={() => setTheme('dark')} className={`w-8 h-8 rounded-full grid place-items-center transition-all ${theme === 'dark' ? 'bg-zinc-950 text-blue-300 shadow-sm' : 'text-gray-400'}`} title="โหมดมืด"><Moon size={15} /></button>
            </div>
            <NotificationBell onNavigate={handleNavigate} />
            <div className="w-px h-7 bg-gray-200" />
            <div className="flex items-center gap-2">
              <Avatar user={user} size={30} />
              <div className="hidden sm:block min-w-0 max-w-[140px]">
                <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
              <button onClick={logout} title="ออกจากระบบ" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={16} /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-5 sm:p-6 bg-[#f6f7f9] dark:bg-zinc-950">
            {view === 'dashboard-pm' ? (
              <PMDashboard
                users={users}
                projects={projects}
                onOpenTask={(id) => handleNavigate({ type: 'task', id })}
                onOpenProject={openProjectWorkspace}
                onManageBrands={() => setShowBrands(true)}
                onNewProject={() => setShowNewProject(true)}
              />
            ) : view === 'dashboard-ae' ? (
              <AEDashboard
                users={users}
                projects={projects}
                brands={brands}
                onOpenBrand={(brand) => { setAeBrandFilter(brand); setView('ae'); }}
                onManageBrands={() => setShowBrands(true)}
                onOpenAeBoard={() => { setAeBrandFilter(null); setView('ae'); }}
              />
            ) : view === 'board' ? (
              <KanbanBoard
                users={users}
                projects={projects}
                currentUser={user}
                onOpenTask={(id) => handleNavigate({ type: 'task', id })}
                onAddTask={(projectId) => openNewTask(projects.find((project) => project.id === projectId))}
                onChanged={() => { if (selected?.id) loadTasks(selected.id); }}
                refreshKey={boardVersion}
              />
            ) : view === 'calendar' ? (
              <CalendarView projects={projects} onOpenTask={(id) => handleNavigate({ type: 'task', id })} refreshKey={boardVersion} />
            ) : view === 'calendar-ae' ? (
              <AECalendarView users={users} onOpenAeBoard={() => setView('ae')} />
            ) : view === 'ae' ? (
              <AEBoard users={users} currentUser={user} initialProject={aeBrandFilter} />
            ) : (
              <ProjectTimeline
                project={selected}
                tasks={tasks}
                users={users}
                onAddTask={() => openNewTask(selected)}
                onOpenTask={(id) => {
                  setDrawerProjectId(selected?.id || null);
                  setDrawerTaskId(id);
                }}
              />
            )}
          </main>

          {drawerTaskId && (
            <TaskDrawer
              taskId={drawerTaskId}
              users={users}
              project={projects.find((project) => project.id === drawerProjectId) || selected}
              projects={projects}
              googleStatus={googleStatus}
              onClose={() => { setDrawerTaskId(null); setDrawerProjectId(null); }}
              onChanged={() => {
                if (selected?.id) loadTasks(selected.id);
                setBoardVersion((value) => value + 1);
              }}
              onOpenChat={(uid) => setChat({ open: true, presetUserId: uid })}
            />
          )}
        </div>
      </div>

      {/* MODALS */}
      <TeamModal open={showTeam} onClose={() => setShowTeam(false)} onChanged={loadCore} />
      <BrandsModal open={showBrands} onClose={() => setShowBrands(false)} brands={brands} onChanged={loadCore} />
      <ProjectModal
        open={showEditProject} project={selected} users={users}
        onClose={() => setShowEditProject(false)}
        onSaved={(updated) => { setSelected(updated); loadCore(); }}
      />
      {newTaskProject && (
        <NewTaskModal
          open={showNewTask}
          onClose={() => {
            setShowNewTask(false);
            setNewTaskProject(null);
          }}
          project={newTaskProject} users={users} currentUser={user}
          onCreated={(_t, calWarn) => {
            if (selected?.id === newTaskProject.id) loadTasks(newTaskProject.id);
            setBoardVersion((value) => value + 1);
            if (calWarn) alert('สร้างงานแล้ว แต่ sync calendar ไม่สำเร็จ: ' + calWarn);
          }}
        />
      )}

      {showNewProject && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowNewProject(false)}>
          <div className="bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800">
              <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><FolderPlus size={18} className="text-blue-600" /> โปรเจกต์ใหม่</h2>
              <button onClick={() => setShowNewProject(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={createProject} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Brand</label>
                <input name="brand" required list="brand-registry" className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="เลือกแบรนด์ที่มี หรือพิมพ์ชื่อใหม่" />
                <datalist id="brand-registry">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist>
              </div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">ชื่อแคมเปญ/โปรเจกต์</label><input name="name" required className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="เช่น Summer Sale" /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">อีเมลลูกค้า</label><input name="clientEmail" type="email" className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="client@brand.com" /></div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">PM ที่ดูแล</label>
                <select name="pmId" className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  {pms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">สร้างโปรเจกต์</button>
            </form>
          </div>
        </div>
      )}

      <ChatPanel
        open={chat.open} presetUserId={chat.presetUserId} users={users}
        onClose={() => setChat({ open: false, presetUserId: null })}
        onOpenTask={(id) => handleNavigate({ type: 'task', id })}
      />
    </div>
  );
}
