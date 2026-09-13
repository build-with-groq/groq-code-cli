import * as fs from 'fs';
import * as path from 'path';
import Groq from 'groq-sdk';
import type { ClientOptions } from 'groq-sdk';
import { ConfigManager } from '../utils/local-settings.js';
import { getProxyAgent, getProxyInfo } from '../utils/proxy-config.js';
import { PermissionManager, toToolSchemas } from './permissions.js';
import { TOOLS, getTool, normalizeToolName } from '../tools/registry.js';
import { WEB_TOOLS } from '../tools/web.js';
import { connectAllMcp, McpClient } from './mcp.js';
import { skillsIndex } from './skills.js';
import { estimateConversationTokens, estimateTokens, isOverBudget, trimConversation, compactMarker, type AgentMessage } from './context.js';
import type { ToolDefinition, ApiUsage, PermissionDecision } from '../types.js';

type Callbacks = {
  onStreamDelta?: (delta: string) => void;
  onMessageEnd?: (text: string, reasoning?: string) => void;
  onToolStart?: (name: string, args: Record<string, any>) => void;
  onToolEnd?: (name: string, result: any) => void;
  onPermissionPrompt?: (req: {
    toolName: string;
    level: 'read' | 'write' | 'dangerous';
    args: Record<string, any>;
  }) => Promise<PermissionDecision>;
  onApiUsage?: (usage: ApiUsage) => void;
  onError?: (error: string) => Promise<boolean>;
  onSummaryRequested?: () => Promise<string>;
};

export class Agent {
  private client: Groq | null = null;
  private model: string;
  private temperature: number;
  private systemMessage: string;
  private messages: AgentMessage[] = [];
  private debugEnabled: boolean;
  private proxyOverride?: string;
  private cb: Callbacks = {};
  private permissions: PermissionManager;
  private currentAbortController: AbortController | null = null;
  private isInterrupted = false;
  private mcpClients: McpClient[] = [];
  private registry: ToolDefinition[];
  private configManager = new ConfigManager();
  private requestCount = 0;

  private constructor(opts: {
    model?: string;
    temperature?: number;
    system?: string | null;
    debug?: boolean;
    proxy?: string;
    skipPermissions?: boolean;
  }) {
    const { model, temperature = 1, system = null, debug = false, proxy, skipPermissions = false } = opts;
    this.proxyOverride = proxy;
    this.debugEnabled = debug;
    this.temperature = temperature;
    this.registry = [...TOOLS, ...WEB_TOOLS];

    this.permissions = new PermissionManager(this.registry);
    this.permissions.setSkipAll(skipPermissions);

    this.loadMcpTools();

    // Default model: config > passed model > hardcoded fallback
    const configured = this.configManager.getDefaultModel();
    this.model = model || configured || 'moonshotai/kimi-k2-instruct';
    this.systemMessage = system ?? this.buildDefaultSystemMessage();
    this.messages.push({ role: 'system', content: this.systemMessage });
    this.loadProjectContext();
  }

  private loadMcpTools(): void {
    // MCP tools are connected lazily; if none configured, no-op.
    connectAllMcp()
      .then(async (clients) => {
        this.mcpClients = clients;
        for (const c of clients) {
          const tools = await c.listMcpTools();
          this.registry.push(...tools);
          // Rebuild permission manager to include MCP tools
          this.permissions = new PermissionManager(this.registry);
          this.permissions.setSkipAll(this.permissions.autoApproveEnabled);
        }
      })
      .catch(() => {
        /* MCP failures are non-fatal */
      });
  }

  private loadProjectContext(): void {
    try {
      const explicitFile = process.env.GROQ_CONTEXT_FILE;
      const baseDir = process.env.GROQ_CONTEXT_DIR || process.cwd();
      const contextPath = explicitFile ? path.resolve(explicitFile) : path.join(baseDir, '.groq', 'context.md');
      const limit = Number(process.env.GROQ_CONTEXT_LIMIT || '20000');
      if (fs.existsSync(contextPath)) {
        const ctx = fs.readFileSync(contextPath, 'utf-8');
        const trimmed = ctx.length > limit ? ctx.slice(0, limit) + '\n...[truncated]' : ctx;
        this.messages.push({
          role: 'system',
          content: `Project context from ${explicitFile ? contextPath : '.groq/context.md'}:\n${trimmed}`,
        });
      }
    } catch (e) {
      this.debug('Failed to load project context', e);
    }
  }

