import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listSkills, getSkill, skillsIndex } from '../src/core/skills.js';
import { McpClient } from '../src/core/mcp.js';

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

test('skills are discovered from project .groq/skills', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-skills-'));
  const skillDir = path.join(dir, '.groq', 'skills', 'test-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\ndescription: A test skill\n---\n\nUse test-skill to verify skill loading.',
  );

  await withRoot(dir, async () => {
    const skills = listSkills();
    t.true(skills.some((s) => s.name === 'test-skill' && s.description === 'A test skill'));

    const loaded = getSkill('test-skill');
    t.truthy(loaded);
    t.true(String(loaded!.content).includes('verify skill loading'));

    const idx = skillsIndex();
    t.true(idx.includes('test-skill'));
  });

  fs.rmSync(dir, { recursive: true, force: true });
});

test('skill index when none exist is graceful', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-noskills-'));
  await withRoot(dir, async () => {
    t.true(skillsIndex().length > 0);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('MCP config file parsing', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-mcp-'));
  const configPath = path.join(dir, 'mcp.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      servers: {
        filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
      },
    }),
  );

  const configs = McpClient.fromConfigFile(configPath);
  t.true('filesystem' in configs);
  t.is(configs.filesystem.command, 'npx');
  t.true(Array.isArray(configs.filesystem.args));

  fs.rmSync(dir, { recursive: true, force: true });
});