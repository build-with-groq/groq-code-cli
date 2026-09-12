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