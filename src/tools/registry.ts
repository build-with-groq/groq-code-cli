import * as fs from 'fs';
import * as path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition, ToolResult } from '../types.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function success(content?: any, message = ''): ToolResult {
  return { success: true, content, message };
}

function fail(error: string): ToolResult {
  return { success: false, error };
}

/** Resolve the workspace root (overridable for tests via GROQ_PROJECT_ROOT). */
function workspaceRoot(): string {
  return process.env.GROQ_PROJECT_ROOT ? path.resolve(process.env.GROQ_PROJECT_ROOT) : path.resolve(process.cwd());
}

/** Resolve a workspace-relative path to absolute, rejecting escapes outside the repo. */
function resolveInWorkspace(p: string): { ok: boolean; abs?: string; error?: string } {
  const cwd = workspaceRoot();
  const abs = path.resolve(cwd, p);
  if (abs !== cwd && !abs.startsWith(cwd + path.sep)) {
    return { ok: false, error: `Path escapes the project directory: ${p}` };
  }
  return { ok: true, abs };
}

/** Read a file (always allowed, workspace-only by default). */
async function readFile(args: Record<string, any>): Promise<ToolResult> {
  const filePath = String(args.file_path || '');
  const r = resolveInWorkspace(filePath);
  if (!r.ok) return fail(r.error!);
  const abs = r.abs!;
  try {
    const stats = await fs.promises.stat(abs);
    if (!stats.isFile()) return fail('Path is not a file');
    if (stats.size > 10 * 1024 * 1024) return fail('File too large (max 10MB)');
    const content = await fs.promises.readFile(abs, 'utf-8');
    const lines = content.split('\n');
    if (args.start_line !== undefined) {
      const start = Math.max(0, Number(args.start_line) - 1);
      const end = args.end_line !== undefined ? Math.min(lines.length, Number(args.end_line)) : lines.length;
      if (start >= lines.length) return fail('Start line exceeds file length');
      const sel = lines.slice(start, end).join('\n');
      return success(sel, `Read lines ${args.start_line}-${end} of ${filePath}`);
    }
    return success(content, `Read ${lines.length} lines from ${filePath}`);
  } catch (e: any) {
    if (e.code === 'ENOENT') return fail('File not found');
    return fail('Failed to read file');
  }
}

async function writeFile2(args: Record<string, any>): Promise<ToolResult> {
  const filePath = String(args.file_path || '');
  const r = resolveInWorkspace(filePath);
  if (!r.ok) return fail(r.error!);
  const abs = r.abs!;
  const content = String(args.content ?? '');
  try {
    const exists = fs.existsSync(abs);
    if (exists && !args.overwrite) {
      return fail('File already exists; use overwrite=true to replace, or edit_file to modify');
    }
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, 'utf-8');
    return success(undefined, exists ? `Overwrote ${filePath}` : `Created ${filePath}`);
  } catch {
    return fail('Failed to write file');
  }
}

async function editFile(args: Record<string, any>): Promise<ToolResult> {
  const filePath = String(args.file_path || '');
  const r = resolveInWorkspace(filePath);
  if (!r.ok) return fail(r.error!);
  const abs = r.abs!;
  const oldText = String(args.old_text ?? '');
  const newText = String(args.new_text ?? '');
  try {
    if (!fs.existsSync(abs)) return fail('File not found');
    const original = await fs.promises.readFile(abs, 'utf-8');
    if (!oldText) {
      // Append mode: old_text empty + new_text set means append at end.
      if (original.endsWith('\n') || original === '') {
        await fs.promises.writeFile(abs, original + newText, 'utf-8');
        return success(undefined, `Appended to ${filePath}`);
      }
      return fail('old_text must be provided');
    }
    if (!original.includes(oldText)) {
      return fail(`old_text not found in ${filePath}. Read the file first and match exactly.`);
    }
    const updated = args.replace_all
      ? original.split(oldText).join(newText)
      : original.replace(oldText, newText);
    await fs.promises.writeFile(abs, updated, 'utf-8');
    const label = args.replace_all ? 'Replaced all occurrences' : 'Replaced';
    return success(undefined, `${label} in ${filePath}`);
  } catch (e: any) {
    return fail(`Failed to edit file: ${e.message}`);
  }
}

async function listFiles(args: Record<string, any>): Promise<ToolResult> {
  const dir = path.resolve(workspaceRoot(), String(args.directory || '.'));
  const onlyDirs = args.dirs_only === true;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith('.') || args.show_hidden === true)
      .filter((e) => !(onlyDirs && !e.isDirectory()))
      .map((e) => e.name + (e.isDirectory() ? '/' : ''))
      .sort();
    return success(items, `Listed ${dir}`);
  } catch {
    return fail('Directory not found or unreadable');
  }
}

