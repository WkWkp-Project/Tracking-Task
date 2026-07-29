// Seeds an admin account + a small demo team/projects/tasks the first time
// the server runs (only if the DB is empty). Safe to run repeatedly.

import db from './db.js';
import { config } from './config.js';
import { newUser, hashPassword } from './services/users.js';
import { nanoid } from 'nanoid';

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function ensureSeed() {
  // Always make sure an admin exists
  let admin = db.users.findOne((u) => u.email.toLowerCase() === config.admin.email.toLowerCase());
  if (!admin) {
    admin = newUser({ name: 'Admin', email: config.admin.email, role: 'admin', capacityHoursPerDay: 8 });
    admin.passwordHash = await hashPassword(config.admin.password);
    db.users.insert(admin);
    console.log(`[seed] created admin ${config.admin.email} / ${config.admin.password}`);
  }

  // ── AE board seed (idempotent — runs even when the rest of the db exists) ──
  await ensureAeSeed();

  if (db.users.all().length > 1) return; // demo data already present

  // ── demo team ──
  const pm = newUser({ name: 'จีร่า (Jira M.)', email: 'jira.pm@wkwkp.com', role: 'pm' });
  pm.passwordHash = await hashPassword('password123');
  const art = newUser({ name: 'อาร์ต (Art A.)', email: 'art.a@wkwkp.com', role: 'creative' });
  art.passwordHash = await hashPassword('password123');
  const content = newUser({ name: 'คอนเทนต์ (Content B.)', email: 'content.b@wkwkp.com', role: 'copywriter' });
  content.passwordHash = await hashPassword('password123');
  const video = newUser({ name: 'วิดีโอ (Video C.)', email: 'video.c@wkwkp.com', role: 'video' });
  video.passwordHash = await hashPassword('password123');
  [pm, art, content, video].forEach((u) => db.users.insert(u));

  // ── demo projects ──
  const p1 = { id: `prj_${nanoid(8)}`, brand: 'Brand A', name: 'Summer Campaign 2026', clientEmail: 'client.a@brand.com', pmId: pm.id, archived: false, createdAt: new Date().toISOString() };
  const p2 = { id: `prj_${nanoid(8)}`, brand: 'Brand B', name: 'Q3 Always On', clientEmail: 'client.b@brand.com', pmId: pm.id, archived: false, createdAt: new Date().toISOString() };
  db.projects.insert(p1);
  db.projects.insert(p2);

  // ── demo tasks (intentionally overlapping on `art` to demonstrate conflict) ──
  const mkTask = (over) => {
    const id = `tsk_${nanoid(8)}`;
    db.tasks.insert({
      id,
      projectId: over.projectId,
      title: over.title,
      description: over.description || '',
      pmId: pm.id,
      assigneeId: over.assigneeId,
      status: over.status || 'To Do',
      startDate: over.startDate,
      endDate: over.endDate,
      priority: over.priority || 'normal',
      estimatedHours: over.drafts.reduce((s, d) => s + d.estHours, 0),
      loggedHours: over.drafts.reduce((s, d) => s + (d.loggedHours || 0), 0),
      syncCalendar: false,
      calendarEventId: null,
      createdAt: new Date().toISOString(),
      createdBy: pm.id,
    });
    over.drafts.forEach((d, i) =>
      db.drafts.insert({
        id: `dft_${nanoid(6)}`,
        taskId: id,
        step: d.step,
        order: i,
        estHours: d.estHours,
        loggedHours: d.loggedHours || 0,
        status: d.status || 'Pending',
        dueDate: d.dueDate || null,
        fileName: d.fileName || null,
        fileType: d.fileType || null,
        fileUrl: null,
      })
    );
    return id;
  };

  mkTask({
    projectId: p1.id, title: 'Key Visual Concept', assigneeId: art.id, status: 'Draft 1',
    startDate: todayPlus(-5), endDate: todayPlus(2),
    drafts: [
      { step: 'Draft 1', estHours: 8, loggedHours: 8, status: 'Approved', fileName: 'KV_Draft1.jpg', fileType: 'image' },
      { step: 'Draft 2', estHours: 4, loggedHours: 6, status: 'Revising' },
      { step: 'Final', estHours: 4, loggedHours: 0, status: 'Pending' },
    ],
  });
  mkTask({
    projectId: p1.id, title: 'Banner Set (10 sizes)', assigneeId: art.id, status: 'Draft 1', priority: 'high',
    startDate: todayPlus(-2), endDate: todayPlus(3),
    drafts: [
      { step: 'Draft 1', estHours: 16, loggedHours: 4, status: 'In Progress' },
      { step: 'Final', estHours: 8, loggedHours: 0, status: 'Pending' },
    ],
  });
  mkTask({
    projectId: p1.id, title: 'Video Teaser Edit', assigneeId: video.id, status: 'Client Review',
    startDate: todayPlus(-9), endDate: todayPlus(-1),
    drafts: [
      { step: 'Draft 1', estHours: 10, loggedHours: 10, status: 'Approved', fileName: 'VDO_v1.mp4', fileType: 'video' },
      { step: 'Final', estHours: 4, loggedHours: 7, status: 'Client Review', fileName: 'VDO_Final.mp4', fileType: 'video' },
    ],
  });
  mkTask({
    projectId: p2.id, title: 'Social Media Plan', assigneeId: content.id, status: 'To Do',
    startDate: todayPlus(1), endDate: todayPlus(7),
    drafts: [
      { step: 'Draft 1', estHours: 4, loggedHours: 0, status: 'Pending' },
      { step: 'Final', estHours: 4, loggedHours: 0, status: 'Pending' },
    ],
  });

  console.log('[seed] demo team, projects and tasks created.');
  db.flush();
}

