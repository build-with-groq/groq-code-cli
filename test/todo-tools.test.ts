import test from 'ava';
import { getTool, getCurrentTasks } from '../src/tools/registry.js';

test('create_tasks then update_tasks drives a task list', async (t) => {
  const create = getTool('create_tasks')!;
  const update = getTool('update_tasks')!;

  const r = await create.run({
    user_query: 'build a calculator',
    tasks: [
      { id: '1', description: 'make parser' },
      { id: '2', description: 'make eval' },
    ],
  });
  t.is(r.success, true);

  let state = getCurrentTasks();
  t.truthy(state);
  t.is(state!.tasks.length, 2);
  t.is(state!.tasks[0].status, 'pending');

  const u = await update.run({ task_updates: [{ id: '1', status: 'in_progress' }] });
  t.is(u.success, true);

  state = getCurrentTasks();
  t.is(state!.tasks[0].status, 'in_progress');

  const u2 = await update.run({ task_updates: [{ id: '1', status: 'completed' }, { id: '2', status: 'completed' }] });
  t.is(u2.success, true);
  state = getCurrentTasks();
  t.is(state!.tasks.filter((x) => x.status === 'completed').length, 2);
});

test('create_tasks validates required fields', async (t) => {
  const create = getTool('create_tasks')!;
  const bad = await create.run({ user_query: 'x', tasks: [{ description: 'no id' }] });
  t.is(bad.success, false);
  const empty = await create.run({ user_query: 'x', tasks: [] });
  t.is(empty.success, false);
});