  buildDefaultSystemMessage(): string {
    const skills = skillsIndex();
    return `You are a coding assistant running on ${this.model} via Groq, in an interactive terminal. You can act autonomously by using tools.

AVAILABLE TOOLS
- File tools: read_file, write_file (create/overwrite), edit_file (exact-replace or append with empty old_text), list_files, search_files, project_tree.
- Command tools: execute_command (shell), git_status, git_diff.
- Web tools: web_search, web_fetch.
- MCP tools (if configured) are prefixed with the server name.

WORKFLOW RULES
1. Use PROJECT_TREE or list_files ONCE to orient before changing files. Do NOT call it again on subsequent turns — you already have its output in your context. Rely on read_file/search_files for specifics.
2. Always read_file before edit_file; match old_text EXACTLY.
3. Build incrementally - create the core files first, then iterate.
4. Prefer SMALL, exact edits over full rewrites.
5. After creating/editing files, optionally run tests or format with execute_command.
6. Web tools are for up-to-date external info; use them sparingly.
7. You may run multiple independent tool calls; do NOT wait for the user between tool calls unless a tool is dangerous.

PERMISSION & APPROVAL
- Reads and safe commands (ls, cat, grep, git status/diff) run automatically.
- File writes and other commands will prompt the user for approval. If a tool is rejected, respect that: explain, ask, or change approach. Never silently re-run a rejected tool with identical arguments.

REPETITION GUARD
- If you need the same tool twice with identical arguments, you must have a different reason. Re-running the same call after an identical failure wastes time; update the arguments or try another approach first.

CONTEXT
${skills !== 'No skills installed.' ? 'Installed skills:\n' + skills : 'No skills installed yet. You can create them under .groq/skills/<name>/SKILL.md.'}

OUTPUT STYLE
- Be direct. Use markdown sparingly; avoid tables.
- For code changes, summarize what changed and why after you finish.
- If you cannot do something safely, say so.

Identify yourself, when asked, as a coding assistant running on ${this.model} via Groq.`;
  }

  private debug(...args: any[]): void {
    if (!this.debugEnabled) return;
    const line = `[${new Date().toISOString()}] ` + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    try {
      fs.appendFileSync('debug-agent.log', line + '\n');
    } catch { /* ignore */ }
  }

  static async create(opts: {
    model?: string;
    temperature?: number;
    system?: string | null;
    debug?: boolean;
    proxy?: string;
    skipPermissions?: boolean;
  }): Promise<Agent> {
    return new Agent(opts);
  }

  setCallbacks(cb: Callbacks): void {
    this.cb = cb;
  }

  get modelName(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
    this.configManager.setDefaultModel(model);
    this.setSystemFromModel();
  }

  private setSystemFromModel(): void {
    this.systemMessage = this.buildDefaultSystemMessage();
    const idx = this.messages.findIndex((m) => m.role === 'system');
    if (idx >= 0) this.messages[idx].content = this.systemMessage;
  }

  setApiKey(key: string): void {
    const co: ClientOptions = { apiKey: key };
    const proxyAgent = getProxyAgent(this.proxyOverride);
    if (proxyAgent) (co as any).httpAgent = proxyAgent;
    this.client = new Groq(co);
  }

  saveApiKey(key: string): void {
    this.configManager.setApiKey(key);
    this.setApiKey(key);
  }

  clearApiKey(): void {
    this.configManager.clearApiKey();
    this.client = null;
  }

  clearHistory(): void {
    this.messages = this.messages.filter((m) => m.role === 'system');
  }

  get historyLength(): number {
    return this.messages.length;
  }

  interrupt(): void {
    this.isInterrupted = true;
    this.currentAbortController?.abort();
  }

  setSessionAutoApprove(enabled: boolean): void {
    this.permissions.setSessionAutoApprove(enabled);
  }

  get autoApproveEnabled(): boolean {
    return this.permissions.autoApproveEnabled;
  }

  approvePath(p: string): void {
    this.permissions.approvePath(p);
  }

  describePermissions(): string {
    return this.permissions.describe();
  }

