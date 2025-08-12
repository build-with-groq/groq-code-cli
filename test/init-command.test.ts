import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initCommand } from '../src/commands/definitions/init.js';

function makeTempProject(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-initcmd-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'p', version: '0.0.0' }));
  return tmp;
}

test('/init command generates context and posts system message', t => {
  const root = makeTempProject();
  const messages: any[] = [];
  const original = process.env.GROQ_CONTEXT_DIR;
  process.env.GROQ_CONTEXT_DIR = root;
  try {
    initCommand.handler({
      addMessage: (m: any) => messages.push(m),
      clearHistory: () => {},
      setShowLogin: () => {},
    });

    const ctxDir = path.join(root, '.groq');
    t.true(fs.existsSync(path.join(ctxDir, 'context.md')));
    t.true(fs.existsSync(path.join(ctxDir, 'context.json')));
    t.true(fs.statSync(path.join(ctxDir, 'context.md')).size > 0);
    t.true(fs.statSync(path.join(ctxDir, 'context.json')).size > 0);

    t.true(messages.some(m => m.role === 'system' && String(m.content).includes('Project context generated.')));
  } finally {
    if (original === undefined) {
      delete (process.env as any).GROQ_CONTEXT_DIR;
    } else {
      process.env.GROQ_CONTEXT_DIR = original;
    }
    // Cleanup temporary project directory
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});
