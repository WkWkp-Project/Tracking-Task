import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import db from '../src/db.js';
import taskRoutes from '../src/routes/tasks.routes.js';
import { signToken } from '../src/auth/jwt.js';
import { errorHandler } from '../src/http.js';

function fixture() {
  const pm = { id: 'route-pm', name: 'PM', email: 'pm@test.local', role: 'pm', disabled: false };
  const worker = { id: 'route-worker', name: 'Worker', email: 'worker@test.local', role: 'creative', disabled: false, capacityHoursPerDay: 8 };
  const outsider = { id: 'route-outsider', name: 'Outsider', email: 'outsider@test.local', role: 'creative', disabled: false };
  const project = { id: 'route-project', name: 'Project', pmId: pm.id };
  const task = {
    id: 'route-task', projectId: project.id, title: 'Protected task', description: '',
    pmId: pm.id, assigneeId: worker.id, status: 'To Do', priority: 'normal',
    startDate: '2026-09-22', endDate: '2026-09-25', estimatedHours: 0,
    loggedHours: 0, syncCalendar: false, calendarEventId: null,
  };
  Object.assign(db.raw, {
    users: [pm, worker, outsider], projects: [project], tasks: [task], drafts: [],
    attachments: [], taskUpdates: [], messages: [], notifications: [], timeLogs: [],
  });
  return { pm, outsider, project, task };
}

async function withServer(run) {
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', taskRoutes);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function patchTask(baseUrl, token, body) {
  const response = await fetch(`${baseUrl}/api/tasks/route-task`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function createTask(baseUrl, token, body) {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('a PM can create a task before assigning it to a worker', async () => {
  const { pm, project } = fixture();
  const token = signToken(pm);
  await withServer(async (baseUrl) => {
    const result = await createTask(baseUrl, token, {
      projectId: project.id,
      title: 'Unassigned task',
      startDate: '2026-09-22',
      endDate: '2026-09-25',
      estimatedHours: 8,
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.task.assigneeId, null);
    assert.equal(result.body.conflict, null);
    assert.equal(result.body.risk, null);
    assert.equal(db.raw.notifications.some((notification) => !notification.userId), false);
  });
});

test('a PM can remove the assignee from an existing task', async () => {
  const { pm, task } = fixture();
  const token = signToken(pm);
  await withServer(async (baseUrl) => {
    const result = await patchTask(baseUrl, token, { assigneeId: null });

    assert.equal(result.status, 200);
    assert.equal(result.body.task.assigneeId, null);
    assert.equal(result.body.conflict, null);
    assert.equal(result.body.risk, null);
    assert.equal(db.tasks.byId(task.id).assigneeId, null);
  });
});

test('an async authorization error returns 403 without terminating the server', async () => {
  const { outsider } = fixture();
  const token = signToken(outsider);
  await withServer(async (baseUrl) => {
    const denied = await patchTask(baseUrl, token, { title: 'Unauthorized edit' });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'FORBIDDEN');

    const stillAlive = await patchTask(baseUrl, token, { title: 'Still unauthorized' });
    assert.equal(stillAlive.status, 403);
  });
});

test('explicit null and empty task statuses are rejected without mutating the task', async () => {
  const { outsider, task } = fixture();
  const token = signToken(outsider);
  await withServer(async (baseUrl) => {
    for (const status of [null, '']) {
      const result = await patchTask(baseUrl, token, { status });
      assert.equal(result.status, 400);
      assert.equal(db.tasks.byId(task.id).status, 'To Do');
    }
  });
});
