import { CommandDefinition, CommandContext } from './base.js';
import { helpCommand } from './definitions/help.js';
import { loginCommand } from './definitions/login.js';
import { modelCommand } from './definitions/model.js';
import { clearCommand } from './definitions/clear.js';
import { initCommand } from './definitions/init.js';
import { reasoningCommand } from './definitions/reasoning.js';
import { statsCommand } from './definitions/stats.js';
import { permissionsCommand } from './definitions/permissions.js';
import { mcpCommand } from './definitions/mcp.js';
import { skillsCommand } from './definitions/skills.js';
import { compactCommand } from './definitions/compact.js';
import { memoryCommand } from './definitions/memory.js';
import { resumeCommand, saveCommand } from './definitions/resume.js';
import { planCommand } from './definitions/plan.js';
import { agentsCommand } from './definitions/agents.js';
import { costCommand, todoCommand } from './definitions/cost.js';

const availableCommands: CommandDefinition[] = [
  helpCommand,
  loginCommand,
  modelCommand,
  clearCommand,
  initCommand,
  reasoningCommand,
  statsCommand,
  permissionsCommand,
  mcpCommand,
  skillsCommand,
  compactCommand,
  memoryCommand,
  resumeCommand,
  saveCommand,
  planCommand,
  agentsCommand,
  costCommand,
  todoCommand,
];

export function getAvailableCommands(): CommandDefinition[] {
  return [...availableCommands];
}

export function getCommandNames(): string[] {
  return getAvailableCommands().map((cmd) => cmd.command);
}

export function handleSlashCommand(command: string, context: CommandContext) {
  // Extract the command part, everything up to the first space or end of string
  const fullCommand = command.slice(1);
  const spaceIndex = fullCommand.indexOf(' ');
  const cmd = spaceIndex > -1 ? fullCommand.substring(0, spaceIndex).toLowerCase() : fullCommand.toLowerCase();

  const commandDef = getAvailableCommands().find((c) => c.command === cmd);
  // Auto-complete partial slash commands to their closest match
  const partialMatch = !commandDef
    ? getAvailableCommands().find((c) => c.command.startsWith(cmd) && cmd.length >= 2)
    : undefined;

  // Add user message for the command
  context.addMessage({
    role: 'user',
    content: command,
  });

  // Expose the raw typed command to handlers that need args (e.g. /resume <file>).
  context.rawCommand = command;

  const target = commandDef || partialMatch;
  if (target) {
    if (target.handler.constructor.name === 'AsyncFunction') {
      Promise.resolve(target.handler(context)).catch((e) =>
        context.addMessage({ role: 'system', content: `Command ${target.command} failed: ${e.message}` }),
      );
    } else {
      target.handler(context);
    }
  } else {
    context.addMessage({
      role: 'system',
      content: `Unknown command: /${cmd}. Type /help to see available commands.`,
    });
  }
}

export { CommandDefinition, CommandContext } from './base.js';