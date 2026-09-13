import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TOOLS, getTool, getAllTools, normalizeToolName } from '../src/tools/registry.js';
import { WEB_TOOLS } from '../src/tools/web.js';

function tempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-reg-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'const a = 1;\nconst b = 2;\n');
  return dir;
}

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

test.serial('registry exposes all core tools with correct permission levels', (t) => {
  const names = getAllTools().map((x) => x.name);
  t.true(names.includes('read_file'));
  t.true(names.includes('edit_file'));
  t.true(names.includes('execute_command'));
  t.true(names.includes('git_status'));
  const webNames = WEB_TOOLS.map((x) => x.name);
  t.true(webNames.includes('web_search'));
  t.true(webNames.includes('web_fetch'));
  const read = getTool('read_file')!;
  t.is(read.permission, 'read');
  const write = getTool('write_file')!;
  t.is(write.permission, 'write');
  const cmd = getTool('execute_command')!;
  t.is(cmd.permission, 'dangerous');
});

test.serial('normalizeToolName strips repo_browser prefix', (t) => {
  t.is(normalizeToolName('repo_browser.read_file'), 'read_file');
  t.is(normalizeToolName('read_file'), 'read_file');
});

test.serial('read_file enforces workspace boundary', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-reg-escape-'));
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'top-secret');
  await withRoot(dir, async () => {
    const tool = getTool('read_file')!;
    const r = await tool.run({ file_path: '../secret.txt' });
    t.is(r.success, false);
    t.true(String(r.error).includes('escapes'));
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.serial('read_file reads content and line slices', async (t) => {
  const dir = tempProject();
  await withRoot(dir, async () => {
    const tool = getTool('read_file')!;
    const full = await tool.run({ file_path: 'src/a.ts' });
    t.is(full.success, true, 'full read failed: ' + JSON.stringify(full));
    t.true(String(full.content).includes('const a = 1;'));

    const slice = await tool.run({ file_path: 'src/a.ts', start_line: 2, end_line: 2 });
    t.is(slice.success, true, 'slice failed: ' + JSON.stringify(slice));
    t.is(slice.content, 'const b = 2;');
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.serial('write_file creates file; edit_file replaces exact text', async (t) => {
  const dir = tempProject();
  await withRoot(dir, async () => {
    const write = getTool('write_file')!;
    const w = await write.run({ file_path: 'new.md', content: '# Hi' });
    t.is(w.success, true);
    t.is(fs.readFileSync(path.join(dir, 'new.md'), 'utf-8'), '# Hi');

    const edit = getTool('edit_file')!;
    const e = await edit.run({ file_path: 'src/a.ts', old_text: 'const b = 2;', new_text: 'const b = 3;' });
    t.is(e.success, true);
    t.true(fs.readFileSync(path.join(dir, 'src', 'a.ts'), 'utf-8').includes('const b = 3;'));
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.serial('edit_file append mode with empty old_text', async (t) => {
  const dir = tempProject();
  await withRoot(dir, async () => {
    const edit = getTool('edit_file')!;
    const e = await edit.run({ file_path: 'src/a.ts', old_text: '', new_text: 'const c = 3;' });
    t.is(e.success, true);
    const content = fs.readFileSync(path.join(dir, 'src', 'a.ts'), 'utf-8');
    t.true(content.includes('const c = 3;'));
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.serial('search_files finds text', async (t) => {
  const dir = tempProject();
  await withRoot(dir, async () => {
    const tool = getTool('search_files')!;
    const r = await tool.run({ pattern: 'const a', directory: '.' });
    t.is(r.success, true);
    const files = r.content as string[];
    t.true(files.some((f) => f.includes('a.ts')));
  });
  fs.rmSync(dir, { recursive: true, force: true });
});