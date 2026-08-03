import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedDraftTransitions,
  allowedTaskTransitions,
  canCreateTask,
  canEditTaskDetails,
  canTransitionDraft,
  canTransitionTask,
  workflowFor,
} from '../src/services/taskWorkflow.js';

const admin = { id: 'admin', role: 'admin', disabled: false };
const pm = { id: 'pm-1', role: 'pm', disabled: false };
const otherPm = { id: 'pm-2', role: 'pm', disabled: false };
const worker = { id: 'worker-1', role: 'creative', disabled: false };
const outsider = { id: 'worker-2', role: 'creative', disabled: false };
const project = { id: 'project', pmId: pm.id };
const task = {
  id: 'task',
  projectId: project.id,
  pmId: pm.id,
  assigneeId: worker.id,
  status: 'Draft 1',
};

test('project PM and admin can create tasks, workers cannot', () => {
  assert.equal(canCreateTask(pm, project), true);
  assert.equal(canCreateTask(admin, project), true);
  assert.equal(canCreateTask(worker, project), false);
  assert.equal(canCreateTask(otherPm, project), false);
});

test('task details are restricted to the owning PM or admin', () => {
  assert.equal(canEditTaskDetails(pm, task, project), true);
  assert.equal(canEditTaskDetails(admin, task, project), true);
  assert.equal(canEditTaskDetails(worker, task, project), false);
  assert.equal(canEditTaskDetails(otherPm, task, project), false);
});

test('assignee can follow production transitions but cannot approve, cancel, or archive', () => {
  assert.deepEqual(allowedTaskTransitions(worker, task, project), ['To Do', 'Draft 2', 'Final']);
  assert.equal(canTransitionTask(worker, task, 'Draft 2', project), true);
  assert.equal(canTransitionTask(worker, task, 'Cancelled', project), false);
  assert.equal(canTransitionTask(worker, task, 'Archive', project), false);
});

test('manager can advance, revise, cancel, and archive through explicit transitions', () => {
  assert.ok(allowedTaskTransitions(pm, task, project).includes('Draft 2'));
  assert.ok(allowedTaskTransitions(pm, task, project).includes('Archive'));
  assert.equal(canTransitionTask(pm, task, 'Done', project), false);
});

test('archive is terminal but recoverable by a manager without deleting data', () => {
  const archived = { ...task, status: 'Archive' };
  assert.deepEqual(allowedTaskTransitions(pm, archived, project), ['To Do']);
  assert.deepEqual(allowedTaskTransitions(worker, archived, project), []);
});

test('draft approval is manager-only and transitions are sequential', () => {
  const draft = { id: 'draft', status: 'In Progress' };
  assert.deepEqual(allowedDraftTransitions(worker, task, draft, project), ['Revising']);
  assert.equal(canTransitionDraft(worker, task, draft, 'Approved', project), false);
  assert.equal(canTransitionDraft(pm, task, draft, 'Approved', project), true);
});

test('workflow metadata exposes only the current actor permissions', () => {
  assert.deepEqual(workflowFor(outsider, task, project), {
    canManage: false,
    canContribute: false,
    canEditDetails: false,
    canLogHours: false,
    allowedTransitions: [],
  });
});