async function searchFiles(args: Record<string, any>): Promise<ToolResult> {
  const pattern = String(args.pattern || '');
  const dir = path.resolve(workspaceRoot(), String(args.directory || '.'));
  const glob = String(args.glob || '**/*');
  try {
    // Use rg if available for speed; fall back to a simple recursive walk.
    try {
      const { stdout } = await execFileAsync('rg', ['-l', '--no-ignore', '--hidden', '-g', glob, '--', pattern, dir], { timeout: 15000 });
      const files = stdout.split('\n').filter(Boolean);
      return success(files.slice(0, 200), `Found ${files.length} file(s) matching "${pattern}"`);
    } catch {
      // rg not installed or no matches; fall back to Node walk.
      const matches: string[] = [];
      const walk = async (p: string): Promise<void> => {
        const entries = await fs.promises.readdir(p, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          if (e.name.startsWith('.') && !['.gitignore'].includes(e.name)) continue;
          if (e.name === 'node_modules') continue;
          const full = path.join(p, e.name);
          if (e.isDirectory()) await walk(full);
          else {
            try {
              const content = await fs.promises.readFile(full, 'utf-8');
              if (content.includes(pattern)) matches.push(full.slice(dir.length + 1));
            } catch { /* skip binary */ }
          }
        }
      };
      await walk(dir);
      return success(matches.slice(0, 200), `Found ${matches.length} file(s) matching "${pattern}"`);
    }
  } catch {
    return fail('Search failed');
  }
}

/** Shell command execution. Read-only commands can auto-approve; others prompt. */
async function runCommand(args: Record<string, any>): Promise<ToolResult> {
  const command = String(args.command || '');
  const timeoutMs = Math.min(Number(args.timeout ?? 60), 600) * 1000;
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
    return success({ stdout, stderr, exitCode: 0 }, 'Command completed');
  } catch (e: any) {
    if ((e as any).signal === 'SIGTERM') {
      return fail(`Command timed out after ${timeoutMs / 1000}s: ${command}`);
    }
    const out = (e as any).stdout || '';
    const err = (e as any).stderr || String(e.message || e);
    return success({ stdout: out, stderr: err, exitCode: (e as any).code ?? 1 }, 'Command finished with non-zero exit');
  }
}

const READ_COMMANDS = /^(ls|cat|head|tail|grep|rg|find|pwd|whoami|echo|date|stat|file|wc|which|type|npm\s+(run\s+\S+)?\s*$|git\s+(status|diff|log|show|branch|remote|config))/;

function classifyCommand(command: string): string {
  // Returns 'read' | 'write' | 'dangerous'
  const trimmed = command.trim();
  if (trimmed.startsWith('python') || trimmed.startsWith('node')) {
    return trimmed.includes('>') || trimmed.includes('rm ') ? 'dangerous' : 'write';
  }
  const readMatch = READ_COMMANDS.test(trimmed);
  const dangerous = /(rm\s+-rf|sudo|mkfs|shutdown|reboot|dd\s|:\(\)|curl\s+.*\||wget\s+.*\||npm\s+i\s+-g)/.test(trimmed);
  if (dangerous) return 'dangerous';
  if (readMatch) return 'read';
  return 'write';
}

async function gitStatus(): Promise<ToolResult> {
  try {
    const { stdout } = await execAsync('git status --short 2>&1', { timeout: 10000 });
    if (!stdout.trim()) return success('Working tree is clean.');
    return success(stdout, 'Git status');
  } catch (e: any) {
    return fail(`git status failed: ${e.message}`);
  }
}

async function gitDiff(args: Record<string, any>): Promise<ToolResult> {
  try {
    const target = args.path ? ` -- ${args.path}` : '';
    const { stdout } = await execAsync(`git diff --stat${target}`, { timeout: 10000 });
    return success(stdout || 'No diff (clean working tree).', 'git diff');
  } catch (e: any) {
    return fail(`git diff failed: ${e.message}`);
  }
}

/** Compact repository overview: top-level dirs, file counts, and notable files. */
async function showTree(): Promise<ToolResult> {
  let files: string[] = [];
  try {
    const { stdout } = await execFileAsync('git', ['ls-files'], { timeout: 10000 });
    if (stdout) files = stdout.split('\n').filter(Boolean);
  } catch { /* not a git repo */ }

  if (files.length === 0) {
    // Fall back to a shallow directory listing.
    return listFiles({ directory: '.', dirs_only: false });
  }

  // Top-level layout: directories and loose files.
  const topDirs = new Map<string, number>();
  const loose: string[] = [];
  for (const f of files) {
    const parts = f.split('/');
    if (parts.length === 1) loose.push(f);
    else topDirs.set(parts[0], (topDirs.get(parts[0]) || 0) + 1);
  }

  const lines: string[] = [];
  lines.push(`${files.length} tracked files. Top-level layout:`);
  if (topDirs.size > 0) {
    lines.push(...[...topDirs.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([d, n]) => `  ${d}/ (${n} files)`));
  }
  for (const f of loose) lines.push(`  ${f}`);
  if (topDirs.size === 0 && loose.length === 0) lines.push('  (empty repo)');

  return success(lines.join('\n'), 'Repository overview');
}

