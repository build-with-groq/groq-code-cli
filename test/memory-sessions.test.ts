import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadMemory, writeMemory, getProjectMemory, appendMemory } from '../src/core/memory.js';
import { saveSession, listSessions, loadSession, deleteSession } from '../src/core/sessions.js';
import type { AgentMessage } from '../src/core/context.js';

async function withRoot<T>(dir: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = process.env.GROQ_PROJECT_ROOT;
  process.env.GROQ_PROJECT_ROOT = dir;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.GROQ_PROJECT_ROOT;
    else process.env.GROQ_PROJECT_ROOT = prev;
  }
}

test.serial('memory writes and reads back', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-mem-'));
  await withRoot(dir, async () => {
    writeMemory('prefers python over js');
    t.is(getProjectMemory(), 'prefers python over js');
    const loaded = loadMemory();
    t.true(loaded.includes('prefers python over js'));
    appendMemory('uses ruff for linting');
    t.true(getProjectMemory().includes('uses ruff'));
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.serial('memory is empty when no file exists', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-nomem-'));
  await withRoot(dir, async () => {
    t.is(getProjectMemory(), '');
    t.is(loadMemory(), '');
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.serial('session save/load round-trips messages', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-sess-'));
  await withRoot(dir, async () => {
    const msgs: AgentMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'call_1' },
    ];
    const file = saveSession(msgs);
    t.true(fs.existsSync(file));

    const sessions = listSessions();
    t.is(sessions.length, 1);
    t.is(sessions[0].messageCount, 3);

    const loaded = loadSession(file)!;
    t.is(loaded.length, 3);
    t.is(loaded[0].role, 'user');
    t.is(loaded[1].content, 'hi there');
    t.is(loaded[2].tool_call_id, 'call_1');

    t.true(deleteSession(file));
    t.is(listSessions().length, 0);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});