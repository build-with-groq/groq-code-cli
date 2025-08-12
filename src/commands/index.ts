import { CommandDefinition, CommandContext } from './base.js';
import { helpCommand } from './definitions/help.js';
import { loginCommand } from './definitions/login.js';
import { modelCommand } from './definitions/model.js';
import { clearCommand } from './definitions/clear.js';
import { reasoningCommand } from './definitions/reasoning.js';
import { loadCustomCommandsFromSettings } from '../utils/custom-commands.js';

const builtinCommands: CommandDefinition[] = [
  helpCommand,
  loginCommand,
  modelCommand,
  clearCommand,
  reasoningCommand,
];

export function getAvailableCommands(): CommandDefinition[] {
  return [...getBuiltinCommands(), ...getCustomCommands()];
}

export function getCommandNames(): string[] {
  return getAvailableCommands().map(cmd => cmd.command);
}

export function handleSlashCommand(
  command: string, 
  context: CommandContext
) {
  // Extract the command part, everything up to the first space or end of string
  const fullCommand = command.slice(1);
  const spaceIndex = fullCommand.indexOf(' ');
  const cmd = spaceIndex > -1 ? fullCommand.substring(0, spaceIndex).toLowerCase() : fullCommand.toLowerCase();
  
  const commandDef = getAvailableCommands().find(c => c.command === cmd);
  
  // Add user message for the command (visible audit of what ran)
  context.addMessage({
    role: 'user',
    content: command,
  });
  
  if (!commandDef) return;

  // If it's a custom prompt command, insert its prompt (with optional args)
  if (commandDef.customPrompt) {
    const args = fullCommand.slice(cmd.length).trim();
    const finalPrompt = commandDef.appendArgs && args ? `${commandDef.customPrompt}\n\n${args}` : commandDef.customPrompt;
    // Prefer sending as a real request so the agent responds immediately
    if (context.sendMessage) {
      context.sendMessage(finalPrompt);
    } else {
      context.addMessage({
        role: commandDef.role || 'user',
        content: finalPrompt,
      });
    }
    return;
  }

  commandDef.handler(context);
}

export { CommandDefinition, CommandContext } from './base.js';

// --- Custom command loading ---

function getBuiltinCommands(): CommandDefinition[] {
  return [...builtinCommands];
}

function getCustomCommands(): CommandDefinition[] {
  try {
    const configs = loadCustomCommandsFromSettings();
    const builtinNames = new Set(getBuiltinCommands().map(c => c.command));

    // Normalize, drop invalid, drop any that clash with built-ins, and dedupe by command name
    const map = new Map<string, CommandDefinition>();
    for (const cfg of configs as any[]) {
      const def = normalizeCustomCommand(cfg);
      if (!def) continue;
      if (builtinNames.has(def.command)) continue; // ignore clashes with built-ins
      if (!map.has(def.command)) {
        map.set(def.command, def);
      }
    }
    return Array.from(map.values());
  } catch (err) {
    return [];
  }
}

function normalizeCustomCommand(raw: any): CommandDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const cmd = String(raw.command || '').trim();
  const description = String(raw.description || '').trim() || 'Custom command';
  const prompt = typeof raw.customPrompt === 'string' ? raw.customPrompt : (typeof raw.prompt === 'string' ? raw.prompt : '');
  if (!cmd || !prompt) return null;
  const appendArgs = Boolean(raw.appendArgs);
  const role = raw.role === 'system' ? 'system' : 'user';
  const definition: CommandDefinition = {
    command: cmd,
    description,
    handler: () => {},
    customPrompt: prompt,
    appendArgs,
    role,
  };
  return definition;
}