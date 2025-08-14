import { CommandDefinition, CommandContext } from '../base.js';

export const modelCommand: CommandDefinition = {
  command: 'model',
  description: 'Select your AI provider and model',
  handler: ({ setShowModelSelector }: CommandContext) => {
    if (setShowModelSelector) {
      setShowModelSelector(true);
    }
  }
};