import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import type { ToolDefinition } from '../types.js';

/**
 * Minimal Model Context Protocol (MCP) client over stdio.
 *
 * MCP servers speak JSON-RPC 2.0 over stdin/stdout. This client:
 *   - spawns the server command,
 *   - performs `initialize` + `notifications/initialized`,
 *   - lists tools, and
 *   - exposes each tool as an agent ToolDefinition backed by `tools/call`.
 *
 * Config lives in `~/.groq/mcp.json`:
 *   { "servers": { "name": { "command": "npx", "args": ["-y","@modelcontextprotocol/server-filesystem","."] } } }
 */

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: any;
  error?: { code: number; message: string };
}

export class McpClient {
  private proc: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<number | string, { resolve: (r: any) => void; reject: (e: Error) => void }>();
  private tools: Record<string, { name: string; description: string; inputSchema: any }> = {};
  private destroyed = false;

  constructor(
    private name: string,
    private cfg: McpServerConfig,
  ) {}

  static fromConfigFile(file = path.join(os.homedir(), '.groq', 'mcp.json')): Record<string, McpServerConfig> {
    try {
      if (!fs.existsSync(file)) return {};
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return raw.servers || {};
    } catch {
      return {};
    }
  }

  get mcpName(): string {
    return this.name;
  }

  async connect(): Promise<void> {
    const args = this.cfg.args ?? [];
    const cwd = this.cfg.cwd ? path.resolve(this.cfg.cwd) : process.cwd();
    this.proc = spawn(this.cfg.command, args, {
      cwd,
      env: { ...process.env, ...this.cfg.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!this.proc.stdout || !this.proc.stdin) {
      throw new Error(`MCP server ${this.name}: stdout/stdin not available`);
    }
    this.rl = readline.createInterface({ input: this.proc.stdout as NodeJS.ReadableStream });
    this.rl.on('line', (line: string) => this.handleLine(line));

    this.proc.stderr?.on('data', (d: Buffer) => {
      // Surface server stderr as harmless info.
      if (process.env.GROQ_MCP_DEBUG) process.stderr.write(`[mcp:${this.name}] ${d.toString()}`);
    });
    this.proc.on('exit', () => {
      if (!this.destroyed) {
        // Reject all pending on unexpected exit.
        for (const [, p] of this.pending) p.reject(new Error(`MCP server ${this.name} exited`));
        this.pending.clear();
      }
    });

    // Wait a short beat for the process to come up.
    await new Promise((r) => setTimeout(r, 300));

    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'groq-code-cli', version: '1.0.2' },
    });
    if (result?.protocolVersion) {
      await this.request('notifications/initialized', {}, true);
    }

    const toolsResp = await this.request('tools/list', {});
    if (toolsResp?.tools) {
      for (const t of toolsResp.tools) {
        this.tools[t.name] = { name: t.name, description: t.description || '', inputSchema: t.inputSchema || {} };
      }
    }
  }

  private handleLine(line: string) {
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if ((msg as any).method) return; // server->client request; ignore
    const pending = this.pending.get(msg.id!);
    if (!pending) return;
    this.pending.delete(msg.id!);
    if (msg.error) pending.reject(new Error(msg.error.message));
    else pending.resolve(msg.result);
  }

  private request(method: string, params: any, notify = false): Promise<any> {
    let id: number | string | undefined;
    if (!notify) {
      id = this.nextId++;
    }
    const payload: JsonRpcRequest = { jsonrpc: '2.0', method, params };
    if (id !== undefined) payload.id = id;
    const line = JSON.stringify(payload) + '\n';
    if (!this.proc?.stdin?.writable) return Promise.reject(new Error('MCP stdin not writable'));
    this.proc.stdin.write(line);
    if (notify) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      this.pending.set(id as number, { resolve, reject });
    });
  }

  async listToolNames(): Promise<string[]> {
    return Object.keys(this.tools);
  }

  async listMcpTools(): Promise<ToolDefinition[]> {
    const out: ToolDefinition[] = [];
    for (const [name, t] of Object.entries(this.tools)) {
      const qualified = `${this.name}__${name}`;
      out.push({
        name: qualified,
        description: `[MCP ${this.name}] ${t.description || name}`,
        permission: 'read', // MCP tools default to read; destructive ones will still surface.
        parameters: t.inputSchema?.properties
          ? { type: 'object', properties: t.inputSchema.properties, required: t.inputSchema.required || [] }
          : { type: 'object', properties: {}, required: [] },
        run: async (args) => {
          const res = await this.callTool(name, args);
          return res;
        },
      });
    }
    return out;
  }

  async callTool(name: string, args: Record<string, any>): Promise<{ success: boolean; content?: any; error?: string }> {
    try {
      const result = await this.request('tools/call', { name, arguments: args });
      // MCP returns content: [{ type: 'text', text } | {type:'image'...}]
      if (result?.content && Array.isArray(result.content)) {
        const text = result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        if (result.isError) return { success: false, error: text || 'MCP tool error' };
        return { success: true, content: text };
      }
      return { success: true, content: result };
    } catch (e: any) {
      return { success: false, error: `MCP call failed: ${e.message}` };
    }
  }

  close(): void {
    this.destroyed = true;
    try {
      this.proc?.kill();
    } catch { /* ignore */ }
    this.rl?.close();
    this.proc = null;
  }
}

/** Connect to all configured servers and gather their tools. */
export async function connectAllMcp(): Promise<McpClient[]> {
  const configs = McpClient.fromConfigFile();
  const clients: McpClient[] = [];
  for (const [name, cfg] of Object.entries(configs)) {
    const c = new McpClient(name, cfg);
    try {
      await c.connect();
      clients.push(c);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (process.env.GROQ_MCP_DEBUG) process.stderr.write(`[mcp] failed to connect ${name}: ${msg}\n`);
    }
  }
  return clients;
}