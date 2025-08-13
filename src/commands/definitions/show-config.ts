import { CommandDefinition, CommandContext } from '../base.js';
import { ConfigManager } from '../../utils/local-settings.js';
import chalk from 'chalk';

export const showConfigCommand: CommandDefinition = {
  command: 'config',
  aliases: ['show-config'],
  description: 'Show current configuration (merged project and global settings)',
  handler: ({ addMessage }: CommandContext) => {
    try {
      const configManager = new ConfigManager();
      const config = configManager.getAllConfig();
      const projectPath = configManager.getProjectConfigPath();
      
      let configDisplay = chalk.cyan('Current Configuration:\n');
      
      if (projectPath) {
        configDisplay += chalk.gray(`Project config: ${projectPath}\n`);
      }
      
      configDisplay += chalk.gray(`Global config: ~/.groq/local-settings.json\n\n`);
      
      configDisplay += chalk.white('Merged settings:\n');
      configDisplay += JSON.stringify(config, null, 2);
      
      addMessage({
        id: `system-${Date.now()}`,
        text: configDisplay,
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