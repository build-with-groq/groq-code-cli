import { CommandDefinition, CommandContext } from '../base.js';
import { ConfigManager } from '../../utils/local-settings.js';
import chalk from 'chalk';

export const initConfigCommand: CommandDefinition = {
  command: 'init-config',
  description: 'Initialize a project config file (.groq/local-settings.json) in the current directory',
  handler: ({ addMessage }: CommandContext) => {
    try {
      const configManager = new ConfigManager();
      configManager.initProjectConfig();
      
      addMessage({
        id: `system-${Date.now()}`,
        text: chalk.green('✓ Created .groq/local-settings.json in the current directory'),
        sender: 'system',
        timestamp: new Date()
      });
      
      addMessage({
        id: `system-${Date.now()}-2`,
        text: chalk.gray('You can now customize model, temperature, system message, and file patterns in .groq/local-settings.json'),
        sender: 'system',
        timestamp: new Date()
      });
    } catch (error: any) {
      addMessage({
        id: `error-${Date.now()}`,
        text: chalk.red(`Error: ${error.message}`),
        sender: 'system',
        timestamp: new Date()
      });
    }
  }
};