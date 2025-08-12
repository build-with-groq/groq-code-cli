import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from './local-settings.js';

const execAsync = promisify(exec);

export type HookType = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'SubagentStop';

export interface HookDefinition {
  type: 'command';
  command: string;
  timeout?: number;
  blocking?: boolean;
}

export interface HookMatcher {
  matcher: string | RegExp;
  hooks: HookDefinition[];
}

export interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Notification?: HookDefinition[];
  Stop?: HookDefinition[];
  SubagentStop?: HookDefinition[];
}

export interface HookContext {
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  message?: string;
  agentName?: string;
  timestamp: string;
}

export class HooksManager {
  private hooks: HooksConfig = {};
  private globalHooks: HooksConfig = {};
  private localHooks: HooksConfig = {};
  private configManager: ConfigManager;
  private enabled: boolean = true;
  private allowLocalHooks: boolean = true;

  constructor() {
    this.configManager = new ConfigManager();
    // Check environment variable for disabling local hooks
    this.allowLocalHooks = process.env.GROQ_NO_LOCAL_HOOKS !== 'true';
    this.loadHooks();
  }

  private loadHooks(): void {
    try {
      const { global, local, merged } = this.configManager.getHooksConfig();
      this.globalHooks = global || {};
      this.localHooks = this.allowLocalHooks ? (local || {}) : {};
      
      // If local hooks are disabled, only use global hooks
      if (!this.allowLocalHooks) {
        this.hooks = this.globalHooks;
        if (Object.keys(local || {}).length > 0) {
          console.warn('[SECURITY] Local hooks detected but disabled by GROQ_NO_LOCAL_HOOKS');
        }
      } else {
        this.hooks = merged || {};
      }
    } catch (error) {
      console.warn('Failed to load hooks configuration:', error);
    }
  }

  public reloadHooks(): void {
    this.loadHooks();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private matchesPattern(value: string, matcher: string | RegExp): boolean {
    if (typeof matcher === 'string') {
      return value === matcher || value.startsWith(matcher);
    } else if (matcher instanceof RegExp) {
      return matcher.test(value);
    }
    return false;
  }

  private validateHookConfig(hook: HookDefinition): boolean {
    // Basic validation of hook structure
    if (!hook || typeof hook !== 'object') return false;
    if (hook.type !== 'command') return false;
    if (typeof hook.command !== 'string' || !hook.command.trim()) return false;
    
    // Validate timeout (must be positive and reasonable)
    if (hook.timeout !== undefined) {
      if (typeof hook.timeout !== 'number' || 
          hook.timeout <= 0 || 
          hook.timeout > 60000) { // Max 1 minute
        return false;
      }
    }
    
    // Validate blocking flag
    if (hook.blocking !== undefined && typeof hook.blocking !== 'boolean') {
      return false;
    }
    
    return true;
  }

  private async executeHook(hook: HookDefinition, context: HookContext): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      // Validate hook configuration
      if (!this.validateHookConfig(hook)) {
        return {
          success: false,
          error: 'Invalid hook configuration'
        };
      }
      
      
      const env = {
        ...process.env,
        HOOK_TYPE: context.toolName ? 'tool' : 'event',
        HOOK_TOOL_NAME: context.toolName || '',
        HOOK_TIMESTAMP: context.timestamp,
        HOOK_CONTEXT: JSON.stringify(context)
      };

      const timeout = hook.timeout || 5000;
      
      // Log hook execution for debugging
      if (process.env.HOOK_DEBUG === 'true') {
        console.log(`[HOOK] Executing: ${hook.command}`);
      }
      
      const { stdout, stderr } = await execAsync(hook.command, {
        timeout,
        env
      });

      return {
        success: true,
        output: stdout + (stderr ? `\nstderr: ${stderr}` : '')
      };
    } catch (error: any) {
      const isTimeout = error.killed && error.signal === 'SIGTERM';
      const msg = isTimeout ? 'Hook timed out' : (error?.stderr || error?.message || String(error));
      return { success: false, error: msg };
    }
  }

  public async executePreToolHooks(toolName: string, toolArgs: Record<string, any>): Promise<{ allowed: boolean; blockedReason?: string }> {
    if (!this.enabled || !this.hooks.PreToolUse) {
      return { allowed: true };
    }

    const context: HookContext = {
      toolName,
      toolArgs,
      timestamp: new Date().toISOString()
    };

    for (const matcher of this.hooks.PreToolUse) {
      if (this.matchesPattern(toolName, matcher.matcher)) {
        for (const hook of matcher.hooks) {
          const result = await this.executeHook(hook, context);
          
          if (hook.blocking && !result.success) {
            return {
              allowed: false,
              blockedReason: result.error || 'Hook execution failed'
            };
          }

          if (result.output && /^block$/im.test(result.output.trim())) {
            return {
              allowed: false,
              blockedReason: result.output
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  public async executePostToolHooks(toolName: string, toolArgs: Record<string, any>, toolResult: any): Promise<void> {
    if (!this.enabled || !this.hooks.PostToolUse) {
      return;
    }

    const context: HookContext = {
      toolName,
      toolArgs,
      toolResult,
      timestamp: new Date().toISOString()
    };

    for (const matcher of this.hooks.PostToolUse) {
      if (this.matchesPattern(toolName, matcher.matcher)) {
        for (const hook of matcher.hooks) {
          await this.executeHook(hook, context);
        }
      }
    }
  }

  public async executeNotificationHooks(message: string): Promise<void> {
    if (!this.enabled || !this.hooks.Notification) {
      return;
    }

    const context: HookContext = {
      message,
      timestamp: new Date().toISOString()
    };

    for (const hook of this.hooks.Notification) {
      await this.executeHook(hook, context);
    }
  }

  public async executeStopHooks(): Promise<void> {
    if (!this.enabled || !this.hooks.Stop) {
      return;
    }

    const context: HookContext = {
      timestamp: new Date().toISOString()
    };

    for (const hook of this.hooks.Stop) {
      await this.executeHook(hook, context);
    }
  }

  public async executeSubagentStopHooks(agentName: string): Promise<void> {
    if (!this.enabled || !this.hooks.SubagentStop) {
      return;
    }

    const context: HookContext = {
      agentName,
      timestamp: new Date().toISOString()
    };

    for (const hook of this.hooks.SubagentStop) {
      await this.executeHook(hook, context);
    }
  }

  public getActiveHooks(): HooksConfig {
    return this.hooks;
  }

  public getGlobalHooks(): HooksConfig {
    return this.globalHooks;
  }

  public getLocalHooks(): HooksConfig {
    return this.localHooks;
  }

  public updateHooksConfig(config: HooksConfig, isGlobal: boolean = false): void {
    this.configManager.setHooksConfig(config, isGlobal);
    this.loadHooks(); // Reload to get merged config
  }
}

export const hooksManager = new HooksManager();