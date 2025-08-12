import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../src/core/agent.js';

function setupDirWithContext(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-agentctx-'));
  const ctxDir = path.join(tmp, '.groq');
  fs.mkdirSync(ctxDir);
  fs.writeFileSync(path.join(ctxDir, 'context.md'), 'HelloCtx\n');
  return tmp;
}

function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test('Agent auto-loads .groq/context.md as system message', async t => {
  const dir = setupDirWithContext();
  const original = { ...process.env };
  (process.env as any).GROQ_CONTEXT_DIR = dir;
  try {
    const agent = await Agent.create('test-model', 1.0, null, false);
    const msgs = (agent as any).messages as Array<{ role: string; content: string }>;
    const found = msgs.find(m => m.role === 'system' && m.content.includes('Project context loaded from .groq/context.md'));
    t.truthy(found);
    t.true(found!.content.includes('HelloCtx'));
  } finally {
    // restore env
    for (const k of Object.keys(process.env)) delete (process.env as any)[k];
    Object.assign(process.env, original);
    cleanupDir(dir);
  }
});

test('Agent handles missing context gracefully', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-nocontext-'));
  const original = { ...process.env };
  (process.env as any).GROQ_CONTEXT_DIR = dir;
  try {
    const agent = await Agent.create('test-model', 1.0, null, false);
    const msgs = (agent as any).messages as Array<{ role: string; content: string }>;
    // Should only have the default system message
    t.is(msgs.filter(m => m.role === 'system').length, 1);
    t.false(msgs[0].content.includes('Project context loaded'));
  } finally {
    for (const k of Object.keys(process.env)) delete (process.env as any)[k];
    Object.assign(process.env, original);
    cleanupDir(dir);
  }
});
