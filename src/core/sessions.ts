import * as fs from 'fs';
import * as path from 'path';
import type { AgentMessage } from './context.js';

/**
 * Session persistence.
 *
 * Each conversation is saved as a JSONL file under <project>/.groq/sessions/.
 * One message per line. This lets /resume restore a conversation across
 * process restarts, model switches, and /clear.
 */

interface StoredMessage {
  ts: string;
  role: AgentMessage['role'];
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface SessionMeta {
  id: string;
  file: string;
  created_at: string;
  updated_at: string;
  messageCount: number;
  tokens: number;
}

function sessionDir(): string {
  const root = process.env.GROQ_PROJECT_ROOT || process.cwd();
  return path.join(root, '.groq', 'sessions');
}

function ensureDir(): void {
  fs.mkdirSync(sessionDir(), { recursive: true });
}

function slug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function toStored(m: AgentMessage): StoredMessage {
  return {
    ts: new Date().toISOString(),
    role: m.role,
    content: m.content,
    tool_calls: m.tool_calls,
    tool_call_id: m.tool_call_id,
  };
}

function fromStored(s: StoredMessage): AgentMessage {
  return {
    role: s.role,
    content: s.content,
    tool_calls: s.tool_calls,
    tool_call_id: s.tool_call_id,
  };
}

/** Save the full conversation to a new session file. Returns the file path. */
export function saveSession(messages: AgentMessage[]): string {
  ensureDir();
  const file = path.join(sessionDir(), `session-${slug()}.jsonl`);
  const lines = messages.map((m) => JSON.stringify(toStored(m))).join('\n');
  fs.writeFileSync(file, lines + '\n', 'utf-8');
  return file;
}

/** List available sessions, newest first. */
export function listSessions(): SessionMeta[] {
  const dir = sessionDir();
  if (!fs.existsSync(dir)) return [];
  const out: SessionMeta[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    const file = path.join(dir, f);
    try {
      const stat = fs.statSync(file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
      let tokens = 0;
      let created = stat.birthtime?.toISOString() || '';
      for (const line of lines) {
        try {
          const m = JSON.parse(line);
          if (m.content) tokens += Math.ceil(String(m.content).length / 4);
          if (!created && m.ts) created = m.ts;
        } catch { /* skip */ }
      }
      out.push({
        id: f,
        file,
        created_at: created,
        updated_at: stat.mtime.toISOString(),
        messageCount: lines.length,
        tokens,
      });
    } catch { /* skip unreadable */ }
  }
  out.sort((a, b) => (b.updated_at < a.updated_at ? -1 : 1));
  return out;
}

/** Load a session file's messages. Returns null if unreadable. */
export function loadSession(file: string): AgentMessage[] | null {
  try {
    if (!fs.existsSync(file)) return null;
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const msgs: AgentMessage[] = [];
    for (const line of lines) {
      try {
        const m = JSON.parse(line) as StoredMessage;
        msgs.push(fromStored(m));
      } catch { /* skip bad line */ }
    }
    return msgs;
  } catch {
    return null;
  }
}

/** Delete a session file. */
export function deleteSession(file: string): boolean {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}