import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { PermissionCheck, PermissionDecision, ToolDefinition, ToolSchema } from '../types.js';

/**
 * Permission system for the agent harness.
 *
 * Tools are classified as `read`, `write`, or `dangerous`. Reads inside the
 * project are always allowed. Writes and dangerous tools prompt the user
 * unless an allowlist entry covers the exact path/command, the user has
 * enabled session auto-approve, or `--dangerously-skip-permissions` was
 * passed at startup.
 */

export interface PermissionRule {
  /** Tool name this rule applies to (e.g. 'edit_file', 'execute_command'). */
  tool: string;
  /** Optional argument key the rule constrains (e.g. 'file_path' or 'command'). */
  arg?: string;
  /** Exact value (if a string) or substring (if a RegExp). */
  value?: string | RegExp;
}

export interface PermissionSettings {
  /** Rules that always allow, loaded from project or user config. */
  allow: PermissionRule[];
  /** Startup override: skip all permission prompts. */
  skipAll: boolean;
}

const DEFAULT_SETTINGS: PermissionSettings = { allow: [], skipAll: false };

/** Read .permissions.json from the project and user home. */
function loadSettingsFiles(): PermissionSettings {
  const merged: PermissionSettings = { ...DEFAULT_SETTINGS, allow: [] };
  const root = process.env.GROQ_PROJECT_ROOT ? path.resolve(process.env.GROQ_PROJECT_ROOT) : process.cwd();
  const candidates = [
    path.join(root, '.permissions.json'),
    path.join(process.cwd(), '.permissions.json'),
    path.join(os.homedir(), '.groq', 'permissions.json'),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(raw.allow)) {
        merged.allow.push(...raw.allow.map(normalizeRule));
      }
      if (raw.skipAll === true) merged.skipAll = true;
    } catch {
      // Ignore malformed permission files; fail safe (prompt).
    }
  }
  return merged;
}

function normalizeRule(rule: any): PermissionRule {
  const r: PermissionRule = { tool: String(rule.tool ?? '') };
  if (rule.arg) r.arg = String(rule.arg);
  if (typeof rule.value === 'string') r.value = rule.value;
  if (rule.pattern !== undefined) {
    try {
      r.value = new RegExp(rule.pattern);
    } catch {
      // ignore bad regex
    }
  }
  return r;
}

export class PermissionManager {
  private settings: PermissionSettings;
  private sessionAutoApprove = false;
  /** Paths the user has approved for editing this session. */
  private approvedPaths = new Set<string>();
  private toolDefs: Map<string, ToolDefinition>;

  constructor(toolDefs: ToolDefinition[]) {
    this.settings = loadSettingsFiles();
    this.toolDefs = new Map(toolDefs.map((t) => [t.name, t]));
  }

  get autoApproveEnabled(): boolean {
    return this.sessionAutoApprove;
  }

  setSessionAutoApprove(enabled: boolean): void {
    this.sessionAutoApprove = enabled;
  }

  setSkipAll(skip: boolean): void {
    this.settings.skipAll = skip;
  }

  /** Approve editing a specific path for the rest of the session. */
  approvePath(p: string): void {
    this.approvedPaths.add(path.resolve(p));
  }

  /** Resolve a workspace path (honors GROQ_PROJECT_ROOT for tests/tools). */
  private workspaceResolve(p: string): string {
    const root = process.env.GROQ_PROJECT_ROOT ? path.resolve(process.env.GROQ_PROJECT_ROOT) : path.resolve(process.cwd());
    return path.resolve(root, p);
  }

  /** Human-readable summary of current permission state. */
  describe(): string {
    const parts: string[] = [];
    if (this.settings.skipAll) parts.push('DANGEROUS SKIP-ALL is ON (--dangerously-skip-permissions). Tools never prompt.');
    if (this.sessionAutoApprove) parts.push('Session auto-approve is ON: edits run without prompting.');
    parts.push(`${this.settings.allow.length} persistent allow rules loaded.`);
    if (this.approvedPaths.size > 0) {
      parts.push(`${this.approvedPaths.size} path(s) approved this session.`);
    }
    return parts.join('\n');
  }

  /**
   * Decide whether a tool call may proceed. Returns either an allow/deny
   * decision, or a request to prompt the user.
   */
  check(toolName: string, args: Record<string, any>): PermissionCheck {
    const def = this.toolDefs.get(toolName);
    const level = def?.permission ?? 'dangerous'; // unknown tools = dangerous
    const ap = def?.autoApprove;

    // Skip-all flag overrides everything.
    if (this.settings.skipAll) {
      return { decision: { status: 'allow' } };
    }

    // Tool-level allowlist rules.
    if (this.matchesRule(toolName, args)) {
      return { decision: { status: 'allow' } };
    }

    if (level === 'read') {
      // Reads are always allowed (but still inside the workspace).
      return { decision: { status: 'allow' } };
    }

    // Writes to an already-approved path skip the prompt.
    if (level === 'write' && args.file_path) {
      const abs = this.workspaceResolve(args.file_path);
      if (this.approvedPaths.has(abs)) {
        return { decision: { status: 'allow' } };
      }
    }

    if (this.sessionAutoApprove && level === 'write') {
      return { decision: { status: 'allow' } };
    }

    // Tool-supplied auto-approve predicate (e.g. command is read-only).
    if (ap && ap(args)) {
      return { decision: { status: 'allow' } };
    }

    return { decision: { status: 'prompt' }, autoApproveSession: level === 'write' };
  }

  private matchesRule(toolName: string, args: Record<string, any>): boolean {
    for (const rule of this.settings.allow) {
      if (rule.tool !== toolName) continue;
      if (!rule.arg) return true; // tool-wide allow
      const val = args[rule.arg];
      if (val === undefined) continue;
      const str = String(val);
      if (typeof rule.value === 'string' && str === rule.value) return true;
      if (rule.value instanceof RegExp && rule.value.test(str)) return true;
    }
    return false;
  }

  /** Determine if a path is inside the workspace root. */
  isInsideWorkspace(targetPath: string): boolean {
    const abs = path.resolve(targetPath);
    const root = process.env.GROQ_PROJECT_ROOT ? path.resolve(process.env.GROQ_PROJECT_ROOT) : path.resolve(process.cwd());
    return abs === root || abs.startsWith(root + path.sep);
  }
}

/** Build the tool schemas to send to the model from tool definitions. */
export function toToolSchemas(defs: ToolDefinition[]): ToolSchema[] {
  return defs.map((d) => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }));
}