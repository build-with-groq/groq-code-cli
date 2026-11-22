import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalRequests: number;
  totalTime: number;
}

export interface SessionData {
  id: string;
  cwd: string;
  model: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  usage: SessionUsage;
  messages: any[];
}

export type SessionSummary = Omit<SessionData, 'messages'> & { messageCount: number };

function sessionsDir(): string {
  return process.env.GROQ_SESSIONS_DIR || path.join(os.homedir(), '.groq', 'sessions');
}

const MAX_TITLE_LENGTH = 60;

export function emptyUsage(): SessionUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, totalRequests: 0, totalTime: 0 };
}

export function newSessionId(): string {
  // e.g. 20250912-143005-a1b2 (sorts by date, short enough to type)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

function sessionPath(id: string): string {
  // ids come from user input in /resume, keep them inside the sessions dir
  return path.join(sessionsDir(), `${path.basename(id)}.json`);
}

export function saveSession(session: SessionData): void {
  if (!fs.existsSync(sessionsDir())) {
    fs.mkdirSync(sessionsDir(), { recursive: true });
  }
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), { mode: 0o600 });
}

export function loadSession(id: string): SessionData | null {
  const file = sessionPath(id);
  if (!fs.existsSync(file)) {
    // allow a unique prefix, so `/resume 20250912-14` works
    const match = listSessions({ allDirs: true }).filter(s => s.id.startsWith(id));
    if (match.length !== 1) return null;
    return loadSession(match[0].id);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function listSessions(opts: { cwd?: string; allDirs?: boolean } = {}): SessionSummary[] {
  if (!fs.existsSync(sessionsDir())) return [];

  const cwd = opts.cwd || process.cwd();
  const sessions: SessionSummary[] = [];

  for (const file of fs.readdirSync(sessionsDir())) {
    if (!file.endsWith('.json')) continue;
    try {
      const data: SessionData = JSON.parse(fs.readFileSync(path.join(sessionsDir(), file), 'utf8'));
      if (!opts.allDirs && data.cwd !== cwd) continue;
      const { messages, ...rest } = data;
      sessions.push({ ...rest, messageCount: messages.filter(m => m.role === 'user').length });
    } catch {
      // skip broken files
    }
  }

  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function latestSession(cwd?: string): SessionData | null {
  const [latest] = listSessions({ cwd });
  return latest ? loadSession(latest.id) : null;
}

export function makeTitle(firstUserMessage: string): string {
  const line = firstUserMessage.replace(/\s+/g, ' ').trim();
  return line.length > MAX_TITLE_LENGTH ? line.slice(0, MAX_TITLE_LENGTH - 3) + '...' : line;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
