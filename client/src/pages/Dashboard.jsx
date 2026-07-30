import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  LayoutDashboard, FolderPlus, Settings, Plus, MessageSquare, LogOut, AlertCircle,
  AlertTriangle, CheckCircle, Clock, X, Users, CalendarDays, GanttChartSquare,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from '../components/ui.jsx';
import { riskStyle, daysLeftText } from '../utils.js';
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
import { resolveBrandName } from '../brand.js';
import { Pencil, Link as LinkIcon, ClipboardList, Tag } from 'lucide-react';

const DAY = 24 * 60 * 60 * 1000;

const PM_NAV = [
  { key: 'dashboard-pm', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { key: 'timeline', label: 'ไทม์ไลน์', icon: GanttChartSquare },
  { key: 'calendar', label: 'ปฏิทิน', icon: CalendarDays },
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
      <button onClick={onToggle} className="w-full flex items-center justify-between px-2 py-1 text-sidebar-text/60 hover:text-sidebar-text">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden min-h-0">
          <div className="space-y-0.5">
            {items.map((item) => (
              <button key={item.key} onClick={() => onSelect(item.key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-all ${
                  view === item.key
                    ? 'bg-primary text-white shadow-[0_4px_14px_rgba(225,18,28,0.32)]'
                    : 'text-sidebar-text hover:text-white hover:bg-white/10'
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
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, linked: false });

  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [showTeam, setShowTeam] = useState(false);
  const [showBrands, setShowBrands] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [chat, setChat] = useState({ open: false, presetUserId: null });
  // AE-role lands on the AE side by default; everyone else lands on the PM dashboard
  const [view, setView] = useState(user.role === 'ae' ? 'dashboard-ae' : 'dashboard-pm');
  // 'dashboard-pm' | 'dashboard-ae' | 'timeline' | 'calendar' | 'calendar-ae' | 'ae'
  const [dayOffset, setDayOffset] = useState(-5); // timeline window start relative to today

  // sidebar nav groups (drawers) — only the group matching the landing view starts open
  const [openGroups, setOpenGroups] = useState({ pm: user.role !== 'ae', ae: user.role === 'ae' });
  const toggleGroup = (key) => setOpenGroups((g) => ({ ...g, [key]: !g[key] }));
  // whichever group owns the active view auto-opens (e.g. jumping to the AE board from a notification)
  useEffect(() => {
    const aeView = ['dashboard-ae', 'calendar-ae', 'ae'].includes(view);
    setOpenGroups((g) => (aeView ? (g.ae ? g : { ...g, ae: true }) : (g.pm ? g : { ...g, pm: true })));
  }, [view]);

  const loadCore = useCallback(async () => {
    const [{ projects }, { users }, { brands }, gs] = await Promise.all([
      api.projects(), api.users(), api.brands(), api.googleIntegrationStatus().catch(() => ({ configured: false, linked: false })),
    ]);
    setProjects(projects);
    setUsers(users);
    setBrands(brands);
    setGoogleStatus(gs);
    setSelected((cur) => cur || projects[0] || null);
  }, []);

  const loadTasks = useCallback(async (projectId) => {
    if (!projectId) { setTasks([]); return; }
    const { tasks } = await api.tasks(`?projectId=${projectId}`);
    setTasks(tasks);
  }, []);

  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => { if (selected) loadTasks(selected.id); }, [selected, loadTasks]);

  // timeline: navigable 3-week window (dayOffset = start relative to today)
  const timeline = useMemo(() => {
    const out = [];
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + dayOffset);
    for (let i = 0; i < 21; i++) { const d = new Date(start.getTime() + i * DAY); out.push(d); }
    return out;
  }, [dayOffset]);
  const todayMid = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);

  const createProject = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const brand = await resolveBrandName(f.get('brand'), brands);
    const { project } = await api.createProject({
      brand, name: f.get('name'), clientEmail: f.get('clientEmail'), pmId: f.get('pmId') || user.id,
    });
    await loadCore();
    setSelected(project);
    setShowNewProject(false);
  };

  const handleNavigate = (target) => {
    if (target.type === 'task') {
      // find which project the task belongs to, switch, open drawer
      api.task(target.id).then(({ task }) => {
        const proj = projects.find((p) => p.id === task.projectId);
        if (proj) setSelected(proj);
        setDrawerTaskId(target.id);
      }).catch(() => {});
    } else if (target.type === 'chat') {
      const otherId = target.channelKey?.split('::').find((id) => id !== user.id);
      setChat({ open: true, presetUserId: otherId });
    }
  };

  const pms = users.filter((u) => u.role === 'pm' || u.role === 'admin');

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <div className="h-16 flex items-center px-5 shrink-0">
          <LayoutDashboard size={20} className="text-primary mr-2" />
          <h1 className="text-lg font-bold text-white font-poppins tracking-wide">Tracking Task</h1>
        </div>

        <div className="px-3 py-3 border-b border-sidebar-border shrink-0 space-y-2">
          <NavGroup label="PM" items={PM_NAV} open={openGroups.pm} onToggle={() => toggleGroup('pm')} view={view} onSelect={setView} />
          <NavGroup label="AE" items={AE_NAV} open={openGroups.ae} onToggle={() => toggleGroup('ae')} view={view} onSelect={setView} />
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-sidebar-text/60 uppercase tracking-wider">Brands & Projects</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setShowBrands(true)} title="จัดการแบรนด์" className="p-1 text-sidebar-text/60 hover:text-primary hover:bg-white/10 rounded"><Tag size={16} /></button>
              <button onClick={() => setShowNewProject(true)} title="โปรเจกต์ใหม่" className="p-1 text-sidebar-text/60 hover:text-primary hover:bg-white/10 rounded"><FolderPlus size={16} /></button>
            </div>
          </div>
          <div className="space-y-1.5">
            {projects.map((p) => (
              <button key={p.id} onClick={() => { setSelected(p); setDrawerTaskId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-2.5 transition-colors ${selected?.id === p.id ? 'bg-primary/15 border-primary/40' : 'border-transparent hover:bg-white/5'}`}>
                {p.logoUrl ? (
                  <img src={p.logoUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-white/10 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-bold text-sidebar-text shrink-0">{p.brand?.charAt(0)}</div>
                )}
                <div className="min-w-0">
                  <span className={`font-bold block truncate text-sm ${selected?.id === p.id ? 'text-white' : 'text-sidebar-text'}`}>{p.brand}</span>
                  <span className="text-[11px] text-sidebar-text/60 truncate block">{p.name}</span>
                </div>
              </button>
            ))}
            {projects.length === 0 && <p className="text-xs text-sidebar-text/50">ยังไม่มีโปรเจกต์</p>}
          </div>
        </div>
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <button onClick={() => setChat({ open: true, presetUserId: null })} className="w-full flex items-center justify-center gap-2 py-2 bg-transparent border border-white/20 rounded-lg text-sm font-bold text-white hover:bg-white/10 transition-colors">
            <MessageSquare size={15} /> แชตทีม
          </button>
          <button onClick={() => setShowTeam(true)} className="w-full flex items-center justify-center gap-2 py-2 bg-transparent border border-white/20 rounded-lg text-sm font-bold text-white hover:bg-white/10 transition-colors">
            <Settings size={15} /> จัดการทีม
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 px-6 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            {view === 'dashboard-pm' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">แดชบอร์ด PM</h2>
                <p className="text-[11px] text-gray-500">ภาพรวมงานฝั่ง PM ทุกโปรเจกต์ — ใช้สรุปให้ทีม/ลูกค้าดูได้ทันที</p>
              </div>
            ) : view === 'dashboard-ae' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">แดชบอร์ด AE</h2>
                <p className="text-[11px] text-gray-500">ภาพรวมงานฝั่ง AE ทั้งหมด — ใช้สรุปให้ทีม/ลูกค้าดูได้ทันที</p>
              </div>
            ) : view === 'calendar-ae' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">ปฏิทิน AE</h2>
                <p className="text-[11px] text-gray-500">Due date ของงาน AE แยกจากปฏิทิน PM เพื่อไม่ให้งานทับกัน</p>
              </div>
            ) : view === 'ae' ? (
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">งาน AE</h2>
                <p className="text-[11px] text-gray-500">ตารางงานประสาน — In charge, priority, deadline</p>
              </div>
            ) : (
              <>
                {selected?.logoUrl && (
                  <img src={selected.logoUrl} alt={selected.brand} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 truncate">{selected ? `${selected.brand} : ${selected.name}` : 'เลือกโปรเจกต์'}</h2>
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
            <NotificationBell onNavigate={handleNavigate} />
            <div className="w-px h-7 bg-gray-200" />
            <div className="flex items-center gap-2">
              <Avatar user={user} size={30} />
              <div className="hidden sm:block min-w-0 max-w-[140px]">
                <p className="text-xs font-bold text-gray-800 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
              <button onClick={logout} title="ออกจากระบบ" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={16} /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-5">
            {view === 'dashboard-pm' ? (
              <PMDashboard users={users} projects={projects} />
            ) : view === 'dashboard-ae' ? (
              <AEDashboard users={users} />
            ) : view === 'calendar' ? (
              <CalendarView projects={projects} onOpenTask={(id) => handleNavigate({ type: 'task', id })} />
            ) : view === 'calendar-ae' ? (
              <AECalendarView users={users} onOpenAeBoard={() => setView('ae')} />
            ) : view === 'ae' ? (
              <AEBoard users={users} currentUser={user} />
            ) : (
            <>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setDayOffset((o) => o - 7)} className="p-1.5 border border-gray-200 bg-white rounded-lg hover:bg-gray-50"><ChevronLeft size={16} /></button>
                <button onClick={() => setDayOffset(-5)} className="px-3 py-1.5 text-xs font-bold border border-gray-200 bg-white rounded-lg hover:bg-gray-50">วันนี้</button>
                <button onClick={() => setDayOffset((o) => o + 7)} className="p-1.5 border border-gray-200 bg-white rounded-lg hover:bg-gray-50"><ChevronRight size={16} /></button>
                <span className="text-xs text-gray-400 ml-1">{timeline[0].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – {timeline[20].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
              </div>
              <button onClick={() => selected && setShowNewTask(true)} disabled={!selected}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm">
                <Plus size={16} /> เพิ่มงาน
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* timeline header */}
              <div className="flex border-b border-gray-200 bg-gray-50 min-w-[900px]">
                <div className="w-80 shrink-0 py-3 px-5 font-bold text-[11px] text-gray-500 uppercase border-r border-gray-200 flex items-center">งาน & ผู้รับผิดชอบ</div>
                <div className="flex-1 flex">
                  {timeline.map((d, i) => {
                    const isToday = d.getTime() === todayMid;
                    return (
                      <div key={i} className={`flex-1 py-2 text-center border-r border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}>
                        <div className={`text-[9px] font-bold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className={`text-xs font-bold ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* rows */}
              <div className="divide-y divide-gray-100 min-w-[900px]">
                {tasks.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">ยังไม่มีงานในโปรเจกต์นี้ — กด “เพิ่มงาน”</div>
                ) : tasks.map((task) => {
                  const pm = users.find((u) => u.id === task.pmId);
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  const rs = riskStyle(task.risk?.level);
                  const sd = new Date(task.startDate + 'T00:00:00').getTime();
                  const ed = new Date(task.endDate + 'T00:00:00').getTime();
                  const t0 = timeline[0].getTime();
                  const startOffset = Math.round((sd - t0) / DAY);
                  const duration = Math.round((ed - sd) / DAY) + 1;
                  const visible = startOffset < 21 && startOffset + duration > 0;

                  return (
                    <div key={task.id} className="flex group hover:bg-gray-50 cursor-pointer" onClick={() => setDrawerTaskId(task.id)}>
                      <div className="w-80 shrink-0 py-3 px-5 border-r border-gray-200">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {task.risk?.level === 'Critical' ? <AlertCircle size={16} className="text-red-500" /> :
                             task.risk?.level === 'Low' ? <CheckCircle size={16} className="text-emerald-500" /> :
                             <AlertTriangle size={16} className={rs.dot} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-gray-900 truncate">{task.title}</h4>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{task.status}</span>
                              {task.risk?.level !== 'Low' && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rs.chip}`}>{daysLeftText(task.risk?.calendarDaysLeft)}</span>}
                              <span className="text-[9px] text-gray-400 flex items-center gap-0.5"><Clock size={9} />{task.loggedHours}/{task.estimatedHours}h</span>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                              <Avatar user={pm} size={18} title={`PM: ${pm?.name}`} />
                              <Avatar user={assignee} size={18} title={`ผู้ทำงาน: ${assignee?.name}`} />
                              <span className="text-[10px] text-gray-400 truncate ml-1">{assignee?.name?.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 relative py-2">
                        <div className="absolute inset-0 flex">{timeline.map((_, i) => <div key={i} className="flex-1 border-r border-gray-50" />)}</div>
                        {visible && (
                          <div className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center px-2 ${rs.bar} shadow-sm`}
                            style={{ left: `${(Math.max(0, startOffset) / 21) * 100}%`, width: `${(Math.min(duration + Math.min(0, startOffset), 21 - Math.max(0, startOffset)) / 21) * 100}%`, minWidth: 50 }}>
                            <span className="text-[10px] font-bold text-white truncate">{Math.round((task.risk?.onTimeProbability || 0) * 100)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
            )}
          </main>

          {drawerTaskId && (
            <TaskDrawer
              taskId={drawerTaskId}
              users={users}
              project={selected}
              googleStatus={googleStatus}
              onClose={() => setDrawerTaskId(null)}
              onChanged={() => loadTasks(selected.id)}
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
      {selected && (
        <NewTaskModal
          open={showNewTask} onClose={() => setShowNewTask(false)}
          project={selected} users={users} currentUser={user}
          onCreated={(_t, calWarn) => { loadTasks(selected.id); if (calWarn) alert('สร้างงานแล้ว แต่ sync calendar ไม่สำเร็จ: ' + calWarn); }}
        />
      )}

      {showNewProject && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowNewProject(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold flex items-center gap-2"><FolderPlus size={18} className="text-blue-600" /> โปรเจกต์ใหม่</h2>
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
