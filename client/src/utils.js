export const RISK_STYLES = {
  Done: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600', dot: 'text-slate-400', label: 'เสร็จแล้ว' },
  Critical: { bar: 'bg-red-500', chip: 'bg-red-100 text-red-700', dot: 'text-red-500', label: 'วิกฤต' },
  High: { bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', dot: 'text-orange-500', label: 'เสี่ยงสูง' },
  Medium: { bar: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700', dot: 'text-amber-500', label: 'เฝ้าระวัง' },
  Low: { bar: 'bg-emerald-400', chip: 'bg-emerald-100 text-emerald-700', dot: 'text-emerald-500', label: 'ปกติ' },
};

export function riskStyle(level) {
  return RISK_STYLES[level] || RISK_STYLES.Low;
}

export function daysLeftText(daysLeft) {
  if (daysLeft == null) return '';
  if (daysLeft < 0) return `เลยกำหนด ${Math.abs(daysLeft)} วัน`;
  if (daysLeft === 0) return 'ครบกำหนดวันนี้';
  return `เหลือ ${daysLeft} วัน`;
}

export function initials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

export const ROLE_LABELS = {
  admin: 'แอดมิน',
  pm: 'Project Manager',
  creative: 'Creative / Art',
  copywriter: 'Copywriter',
  video: 'Video Editor',
  ae: 'Account Executive',
};

// roles a user may pick for themselves on first login (never 'admin')
export const SELF_ROLE_OPTIONS = [
  { key: 'pm', label: ROLE_LABELS.pm, hint: 'ดูภาพรวมโปรเจกต์ มอบหมายงาน ติดตามความเสี่ยง' },
  { key: 'ae', label: ROLE_LABELS.ae, hint: 'ประสานงานลูกค้า ดูแลตาราง AE work' },
  { key: 'creative', label: ROLE_LABELS.creative, hint: 'รับงานจาก PM ทำดราฟ ส่งงาน' },
  { key: 'copywriter', label: ROLE_LABELS.copywriter, hint: 'รับงานจาก PM ทำดราฟ ส่งงาน' },
  { key: 'video', label: ROLE_LABELS.video, hint: 'รับงานจาก PM ทำดราฟ ส่งงาน' },
];

// ── AE board vocab (matches the app's semantic pill palette) ──
export const AE_PRIORITY = [
  { key: 'urgent', label: 'Important / Urgent', chip: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  { key: 'daily', label: 'Dairy work', chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'follow', label: 'Low priority / Follow up work', chip: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
];
export const AE_STATUS = [
  { key: 'not_started', label: 'Not Started', chip: 'bg-gray-100 text-gray-600' },
  { key: 'in_progress', label: 'In Progress', chip: 'bg-violet-50 text-violet-700' },
  { key: 'waiting_client', label: 'Waiting Client', chip: 'bg-amber-100 text-amber-700' },
  { key: 'waiting_internal', label: 'Waiting Internal', chip: 'bg-amber-100 text-amber-700' },
  { key: 'done', label: 'Done', chip: 'bg-emerald-100 text-emerald-700' },
];
export const AE_MANHOUR = [
  { key: '<0.5', label: '<0.5 Day' }, { key: '1', label: '1 Day' }, { key: '2', label: '2 Days' },
  { key: '3', label: '3 Days' }, { key: '4', label: '4 Days' }, { key: '5', label: '5 Days' },
  { key: '6', label: '6 Days' }, { key: '7', label: '7 Days' },
];
export const aePriority = (k) => AE_PRIORITY.find((p) => p.key === k) || AE_PRIORITY[1];
export const aeStatus = (k) => AE_STATUS.find((s) => s.key === k) || AE_STATUS[0];

// 6-week (42-cell) grid covering a given month, anchored at UTC-noon so date
// keys line up with the server's YYYY-MM-DD day keys regardless of timezone.
export function monthGrid(y, m) {
  const first = new Date(Date.UTC(y, m, 1, 12));
  const startDow = first.getUTCDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setUTCDate(1 - startDow + i);
    cells.push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m,
    });
  }
  return cells;
}
export function todayKey() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12)).toISOString().slice(0, 10);
}

// deadline severity for a plain due date (matches risk color language)
export function dueSeverity(dueDate, status) {
  if (status === 'done') return 'done';
  if (!dueDate) return 'none';
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(dueDate + 'T00:00:00');
  const days = Math.round((d - t) / 86400000);
  if (days < 0 || days <= 1) return 'danger';
  if (days <= 4) return 'warn';
  return 'ok';
}

// Levenshtein edit distance -> 0..1 similarity ratio (1 = identical)
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
export function nameSimilarity(a, b) {
  const s1 = (a || '').trim().toLowerCase();
  const s2 = (b || '').trim().toLowerCase();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  return 1 - levenshtein(s1, s2) / Math.max(s1.length, s2.length);
}
