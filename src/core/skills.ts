import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Skills system.
 *
 * Skills are directories containing a SKILL.md (frontmatter + instructions)
 * plus optional helper files. They are discoverable in two places:
 *   1. `<project>/.groq/skills/<name>/SKILL.md`  (project skills)
 *   2. `~/.groq/skills/<name>/SKILL.md`          (user skills)
 *
 * The system prompt includes a condensed index of available skills so the
 * model can ask the user to activate one (or the user can with /skills).
 */

export interface Skill {
  name: string;
  description: string;
  path: string;
  /** Full SKILL.md content (for load). */
  content?: string;
}

function parseFrontmatter(md: string): { description: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md.trimStart());
  let description = '';
  let body = md;
  if (m) {
    body = m[2];
    const fm = m[1];
    const dm = /description:\s*(.+)/.exec(fm);
    if (dm) description = dm[1].trim().replace(/^["']|["']$/g, '');
  }
  return { description, body };
}

function listFromDir(dir: string): Skill[] {
  if (!fs.existsSync(dir)) return [];
  const out: Skill[] = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const skillDir = path.join(dir, name.name);
    const mdFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(mdFile)) continue;
    let description = '';
    try {
      const raw = fs.readFileSync(mdFile, 'utf-8');
      description = parseFrontmatter(raw).description;
    } catch { /* skip unreadable */ }
    out.push({ name: name.name, description, path: skillDir });
  }
  return out;
}

export function listSkills(): Skill[] {
  const root = process.env.GROQ_PROJECT_ROOT ? path.resolve(process.env.GROQ_PROJECT_ROOT) : process.cwd();
  const projectDir = path.join(root, '.groq', 'skills');
  const userDir = path.join(os.homedir(), '.groq', 'skills');
  return [...listFromDir(projectDir), ...listFromDir(userDir)];
}

export function getSkill(name: string): Skill | null {
  const found = listSkills().find((s) => s.name === name);
  if (!found) return null;
  try {
    found.content = fs.readFileSync(path.join(found.path, 'SKILL.md'), 'utf-8');
  } catch {
    found.content = '';
  }
  return found;
}

/** A compact index for the system prompt. */
export function skillsIndex(): string {
  const skills = listSkills();
  if (skills.length === 0) return 'No skills installed.';
  return skills.map((s) => `- ${s.name}: ${s.description || '(no description)'}`).join('\n');
}