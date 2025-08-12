import { ConfigManager } from './local-settings.js';

export interface LoadedCustomCommand {
  command: string;
  description?: string;
  customPrompt?: string;
  prompt?: string;
  appendArgs?: boolean;
  role?: 'user' | 'system';
}

export function loadCustomCommandsFromSettings(): LoadedCustomCommand[] {
  try {
    const manager = new ConfigManager();
    const cmds = manager.getCustomCommands?.();
    if (Array.isArray(cmds)) return cmds as LoadedCustomCommand[];
  } catch (_) {
    // ignore
  }
  return [];
}