  async ensureClient(): Promise<Groq> {
    if (this.client) return this.client;
    const envKey = process.env.GROQ_API_KEY;
    if (envKey) {
      this.setApiKey(envKey);
      return this.client!;
    }
    const cfgKey = this.configManager.getApiKey();
    if (cfgKey) {
      this.setApiKey(cfgKey);
      return this.client!;
    }
    throw new Error('No API key available. Please use /login to set your Groq API key.');
  }

  /** Run a full user turn: stream, run tools, loop until a final text. */
  async chat(userInput: string): Promise<void> {
    this.isInterrupted = false;
    await this.ensureClient();
    this.messages.push({ role: 'user', content: userInput });

    // If over budget before starting, prompt for compaction.
    if (isOverBudget(this.messages) && this.cb.onSummaryRequested) {
      try {
        const summary = await this.cb.onSummaryRequested();
        const systems = this.messages.filter((m) => m.role === 'system');
        this.messages = [...systems, { role: 'system', content: compactMarker(summary) }];
      } catch { /* user declined; continue as-is */ }
    }

    const maxIterations = 60;
    let iteration = 0;
    const repeatedCalls = new Map<string, number>();

    while (iteration < maxIterations) {
      if (this.isInterrupted) {
        this.currentAbortController = null;
        return;
      }

      const turn = await this.streamTurn();
      if (this.isInterrupted) {
        this.currentAbortController = null;
        return;
      }

      // Tool calls?
      if (turn.toolCalls && turn.toolCalls.length > 0) {
        // Record the assistant's intent BEFORE running any tools so the model
        // (and any non-OpenAI-compatible endpoint) sees the full tool-call turn.
        const assistantToolMsg: AgentMessage = {
          role: 'assistant',
          content: turn.content || null,
          tool_calls: turn.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
        if (turn.reasoning) (assistantToolMsg as any).reasoning = turn.reasoning;
        this.messages.push(assistantToolMsg);

        for (const tc of turn.toolCalls) {
          // Guard on the tool NAME primarily: models that keep calling a tool
          // (e.g. project_tree with no args -> identical args every time) will
          // loop forever. Count calls per name first, refined by name+args.
          const nameKey = tc.name;
          repeatedCalls.set(nameKey, (repeatedCalls.get(nameKey) || 0) + 1);
          const exactKey = `${tc.name}|${tc.arguments}`;
          repeatedCalls.set(exactKey, (repeatedCalls.get(exactKey) || 0) + 1);
          if (repeatedCalls.get(nameKey)! > 3 || repeatedCalls.get(exactKey)! > 4) {
            const msg = `Loop guard: the model called ${tc.name} ${repeatedCalls.get(nameKey)} times without making progress. Stopping to avoid an infinite loop. Re-reading the same tool output won't help — change the request or ask the user how to continue.`;
            this.messages.push({
              role: 'system',
              content: msg,
            });
            if (this.cb.onMessageEnd) this.cb.onMessageEnd(msg);
            this.requestCount++;
            return;
          }
          await this.executeWithApproval(tc.name, tc.arguments, tc.id);
          if (this.isInterrupted) {
            this.currentAbortController = null;
            return;
          }
        }
        iteration++;
        // Manage context budget between tool-heavy turns.
        if (isOverBudget(this.messages)) {
          this.messages = trimConversation(this.messages);
        }
        continue;
      }

      // Final text turn.
      if (!turn.content && !turn.toolCalls) {
        // The model produced no content and no tool calls (can happen with
        // reasoning-heavy models when max_tokens is tight, or on proxy hiccups).
        // Surface it as an explicit message rather than a silent blank.
        const emptyNote = 'The model returned an empty response. Try rephrasing the request or using higher max_tokens.';
        this.messages.push({ role: 'assistant', content: emptyNote });
        if (this.cb.onMessageEnd) this.cb.onMessageEnd(emptyNote);
        return;
      }
      if (this.cb.onMessageEnd) this.cb.onMessageEnd(turn.content || '', turn.reasoning);
      this.messages.push({ role: 'assistant', content: turn.content || '' });
      return;
    }

    // Hit max iterations.
    const note = `Stopped after ${maxIterations} tool iterations. The task may be too large. Ask the user how to continue, or break it down.`;
    this.messages.push({ role: 'system', content: note });
    if (this.cb.onMessageEnd) this.cb.onMessageEnd(note);
  }

  /** Run one streamed completion, assembling content + tool call deltas. */
  private async streamTurn(): Promise<{
    content: string;
    reasoning?: string;
    toolCalls?: { id: string; name: string; arguments: string }[];
  }> {
    const client = await this.ensureClient();
    const controller = new AbortController();
    this.currentAbortController = controller;

    const sysTools = () => {
      // Only attach tools that exist in the registry at call time (MCP may arrive later).
      return toToolSchemas(this.registry);
    };

    let content = '';
    let reasoning = '';
    const toolDeltas: Record<number, { id?: string; name?: string; args: string }> = {};

    const doRequest = async () => {
      const stream = await client.chat.completions.create(
        {
          model: this.model,
          messages: this.messages as any,
          tools: sysTools(),
          tool_choice: 'auto',
          temperature: this.temperature,
          max_tokens: 8000,
          stream: true,
        },
        { signal: controller.signal },
      );

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (typeof delta.content === 'string') {
          content += delta.content;
          this.cb.onStreamDelta?.(delta.content);
        }
        if (typeof delta.reasoning === 'string') {
          reasoning += delta.reasoning;
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            toolDeltas[idx] ??= { args: '' };
            if (tc.id) toolDeltas[idx].id = tc.id;
            if (tc.function?.name) toolDeltas[idx].name = tc.function.name;
            if (tc.function?.arguments) toolDeltas[idx].args += tc.function.arguments;
          }
        }

        // Report usage on the final chunk (some providers attach it to the last chunk).
        const chunkUsage = (chunk as any).usage as
          | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; total_time?: number }
          | undefined;
        if (chunkUsage && this.cb.onApiUsage) {
          this.cb.onApiUsage({
            prompt_tokens: chunkUsage.prompt_tokens ?? 0,
            completion_tokens: chunkUsage.completion_tokens ?? 0,
            total_tokens: chunkUsage.total_tokens ?? 0,
            total_time: chunkUsage.total_time,
          });
        }
      }
    };

    try {
      await doRequest();
    } catch (e: any) {
      if (this.isInterrupted) {
        // Abort due to user interrupt.
        return { content: '', reasoning };
      }
      this.currentAbortController = null;
      // Surface as an error; let the caller retry decision.
      const message = this.formatApiError(e);
      if (this.cb.onError) {
        const retry = await this.cb.onError(message);
        if (retry) return this.streamTurn();
        return { content: '' };
      }
      throw e;
    }

    const final: { content: string; reasoning?: string; toolCalls?: { id: string; name: string; arguments: string }[] } = {
      content,
      reasoning: reasoning || undefined,
    };

    const calls = Object.values(toolDeltas);
    if (calls.length > 0) {
      final.toolCalls = calls.map((c) => ({
        id: c.id || toolCallId(),
        name: normalizeToolName(c.name || ''),
        arguments: c.args || '{}',
      }));
    }
    return final;
  }

  private async executeWithApproval(rawName: string, rawArgs: string, callId?: string): Promise<void> {
    const toolName = normalizeToolName(rawName);
    const def = getTool(toolName) || this.registry.find((t) => t.name === rawName);
    const isMcp = toolName.includes('__');

    let args: Record<string, any>;
    try {
      args = JSON.parse(rawArgs);
    } catch {
      args = this.repairArgs(rawArgs);
    }
    if (typeof args !== 'object' || args === null) args = {};

    if (this.cb.onToolStart) this.cb.onToolStart(toolName, args);

    // Permission check.
    if (!isMcp) {
      const level = def?.permission ?? 'dangerous';
      const check = this.permissions.check(toolName, args);
      if (check.decision.status === 'prompt') {
        let decision: PermissionDecision = { status: 'deny' };
        if (this.cb.onPermissionPrompt) {
          decision = await this.cb.onPermissionPrompt({ toolName, args, level });
        }
        if (decision.status === 'allow' && decision.autoApproveSession) {
          this.permissions.setSessionAutoApprove(true);
        }
        if (decision.status === 'allow' && decision.alwaysAllowPath) {
          this.permissions.approvePath(decision.alwaysAllowPath);
        }
        if (decision.status === 'deny') {
          const res = {
            success: false,
            error:
              decision.reason === 'cancelled'
                ? 'User rejected this tool call. Choose a different approach or ask for direction.'
                : `Permission denied: ${decision.reason || 'user rejected'}`,
            userRejected: true,
          };
          this.messages.push({ role: 'tool', tool_call_id: callId ?? toolCallId(), content: JSON.stringify(res) });
          if (this.cb.onToolEnd) this.cb.onToolEnd(toolName, res);
          return;
        }
      } else if (check.decision.status === 'deny') {
        const res = { success: false, error: `Permission denied: ${check.decision.reason || 'not permitted'}`, userRejected: true };
        this.messages.push({ role: 'tool', tool_call_id: callId ?? toolCallId(), content: JSON.stringify(res) });
        if (this.cb.onToolEnd) this.cb.onToolEnd(toolName, res);
        return;
      }
    }

    // Execute.
    let result: any;
    if (isMcp) {
      const [server, real] = toolName.split('__');
      const client = this.mcpClients.find((c) => c.mcpName === server);
      if (!client) {
        result = { success: false, error: `MCP server "${server}" not connected` };
      } else {
        result = await client.callTool(real, args);
      }
    } else if (def) {
      try {
        result = await def.run(args);
      } catch (e: any) {
        result = { success: false, error: `Tool error: ${e.message}` };
      }
    } else {
      result = { success: false, error: `Unknown tool: ${toolName}` };
    }

    const content = JSON.stringify(result ?? { success: false, error: 'No result' });
    this.messages.push({ role: 'tool', tool_call_id: callId ?? toolCallId(), content });
    if (this.cb.onToolEnd) this.cb.onToolEnd(toolName, result);
  }

  /** Attempt to salvage truncated/malformed JSON args. */
  private repairArgs(raw: string): Record<string, any> {
    // Remove trailing commas and close unclosed braces/brackets.
    let s = raw.trim();
    try {
      // Balanced brace heuristic: count opens/closes.
      let opens = 0;
      let closes = 0;
      for (const ch of s) {
        if (ch === '{' || ch === '[') opens++;
        if (ch === '}' || ch === ']') closes++;
      }
      while (closes < opens) {
        s += '}';
        closes++;
      }
      const parsed = JSON.parse(s);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      // Fallback: regex for common quoted key/value pairs.
      const out: Record<string, any> = {};
      const re = /"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*"|'[^']*'|\d+|true|false|null)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw))) {
        let v: any = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v === 'null') v = null;
        else if (!isNaN(Number(v))) v = Number(v);
        out[m[1]] = v;
      }
      return out;
    }
  }

  private formatApiError(e: any): string {
    if (e instanceof Error) {
      if ('status' in e && 'error' in e) {
        const status = (e as any).status;
        const msg = (e as any).error?.error?.message || e.message;
        return `API Error (${status}): ${msg}`;
      }
      return `Error: ${e.message}`;
    }
    return `Error: ${String(e)}`;
  }

  /** Replace non-system history with a compacted summary (for /compact). */
  compactWithSummary(summary: string): void {
    const systems = this.messages.filter((m) => m.role === 'system');
    this.messages = [
      ...systems,
      { role: 'system', content: compactMarker(summary) },
      { role: 'user', content: 'Continue.' },
    ];
  }

  /** Produce a synthetic summary of the conversation for /compact. */
  summarize(): string {
    const recent = this.messages.slice(-8);
    const lines: string[] = [];
    for (const m of recent) {
      if (m.role === 'system') continue;
      if (m.role === 'user') lines.push(`User: ${String(m.content || '').slice(0, 120)}`);
      else if (m.role === 'assistant') lines.push(`Assistant: ${String(m.content || '').slice(0, 120)}`);
    }
    return lines.join('\n') || '(no recent conversation to summarize)';
  }

  estimateTokens(): number {
    return estimateConversationTokens(this.messages);
  }

  tokenBudgetReport(): string {
    return `Context: ~${this.estimateTokens()} / ${'80,000'} target tokens (${Math.round((this.estimateTokens() / 80000) * 100)}%)`;
  }

  /** Export conversation for stats. */
  conversationForStats(): AgentMessage[] {
    return this.messages;
  }

  private requestId = 0;
}

function toolCallId(): string {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}