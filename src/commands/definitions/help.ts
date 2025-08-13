import { CommandDefinition, CommandContext } from '../base.js';

// To avoid circular dependency, we'll define the command list inline
// This list should be kept in sync with the commands in index.ts
const availableCommands = [
  { command: 'help', description: 'Show help and available commands' },
  { command: 'login', description: 'Login with Groq API key' },
  { command: 'model', description: 'Select AI model' },
  { command: 'clear', description: 'Clear chat history' },
  { command: 'reasoning', description: 'Toggle reasoning mode' },
];

export const helpCommand: CommandDefinition = {
  command: 'help',
  description: 'Show help and available commands',
  handler: ({ addMessage }: CommandContext) => {
    const commandList = availableCommands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n');
    
    addMessage({
      role: 'system',
      content: `Available Commands:
${commandList}

Navigation:
- Use arrow keys to navigate chat history
- Type '/' to see available slash commands
- Use arrow keys to navigate slash command suggestions
- Press Enter to execute the selected command

Keyboard Shortcuts:
- Esc - Clear input box / Interrupt processing / Reject tool approval
- Shift+Tab - Toggle auto-approval for editing tools
- Ctrl+C - Exit the application

This is a highly customizable, lightweight, and open-source coding CLI powered by Groq. Ask for help with coding tasks, debugging issues, or explaining code.`
    });
  }
};