// ───────────────────────────────────────────────────────────────────────────
// Risk & Conflict Engine
//
// Combines four classical techniques into one workload model:
//
//  1. Capacity / utilization model  — each person has a finite number of
//     working hours per day; remaining task hours are spread across the task's
//     working days. Daily load > daily capacity  => overload (conflict).
//
//  2. PERT three-point estimation   — duration is uncertain. From the estimate
//     we derive Optimistic / Most-likely / Pessimistic, then the expected
//     effort E = (O + 4M + P)/6 and standard deviation σ = (P − O)/6.
//
//  3. Statistical on-time probability — model the gap between *capacity left
//     until the deadline* and *expected remaining effort* as a Normal variable
//     and read off P(finish on time) = Φ(z).
//
//  4. Actuarial expected loss        — risk exposure = P(overrun) × severity,
//     where severity grows with how client-facing / imminent / large the task
//     is. This is the number a PM should act on.
//
// All dates are 'YYYY-MM-DD' strings; we anchor them at UTC-noon to dodge
// timezone/DST edge cases.
// ───────────────────────────────────────────────────────────────────────────

import { WORK } from '../config.js';

const MS_DAY = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function workweekMetric() {
  const days = [...WORK.workdays];
  const mondayToFriday = days.length === 5 && days.every((day, index) => day === index + 1);
  return {
    days,
    label: mondayToFriday ? 'Monday–Friday' : days.map((day) => DAY_NAMES[day]).join(', '),
    excludesWeekends: !days.includes(0) && !days.includes(6),
  };
}

