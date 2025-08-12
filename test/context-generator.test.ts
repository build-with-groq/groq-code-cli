import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateProjectContext, writeProjectContext } from '../src/utils/context.js';

function makeTempProject(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-context-'));
  // Create files and dirs
  fs.mkdirSync(path.join(tmp, 'src'));
  fs.mkdirSync(path.join(tmp, 'docs'));
  fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(tmp, 'README.md'), '# Readme\n');
  fs.writeFileSync(path.join(tmp, 'docs', 'guide.md'), '# Guide\n');
  fs.writeFileSync(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'tmp-proj', version: '0.1.0', scripts: { build: 'tsc' } }, null, 2),
    'utf-8'
  );
  return tmp;
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test('generateProjectContext returns summary, languages, and lists', t => {
  const root = makeTempProject();
  try {
    const { json, markdown } = generateProjectContext(root, { maxDepth: 4 });

    t.truthy(json.generated_at);
    t.is(json.root, path.resolve(root));
    t.true(json.summary.total_files >= 3);
    t.true(json.summary.total_directories >= 2);
    t.true(json.summary.languages.length >= 1);
    t.true(Array.isArray(json.config_files));
    t.true(Array.isArray(json.notable_files));
    t.true(Array.isArray(json.tree));
    t.true(markdown.includes('# Project Context'));
    t.true(markdown.includes('## Directory Tree'));
  } finally {
    cleanupTempDir(root);
  }
});

test('writeProjectContext writes .groq/context.{md,json}', t => {
  const root = makeTempProject();
  try {
    const { mdPath, jsonPath } = writeProjectContext(root, { maxDepth: 4 });

    t.true(fs.existsSync(mdPath));
    t.true(fs.existsSync(jsonPath));

    const md = fs.readFileSync(mdPath, 'utf-8');
    const obj = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    t.true(md.includes('Project Context'));
    t.is(obj.root, path.resolve(root));
  } finally {
    cleanupTempDir(root);
  }
});
