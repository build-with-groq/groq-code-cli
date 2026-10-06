import { CommandDefinition, CommandContext } from '../base.js';
import { listSkills } from '../../core/skills.js';

export const permissionsCommand: CommandDefinition = {
  command: 'permissions',
  description: 'Show and manage tool permissions',
  handler: ({ addMessage, agent }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'Permissions management requires the agent to be loaded.' });
      return;
    }
    addMessage({
      role: 'system',
      content: [
        'Permission status:',
        agent.describePermissions(),
        '',
        'How approval works:',
        '- Read tools (read_file, list_files, search_files, project_tree, web_search) always run.',
        '- Safe commands (ls, cat, grep, git status/diff) run automatically.',
        '- Every file write / edit / command asks before it runs.',
        '- "Yes, and always allow this path" remembers a file for the session.',
        '- "Yes, and don\'t ask again" turns on session auto-approve for writes.',
        '- Persistent rules can be set in .permissions.json or ~/.groq/permissions.json:',
        '  { "allow": [ { "tool": "execute_command", "arg": "command", "value": "npm test" } ] }',
        '',
        'Tips:',
        '- Shift+Tab toggles session auto-approve for writes.',
      ].join('\n'),
    });

    const skills = listSkills();
    if (skills.length > 0) {
      addMessage({
        role: 'system',
        content: `Installed skills:\n${skills.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`,
      });
    }
  },
};