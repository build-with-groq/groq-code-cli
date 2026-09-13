import { CommandDefinition, CommandContext } from '../base.js';

export const planCommand: CommandDefinition = {
  command: 'plan',
  description: 'Explore read-only and present a plan before making changes',
  handler: ({ addMessage, agent }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'Plan mode requires the agent to be loaded.' });
      return;
    }
    agent.setPlanMode(true);
    addMessage({
      role: 'system',
      content: [
        '🛠 PLAN MODE ENABLED',
        '',
        'The agent will now only run READ-ONLY tools (read_file, list_files, search_files, project_tree).',
        'No files will be modified or commands executed.',
        '',
        'Describe the task you want done. The agent will explore, then present a plan.',
        'Type "go" / "proceed" to approve and start executing it.',
        'Type /plan again to cancel plan mode.',
      ].join('\n'),
    });
  },
};