const tools = {
  read_file: { name: 'read_file', args: { file_path: 'string', start_line: 'integer?', end_line: 'integer?' } },
  write_file: { name: 'write_file', args: { file_path: 'string', content: 'string' } },
  edit_file: { name: 'edit_file', args: { file_path: 'string', old_text: 'string', new_text: 'string', replace_all: 'boolean?' } },
  list_files: { name: 'list_files', args: { directory: 'string?', dirs_only: 'boolean?' } },
  search_files: { name: 'search_files', args: { pattern: 'string', directory: 'string?', glob: 'string?' } },
  execute_command: { name: 'execute_command', args: { command: 'string', timeout: 'integer?' } },
  git_status: { name: 'git_status', args: {} },
  git_diff: { name: 'git_diff', args: { path: 'string?' } },
};

export const TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read a file. Provide a file_path relative to the project root. Use optional start_line/end_line to read a slice (1-indexed). Use this before edit_file.',
    permission: 'read',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path relative to project root, e.g. src/index.ts' },
        start_line: { type: 'integer', description: 'Optional 1-indexed start line' },
        end_line: { type: 'integer', description: 'Optional 1-indexed end line' },
      },
      required: ['file_path'],
    },
    run: readFile,
  },
  {
    name: 'write_file',
    description: 'Create a new file (or overwrite with overwrite=true) with the given content. parent directories are created automatically.',
    permission: 'write',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path relative to project root' },
        content: { type: 'string', description: 'Full file content to write' },
        overwrite: { type: 'boolean', description: 'Set true to overwrite an existing file' },
      },
      required: ['file_path', 'content'],
    },
    run: writeFile2,
  },
  {
    name: 'edit_file',
    description: 'Edit an existing file by replacing exact text. old_text must match EXACTLY (including whitespace) — read the file first. If old_text is empty, appends new_text at the end.',
    permission: 'write',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path relative to project root' },
        old_text: { type: 'string', description: 'Exact text to replace (empty = append)' },
        new_text: { type: 'string', description: 'Replacement text' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences' },
      },
      required: ['file_path', 'old_text', 'new_text'],
    },
    run: editFile,
  },
  {
    name: 'list_files',
    description: 'List files and directories in a directory. Include dirs_only=true to only show directories.',
    permission: 'read',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory relative to project root (default ".")' },
        dirs_only: { type: 'boolean' },
        show_hidden: { type: 'boolean' },
      },
      required: [],
    },
    run: listFiles,
  },
  {
    name: 'search_files',
    description: 'Recursively search for a string pattern in files. Fast with ripgrep if installed.',
    permission: 'read',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'String to search for' },
        directory: { type: 'string', description: 'Directory to search (default ".")' },
        glob: { type: 'string', description: 'File glob, e.g. "**/*.ts" (default "**/*")' },
      },
      required: ['pattern'],
    },
    run: searchFiles,
  },
  {
    name: 'execute_command',
    description: 'Run a shell command in the project directory. Read-only commands (ls, cat, grep, git status/diff) run automatically. Other commands ask for approval. Never run interactive or long-running servers.',
    permission: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to run' },
        timeout: { type: 'integer', description: 'Max seconds (default 60)' },
      },
      required: ['command'],
    },
    run: runCommand,
    autoApprove: (args) => classifyCommand(String(args.command || '')) === 'read',
  },
  {
    name: 'git_status',
    description: 'Show uncommitted changes (git status --short).',
    permission: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
    run: gitStatus,
  },
  {
    name: 'git_diff',
    description: 'Show a diff summary of uncommitted changes, optionally for one path.',
    permission: 'read',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Optional path to filter' } },
      required: [],
    },
    run: gitDiff,
  },
  {
    name: 'project_tree',
    description: 'Show the repository file tree (via git ls-files) for orientation.',
    permission: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
    run: showTree,
  },
];

/** Map from tool name to its definition. */
const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_MAP.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return TOOLS;
}

/** Strip a common repo_browser / mcp__ prefix that models sometimes emit. */
export function normalizeToolName(name: string): string {
  if (name.startsWith('repo_browser.')) return name.slice('repo_browser.'.length);
  return name;
}