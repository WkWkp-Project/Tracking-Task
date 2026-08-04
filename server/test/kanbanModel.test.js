import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_KANBAN_COLUMNS,
  groupTasksByColumn,
  replaceTaskCard,
  resolveKanbanMove,
  restoreKanbanColumns,
} from '../../client/src/kanbanModel.js';

function card(overrides = {}) {
  return {
    id: 'task-1',
    status: 'To Do',
    drafts: [{ id: 'draft-1' }],
    workflow: { allowedTransitions: ['Draft 1', 'Archive'] },
    ...overrides,
  };
}

test('one task remains one Kanban card when phases are added', () => {
  const task = card({ drafts: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] });
  const grouped = groupTasksByColumn([task], DEFAULT_KANBAN_COLUMNS);
  assert.equal([...grouped.values()].flat().length, 1);
  assert.equal(grouped.get('brief')[0].id, task.id);
});

test('duplicate task rows cannot produce duplicate Kanban cards', () => {
  const task = card();
  const grouped = groupTasksByColumn([task, { ...task }], DEFAULT_KANBAN_COLUMNS);
  assert.equal([...grouped.values()].flat().length, 1);
});

test('each workflow status maps to exactly one default column', () => {
  const tasks = ['To Do', 'Draft 1', 'Draft 2', 'Final', 'Client Review', 'Approval', 'Done', 'Cancelled', 'Archive']
    .map((status, index) => card({ id: `task-${index}`, status }));
  const grouped = groupTasksByColumn(tasks, DEFAULT_KANBAN_COLUMNS);
  const cards = [...grouped.values()].flat();
  assert.equal(cards.length, tasks.length);
  assert.equal(new Set(cards.map((task) => task.id)).size, tasks.length);
});

test('moving a card replaces it in place instead of adding another card', () => {
  const before = [card(), card({ id: 'task-2' })];
  const updated = card({ status: 'Draft 1', workflow: { allowedTransitions: ['To Do', 'Draft 2'] } });
  const after = replaceTaskCard(before, updated);
  assert.equal(after.length, before.length);
  assert.equal(after.filter((task) => task.id === updated.id).length, 1);
  assert.equal(groupTasksByColumn(after).get('worksheet')[0].status, 'Draft 1');
});

test('a move response for an unknown task cannot append a card', () => {
  const before = [card()];
  const after = replaceTaskCard(before, card({ id: 'unknown', status: 'Draft 1' }));
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'task-1');
});

test('Kanban move uses the existing workflow transition and blocks skips', () => {
  const task = card();
  assert.deepEqual(resolveKanbanMove(task, DEFAULT_KANBAN_COLUMNS[1]), {
    allowed: true,
    noop: false,
    nextStatus: 'Draft 1',
  });
  assert.deepEqual(resolveKanbanMove(task, DEFAULT_KANBAN_COLUMNS[3]), {
    allowed: false,
    reason: 'workflow',
    nextStatus: 'Final',
  });
});

test('renaming or reordering columns does not change status mapping', () => {
  const configured = [...DEFAULT_KANBAN_COLUMNS]
    .reverse()
    .map((column) => ({ ...column, label: `Custom ${column.label}` }));
  const grouped = groupTasksByColumn([card({ status: 'Draft 2' })], configured);
  assert.equal(grouped.get('progress').length, 1);
});

test('server preferences restore fixed workflow mappings on the client', () => {
  const restored = restoreKanbanColumns([
    { id: 'review', label: 'Client Check', visible: true, statuses: ['Fake'] },
  ]);
  assert.deepEqual(restored[0].statuses, ['Final']);
  assert.equal(restored[0].targetStatus, 'Final');
  assert.equal(restored.find((column) => column.id === 'archive').visible, true);
});
