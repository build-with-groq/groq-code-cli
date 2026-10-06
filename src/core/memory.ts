import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Persistent memory for the assistant.
 *
 * Two sources (both optional):
 *   1. ~/.groq/memory.md       – user-level (your preferences, facts the model should always know)
 *   2. <project>/.groq/memory.md – project-level (project-specific notes)
 *
 * Memory is injected into the system prompt on startup and updated via /memory.
 * Format is plain markdown; each line under a ## heading is a "fact".
 */

const USER_MEMORY = path.join(os.homedir(), '.groq', 'memory.md');

function projectMemory(projectRoot?: string): string {
  const root = projectRoot || process.env.GROQ_PROJECT_ROOT || process.cwd();
  return path.join(root, '.groq', 'memory.md');
}

/** Read a single memory file, returning its content or empty string. */
function readMemoryFile(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

/** Read both memory sources and return the combined system-prompt fragment. */
export function loadMemory(projectRoot?: string): string {
  const user = readMemoryFile(USER_MEMORY);
  const project = readMemoryFile(projectMemory(projectRoot));
  const parts: string[] = [];
  if (project) parts.push(`Project memory (from .groq/memory.md):\n${project}`);
  if (user) parts.push(`User memory (from ~/.groq/memory.md):\n${user}`);
  return parts.join('\n\n');
}

/** Append a line to the project memory (or create the file). */
export function appendMemory(line: string, projectRoot?: string): void {
  const target = projectMemory(projectRoot);
  try {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    const existing = readMemoryFile(target);
    const sep = existing ? '\n' : '';
    fs.appendFileSync(target, `${sep}${line}\n`, 'utf-8');
  } catch (e) {
    // Memory append is best-effort.
  }
}

/** Overwrite the project memory file entirely. */
export function writeMemory(content: string, projectRoot?: string): void {
  const target = projectMemory(projectRoot);
  try {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
  } catch {
    // Best-effort.
  }
}

/** Read the full user-level memory for display in /memory. */
export function getUserMemory(): string {
  return readMemoryFile(USER_MEMORY);
}

/** Write user-level memory (for /memory --set). */
export function writeUserMemory(content: string): void {
  try {
    const dir = path.dirname(USER_MEMORY);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_MEMORY, content, 'utf-8');
  } catch {
    // Best-effort.
  }
}

/** Read full project memory for display. */
export function getProjectMemory(projectRoot?: string): string {
  return readMemoryFile(projectMemory(projectRoot));
}
