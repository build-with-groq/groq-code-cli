import { CommandDefinition, CommandContext } from '../base.js';

export const resumeCommand: CommandDefinition = {
  command: 'resume',
  description: 'Resume a saved session: /resume <id>',
  handler: ({ addMessage, args, resumeSession }: CommandContext) => {
    if (!args) {
      addMessage({
        role: 'system',
        content: 'Usage: /resume <id>. Run /sessions to see saved sessions.',
      });
      return;
    }
    resumeSession?.(args);
  }
};