function d(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`);
}
function key(date) {
  return date.toISOString().slice(0, 10);
}
export function todayKey(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12))
    .toISOString()
    .slice(0, 10);
}
function isWorkday(date) {
  return WORK.workdays.includes(date.getUTCDay());
}

// list of workday keys in [start, end] inclusive
export function workdaysBetween(startStr, endStr) {
  const out = [];
  if (!startStr || !endStr) return out;
  let cur = d(startStr);
  const end = d(endStr);
  let guard = 0;
  while (cur <= end && guard < 2000) {
    if (isWorkday(cur)) out.push(key(cur));
    cur = new Date(cur.getTime() + MS_DAY);
    guard++;
  }
  return out;
}

function capacityFor(user) {
  return user?.capacityHoursPerDay || WORK.hoursPerDay;
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation)
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const dExp = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  let p =
    dExp *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  p = 1 - p;
  return z >= 0 ? p : 1 - p;
}

// remaining (not-yet-logged) hours for a task
export function remainingHours(task) {
  const est = Number(task.estimatedHours) || 0;
  const logged = Number(task.loggedHours) || 0;
  return Math.max(est - logged, 0);
}

// Only tasks that still consume future capacity
function isActive(task) {
  return !['Done', 'Cancelled', 'Archive'].includes(task.status);
}

// ── PERT estimate for a task ────────────────────────────────────────────────
// Creative work tends to overrun, so the pessimistic tail is wider.
export function pert(task) {
  const m = Number(task.estimatedHours) || 0;
  const o = m * 0.85;          // optimistic
  const p = m * 1.6;           // pessimistic (overrun-prone creative work)
  const expected = (o + 4 * m + p) / 6;
  const sigma = (p - o) / 6;
  return { o, m, p, expected, sigma };
}

// ── Build a per-day workload calendar for one user ──────────────────────────
// Returns { 'YYYY-MM-DD': { load, capacity, tasks: [{taskId,title,hours}] } }
export function buildWorkload(user, tasks, { fromDate = null } = {}) {
  const cap = capacityFor(user);
  const calendar = {};
  for (const task of tasks) {
    if (!isActive(task)) continue;
    const effectiveStart = fromDate && fromDate > task.startDate ? fromDate : task.startDate;
    let days = workdaysBetween(effectiveStart, task.endDate);
    // Unfinished overdue work is backlog, not free capacity. Charge its full
    // remaining effort to today so new work cannot silently displace it.
    if (fromDate && task.endDate < fromDate && isWorkday(d(fromDate))) days = [fromDate];
    if (days.length === 0) continue;
    const perDay = remainingHours(task) / days.length;
    if (perDay <= 0) continue;
    for (const day of days) {
      if (!calendar[day]) calendar[day] = { load: 0, capacity: cap, tasks: [] };
      calendar[day].load += perDay;
      calendar[day].tasks.push({ taskId: task.id, title: task.title, hours: perDay });
    }
  }
  return calendar;
}

// ── Conflict detection ──────────────────────────────────────────────────────
// Given a person's existing tasks + a candidate (new/edited) task, return the
// days where total demand exceeds capacity, plus the tasks contributing.
export function detectConflicts(user, existingTasks, candidateTask, now = new Date()) {
  const cap = capacityFor(user);
  const all = candidateTask
    ? [...existingTasks.filter((t) => t.id !== candidateTask.id), candidateTask]
    : existingTasks;
  const calendar = buildWorkload(user, all, { fromDate: todayKey(now) });

  const overloadedDays = [];
  for (const [day, info] of Object.entries(calendar)) {
    if (info.load > cap + 1e-6) {
      overloadedDays.push({
        date: day,
        load: round(info.load),
        capacity: cap,
        overBy: round(info.load - cap),
        tasks: info.tasks.map((t) => ({ ...t, hours: round(t.hours) })),
      });
    }
  }
  overloadedDays.sort((a, b) => a.date.localeCompare(b.date));

  // Does the candidate itself overlap (share any working day) with others?
  const overlapsWith = [];
  if (candidateTask) {
    const candDays = new Set(workdaysBetween(candidateTask.startDate, candidateTask.endDate));
    for (const t of existingTasks) {
      if (t.id === candidateTask.id || !isActive(t)) continue;
      const tDays = workdaysBetween(t.startDate, t.endDate);
      const shared = tDays.filter((x) => candDays.has(x));
      if (shared.length)
        overlapsWith.push({
          taskId: t.id,
          title: t.title,
          projectId: t.projectId,
          sharedDays: shared.length,
        });
    }
  }

  const peak = Object.values(calendar).reduce((mx, i) => Math.max(mx, i.load), 0);
  return {
    hasConflict: overloadedDays.length > 0,
    capacityPerDay: cap,
    peakLoad: round(peak),
    peakUtilization: round(peak / cap),
    overloadedDays,
    overlapsWith,
  };
}

// effort of a single draft = days*8 + hours
const STD_DAY = 8;
function draftEffort(dr) {
  return (Number(dr.estDays) || 0) * STD_DAY + (Number(dr.estHours) || 0);
}

// Derive a deadline per draft. If a draft has no explicit dueDate, split the
// task's working-day window proportionally by cumulative effort so each phase
// gets its own implied deadline (the last phase lands on the task end date).
function phaseDueDates(task, drafts) {
  const wds = workdaysBetween(task.startDate, task.endDate);
  const total = drafts.reduce((s, dr) => s + draftEffort(dr), 0) || 1;
  let cum = 0;
  return drafts.map((dr) => {
    cum += draftEffort(dr);
    const frac = cum / total;
    let idx = Math.ceil(frac * wds.length) - 1;
    if (idx < 0) idx = 0;
    if (idx >= wds.length) idx = wds.length - 1;
    return dr.dueDate || wds[idx] || task.endDate;
  });
}

const RANK = { Done: -1, Low: 0, Medium: 1, High: 2, Critical: 3 };

// ── Risk assessment for a single task — DEADLINE-FIRST & PHASE-AWARE ─────────
// `otherTasks` = the assignee's other active tasks (shared capacity).
// `drafts`     = this task's draft phases (each may carry its own dueDate).
export function assessRisk(task, user, otherTasks = [], drafts = [], now = new Date()) {
  const cap = capacityFor(user);
  const today = todayKey(now);
  const calendarDaysLeft = Math.ceil((d(task.endDate) - d(today)) / MS_DAY);
  const hasDrafts = Array.isArray(drafts) && drafts.length > 0;

  // ── delivered / closed → clears critical regardless of past deadline ──
  const activeDrafts = hasDrafts ? drafts.filter((x) => x.status !== 'Approved') : [];
  const delivered =
    task.status === 'Done' || task.status === 'Approval' ||
    (hasDrafts && activeDrafts.length === 0);
  if (delivered || task.status === 'Cancelled' || task.status === 'Archive') {
    return {
      taskId: task.id,
      level: ['Cancelled', 'Archive'].includes(task.status) ? 'Low' : 'Done',
      onTimeProbability: 1, overrunProbability: 0, severity: 0, riskExposure: 0,
      calendarDaysLeft, workdaysLeft: 0,
      expectedRemainingHours: 0, availableHoursForTask: 0, capacityPerDay: cap,
      workweek: workweekMetric(),
      phases: (drafts || []).map((x) => ({
        draftId: x.id, step: x.step, level: x.status === 'Approved' ? 'Done' : 'Low',
        daysLeft: null, remainingHours: 0, dueDate: x.dueDate || task.endDate,
      })),
      recommendations: [task.status === 'Cancelled' ? 'งานถูกยกเลิก' : 'ส่งงานครบทุกขั้นแล้ว ✓'],
    };
  }

  const otherCal = buildWorkload(user, otherTasks, { fromDate: today });
  // capacity available (net of other tasks) from today up to a given deadline
  const availTo = (deadline) => {
    const wds = workdaysBetween(today > task.startDate ? today : task.startDate, deadline);
    let a = 0;
    for (const day of wds) a += Math.max(cap - (otherCal[day]?.load || 0), 0);
    return { avail: a, workdays: wds.length };
  };

  const dueDates = hasDrafts ? phaseDueDates(task, drafts) : [];
  let worst = 'Low';
  const bump = (lv) => { if (RANK[lv] > RANK[worst]) worst = lv; };
  const phases = [];
  let taskRemaining = 0;

  if (hasDrafts) {
    drafts.forEach((dft, i) => {
      if (dft.status === 'Approved') {
        phases.push({ draftId: dft.id, step: dft.step, level: 'Done', daysLeft: null, remainingHours: 0, dueDate: dueDates[i] });
        return;
      }
      const remaining = Math.max(draftEffort(dft) - (Number(dft.loggedHours) || 0), 0);
      taskRemaining += remaining;
      const deadline = dueDates[i];
      const dl = Math.ceil((d(deadline) - d(today)) / MS_DAY);
      const { avail } = availTo(deadline);
      let level = 'Low';
      if (remaining <= 0) level = 'Low';
      else if (dl < 0) level = 'Critical';                       // overdue + unfinished
      else if (remaining > avail + 1e-6) level = dl <= 1 ? 'Critical' : 'High';
      else if (dl <= 1) level = 'High';
      else if (dl <= 3 || avail < remaining * 1.25) level = 'Medium';
      bump(level);
      phases.push({
        draftId: dft.id, step: dft.step, level, daysLeft: dl,
        remainingHours: round(remaining), availableHours: round(avail), dueDate: deadline,
      });
    });
  } else {
    taskRemaining = remainingHours(task);
    const { avail } = availTo(task.endDate);
    let level = 'Low';
    if (taskRemaining <= 0) level = 'Low';
    else if (calendarDaysLeft < 0) level = 'Critical';
    else if (taskRemaining > avail) level = calendarDaysLeft <= 1 ? 'Critical' : 'High';
    else if (calendarDaysLeft <= 1) level = 'High';
    else if (calendarDaysLeft <= 3) level = 'Medium';
    bump(level);
  }

  // overdue overall is always at least High (deadline-first safety net)
  if (calendarDaysLeft < 0 && taskRemaining > 0) bump('Critical');

  // ── whole-task statistical on-time (capacity vs. expected effort) ──
  const { avail: availTask } = availTo(task.endDate);
  const sigma = taskRemaining * 0.25;
  let onTimeProb;
  if (taskRemaining <= 1e-6) onTimeProb = 1; // no work left → nothing to be late on
  else if (sigma <= 1e-6) onTimeProb = availTask >= taskRemaining ? 1 : 0;
  else onTimeProb = normalCdf((availTask - taskRemaining) / sigma);
  if (calendarDaysLeft < 0 && taskRemaining > 0) onTimeProb = Math.min(onTimeProb, 0.1);

  const clientFacing = ['Client Review', 'Final', 'Approval'].includes(task.status);
  let severity = 1 + Math.min(taskRemaining / 16, 2);
  if (clientFacing) severity += 1;
  if (calendarDaysLeft <= 1) severity += 1;
  severity = round(severity);
  const overrunProb = round(1 - onTimeProb);
  const riskExposure = round(overrunProb * severity);

  // ── recommendations — focus on the worst at-risk phase (deadline-first) ──
  const recommendations = [];
  const atRisk = phases.filter((p) => p.level !== 'Done' && p.level !== 'Low').sort((a, b) => RANK[b.level] - RANK[a.level]);
  const wp = atRisk[0];
  if (wp) {
    if (wp.daysLeft < 0)
      recommendations.push(`"${wp.step}" เลยกำหนด ${Math.abs(wp.daysLeft)} วัน และยังค้าง ${wp.remainingHours} ชม. — ขยายกำหนดส่งดราฟนี้ หรือเร่ง/ย้ายงาน`);
    else {
      const deficit = round(wp.remainingHours - (wp.availableHours || 0));
      if (deficit > 0) {
        const extra = Math.ceil(deficit / cap);
        recommendations.push(`"${wp.step}" เวลาไม่พอ ~${deficit} ชม. (เหลือ ${wp.daysLeft} วัน) — ขยายกำหนดส่งดราฟนี้ +${extra} วัน หรือย้ายงานบางส่วนให้คนอื่น`);
      } else {
        recommendations.push(`"${wp.step}" ใกล้กำหนด (เหลือ ${wp.daysLeft} วัน, ค้าง ${wp.remainingHours} ชม.) — เฝ้าระวัง`);
      }
    }
  }
  if (calendarDaysLeft < 0 && taskRemaining > 0)
    recommendations.push(`งานเลยกำหนดปลายทาง ${Math.abs(calendarDaysLeft)} วัน — PM ขยาย deadline ปลายทางเพื่อล้างสถานะวิกฤต`);
  if ((Number(task.loggedHours) || 0) > (Number(task.estimatedHours) || 0) && Number(task.estimatedHours) > 0)
    recommendations.push(`ชั่วโมงจริง (${task.loggedHours}h) เกินประมาณการ (${task.estimatedHours}h) — ทบทวน scope/estimate`);
  if (recommendations.length === 0) recommendations.push('อยู่ในเกณฑ์ปกติ ดำเนินงานตามแผนได้');

  return {
    taskId: task.id,
    level: worst,
    onTimeProbability: round(onTimeProb),
    overrunProbability: overrunProb,
    severity, riskExposure,
    calendarDaysLeft,
    workdaysLeft: workdaysBetween(today > task.startDate ? today : task.startDate, task.endDate).length,
    expectedRemainingHours: round(taskRemaining),
    availableHoursForTask: round(availTask),
    capacityPerDay: cap,
    workweek: workweekMetric(),
    phases,
    recommendations,
  };
}

// Inverse normal CDF (Beasley-Springer/Moro) — used for buffer sizing
function invNormal(p) {
  if (p <= 0) return -10;
  if (p >= 1) return 10;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const dd = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q, r;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((dd[0] * q + dd[1]) * q + dd[2]) * q + dd[3]) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((dd[0] * q + dd[1]) * q + dd[2]) * q + dd[3]) * q + 1);
}

function round(n, dp = 2) {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}
