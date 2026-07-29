// Thin fetch wrapper that attaches the JWT and parses JSON / errors.

const TOKEN_KEY = 'pmhub_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p, b) => request('DELETE', p, b),

  // auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),
  googleStatus: () => request('GET', '/auth/google/status'),
  changePassword: (currentPassword, newPassword) =>
    request('POST', '/auth/change-password', { currentPassword, newPassword }),

  // users
  users: () => request('GET', '/users'),
  createUser: (b) => request('POST', '/users', b),
  updateUser: (id, b) => request('PATCH', `/users/${id}`, b),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  workload: (id) => request('GET', `/users/${id}/workload`),
  teamWorkload: (from, to, assigneeId) =>
    request('GET', `/workload?from=${from}&to=${to}${assigneeId ? `&assigneeId=${assigneeId}` : ''}`),

  // projects
  projects: () => request('GET', '/projects'),
  createProject: (b) => request('POST', '/projects', b),
  updateProject: (id, b) => request('PATCH', `/projects/${id}`, b),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),

  // tasks
  tasks: (q = '') => request('GET', `/tasks${q}`),
  task: (id) => request('GET', `/tasks/${id}`),
  conflictCheck: (b) => request('POST', '/tasks/conflict-check', b),
  createTask: (b) => request('POST', '/tasks', b),
  updateTask: (id, b) => request('PATCH', `/tasks/${id}`, b),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),
  addDraft: (id, b) => request('POST', `/tasks/${id}/drafts`, b),
  updateDraft: (id, draftId, b) => request('PATCH', `/tasks/${id}/drafts/${draftId}`, b),
  logHours: (id, b) => request('POST', `/tasks/${id}/log-hours`, b),
  addAttachment: (id, b) => request('POST', `/tasks/${id}/attachments`, b),
  deleteAttachment: (id, attId) => request('DELETE', `/tasks/${id}/attachments/${attId}`),

  // chat
  conversations: () => request('GET', '/chat/conversations'),
  messages: (channelKey) => request('GET', `/chat/messages?channelKey=${encodeURIComponent(channelKey)}`),
  sendMessage: (b) => request('POST', '/chat/messages', b),

  // notifications
  notifications: () => request('GET', '/notifications'),
  readNotification: (id) => request('POST', `/notifications/${id}/read`),
  readAllNotifications: () => request('POST', '/notifications/read-all'),

  // AE board
  aeTasks: (inChargeId) => request('GET', `/ae${inChargeId ? `?inChargeId=${inChargeId}` : ''}`),
  createAeTask: (b) => request('POST', '/ae', b),
  updateAeTask: (id, b) => request('PATCH', `/ae/${id}`, b),
  deleteAeTask: (id) => request('DELETE', `/ae/${id}`),

  // admin
  runReminders: () => request('POST', '/admin/run-reminders', { force: true }),

  // google
  googleIntegrationStatus: () => request('GET', '/google/status'),
  sendGmail: (b) => request('POST', '/google/gmail/send', b),
  calendarSync: (taskId) => request('POST', '/google/calendar/sync', { taskId }),
  calendarUnsync: (taskId) => request('POST', '/google/calendar/unsync', { taskId }),
};

export default api;