async function ensureAeSeed() {
  // AE people (role 'ae') — create if missing
  const aePeople = [
    { name: 'Gam (แกม)', email: 'gam.ae@wkwkp.com' },
    { name: 'Jaa (จ๋า)', email: 'jaa.ae@wkwkp.com' },
    { name: 'Pare (แพร)', email: 'pare.ae@wkwkp.com' },
  ];
  const ids = {};
  for (const p of aePeople) {
    let u = db.users.findOne((x) => x.email.toLowerCase() === p.email);
    if (!u) {
      u = newUser({ name: p.name, email: p.email, role: 'ae' });
      u.passwordHash = await hashPassword('password123');
      db.users.insert(u);
    } else if (u.role !== 'ae') {
      db.users.update(u.id, { role: 'ae' });
    }
    ids[p.name.split(' ')[0]] = u.id;
  }

  if (db.aeTasks.all().length > 0) return; // rows already seeded

  const rows = [
    ['Gam', 'AE work', 'Standard ratecard for Tier1 work', 'follow', 'not_started', -4, 9, '<0.5', ''],
    ['Gam', 'New client', 'Tipco Budget breakdown ratecard', 'urgent', 'in_progress', -2, 2, '2', ''],
    ['Gam', 'Falcon', 'Barista OME · FCP (เซ็น Invoice แล้ว รอสัญญา)', 'daily', 'waiting_client', -2, 6, '<0.5', ''],
    ['Jaa', 'New client', 'Lamsoon Media/KPI Budget allocation · 3 Brands', 'daily', 'in_progress', -1, 10, '2', ''],
    ['Jaa', 'Thychef', 'Campaign Monthly Report Jul · Content/Media', 'daily', 'waiting_internal', 3, 12, '1', 'รอแอดจบสิ้นเดือน'],
    ['Jaa', 'Kirin', 'Tracking KOL (internal/client)', 'daily', 'in_progress', -3, -1, '<0.5', ''],
    ['Pare', 'Falcon', 'KOC Tier 1 · July 2026 : Tracking', 'daily', 'in_progress', 0, 2, '1', ''],
    ['Pare', 'Tulip', 'Execution บ้านลุง Brand Iconic · Lot1 (10 คลิป)', 'daily', 'in_progress', -8, 3, '<0.5', 'ลูกค้าอนุมัติแล้ว รอส่ง'],
    ['Pare', 'Debic', 'Chef Fern : WPC35% · Golden Ratio Class', 'follow', 'waiting_client', 1, 7, '<0.5', ''],
  ];
  const est = (mh) => (mh === '<0.5' ? 0.5 : Number(mh) || 0);
  for (const [who, project, work, priority, status, sOff, dOff, mh, notes] of rows) {
    db.aeTasks.insert({
      id: `ae_${nanoid(8)}`,
      assignDate: todayPlus(sOff),
      inChargeId: ids[who],
      project,
      workDetails: work,
      priority,
      status,
      startDate: todayPlus(sOff),
      dueDate: todayPlus(dOff),
      manHour: mh,
      estWorkday: est(mh),
      assets: [],
      notes,
      createdAt: new Date().toISOString(),
      createdBy: ids[who],
    });
  }
  console.log('[seed] AE board people & rows created.');
  db.flush();
}
