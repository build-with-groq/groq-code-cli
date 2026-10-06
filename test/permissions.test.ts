import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PermissionManager } from '../src/core/permissions.js';
import { TOOLS } from '../src/tools/registry.js';

test('reads are always allowed', (t) => {
  const pm = new PermissionManager(TOOLS);
  const check = pm.check('read_file', { file_path: 'foo.ts' });
  t.is(check.decision.status, 'allow');
});

test('writes without approval prompt', (t) => {
  const pm = new PermissionManager(TOOLS);
  const check = pm.check('edit_file', { file_path: 'src/a.ts', old_text: 'x', new_text: 'y' });
  t.is(check.decision.status, 'prompt');
});

test('dangerous commands prompt unless read-only', (t) => {
  const pm = new PermissionManager(TOOLS);
  const rmCheck = pm.check('execute_command', { command: 'rm -rf node_modules' });
  t.is(rmCheck.decision.status, 'prompt');

  const readCheck = pm.check('execute_command', { command: 'git status' });
  t.is(readCheck.decision.status, 'allow');
});

test('session auto-approve allows writes', (t) => {
  const pm = new PermissionManager(TOOLS);
  pm.setSessionAutoApprove(true);
  const check = pm.check('edit_file', { file_path: 'src/a.ts', old_text: 'x', new_text: 'y' });
  t.is(check.decision.status, 'allow');
});

test('approved path allows writes to that file', (t) => {
  const pm = new PermissionManager(TOOLS);
  pm.approvePath(path.resolve('src/approved.ts'));
  const check = pm.check('write_file', { file_path: 'src/approved.ts', content: 'x' });
  t.is(check.decision.status, 'allow');
  // Different path still prompts
  const other = pm.check('write_file', { file_path: 'src/other.ts', content: 'x' });
  t.is(other.decision.status, 'prompt');
});

test('skip-all bypasses everything', (t) => {
  const pm = new PermissionManager(TOOLS);
  pm.setSkipAll(true);
  const check = pm.check('execute_command', { command: 'rm -rf /' });
  t.is(check.decision.status, 'allow');
});

test('persistent allow rules from .permissions.json are loaded', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-perms-'));
  fs.writeFileSync(
    path.join(dir, '.permissions.json'),
    JSON.stringify({ allow: [{ tool: 'execute_command', arg: 'command', value: 'npm test' }] }),
  );

  // Ensure the permission manager can find .permissions.json
  // by setting its working directory to the temp dir via GROQ_PROJECT_ROOT.
  const prev = process.env.GROQ_PROJECT_ROOT;
  process.env.GROQ_PROJECT_ROOT = dir;
  try {
    const pm = new PermissionManager(TOOLS);
    const check = pm.check('execute_command', { command: 'npm test' });
    t.is(check.decision.status, 'allow');
  } finally {
    if (prev === undefined) delete process.env.GROQ_PROJECT_ROOT;
    else process.env.GROQ_PROJECT_ROOT = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace escape guard', (t) => {
  const pm = new PermissionManager(TOOLS);
  // Registry read_file already blocks escapes, but permission manager exposes the check.
  t.true(pm.isInsideWorkspace('src'));
  t.false(pm.isInsideWorkspace('../../etc'));
});