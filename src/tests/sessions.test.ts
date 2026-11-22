import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../core/agent.js';
import { listSessions, loadSession, latestSession, saveSession, emptyUsage, makeTitle } from '../utils/sessions.js';

function withTempDir(fn: () => Promise<void> | void) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-sessions-'));
    const prev = process.env.GROQ_SESSIONS_DIR;
    process.env.GROQ_SESSIONS_DIR = dir;
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.GROQ_SESSIONS_DIR;
      else process.env.GROQ_SESSIONS_DIR = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

function fakeSession(id: string, cwd: string, updatedAt: string) {
  return {
    id,
    cwd,
    model: 'test-model',
    title: `session ${id}`,
    createdAt: updatedAt,
    updatedAt,
    usage: { ...emptyUsage(), totalTokens: 100 },
    messages: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ],
  };
}

test.serial('saves, lists and loads sessions per directory', async t => {
  await withTempDir(() => {
    saveSession(fakeSession('20250101-100000-aaaa', '/proj/a', '2025-01-01T10:00:00.000Z'));
    saveSession(fakeSession('20250102-100000-bbbb', '/proj/a', '2025-01-02T10:00:00.000Z'));
    saveSession(fakeSession('20250103-100000-cccc', '/proj/b', '2025-01-03T10:00:00.000Z'));

    const inA = listSessions({ cwd: '/proj/a' });
    t.deepEqual(inA.map(s => s.id), ['20250102-100000-bbbb', '20250101-100000-aaaa']);
    t.is(inA[0].messageCount, 1);
    t.is(listSessions({ allDirs: true }).length, 3);

    t.is(latestSession('/proj/a')?.id, '20250102-100000-bbbb');
    t.is(loadSession('20250103')?.id, '20250103-100000-cccc');
    // ambiguous prefix
    t.is(loadSession('2025010'), null);
    t.is(loadSession('../../etc/passwd'), null);
  })();
});

test.serial('agent persists history and usage, and can resume it', async t => {
  await withTempDir(async () => {
    const agent = await Agent.create('test-model', 1.0, null, false);
    const id = agent.getSessionId();

    // simulate a finished turn without hitting the API
    (agent as any).messages.push({ role: 'user', content: 'fix the bug in utils' });
    (agent as any).messages.push({ role: 'assistant', content: 'done' });
    (agent as any).sessionUsage.totalTokens = 42;
    (agent as any).persistSession();

    const saved = loadSession(id);
    t.truthy(saved);
    t.is(saved!.title, 'fix the bug in utils');
    t.is(saved!.usage.totalTokens, 42);
    t.false(saved!.messages.some(m => m.role === 'system'));

    const other = await Agent.create('test-model', 1.0, null, false);
    other.resumeSession(saved!);
    t.is(other.getSessionId(), id);
    t.is(other.getHistory().length, 2);
    t.is(other.getSessionUsage().totalTokens, 42);

    other.clearHistory();
    t.is(other.getHistory().length, 0);
    t.not(other.getSessionId(), id);
  })();
});

test('makeTitle trims long input', t => {
  t.is(makeTitle('  a\n  b  '), 'a b');
  t.is(makeTitle('x'.repeat(100)).length, 60);
});
