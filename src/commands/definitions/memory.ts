import { CommandDefinition, CommandContext } from '../base.js';
import { getUserMemory, getProjectMemory } from '../../core/memory.js';

export const memoryCommand: CommandDefinition = {
  command: 'memory',
  description: 'View persistent memory (project + user)',
  handler: ({ addMessage, agent }: CommandContext) => {
    const project = agent ? agent.getMemoryContent() : getProjectMemory();
    const user = getUserMemory();

    const sections: string[] = [];
    sections.push('## Project memory (.groq/memory.md)');
    sections.push(project && project.trim() ? project.trim() : '(empty)');
    sections.push('');
    sections.push('## User memory (~/.groq/memory.md)');
    sections.push(user && user.trim() ? user.trim() : '(empty)');
    sections.push('');
    sections.push('Memory is auto-loaded into the assistant on startup.');
    sections.push('To add facts, edit the .groq/memory.md file or ask the model to remember something.');
    sections.push('Usage: /memory        (view this)');
    sections.push('       /memory clear  (empty project memory)');

    addMessage({ role: 'system', content: sections.join('\n') });
  },
};

export function clearProjectMemory(agent?: import('../base.js').CommandContext['agent']): void {
  if (agent) agent.setMemoryContent('');
}

export const memoryClearCommand: CommandDefinition = {
  command: 'memory clear',
  description: 'Clear project memory',
  handler: ({ addMessage, agent }: CommandContext) => {
    if (agent) {
      agent.setMemoryContent('');
      addMessage({ role: 'system', content: 'Project memory cleared.' });
    } else {
      addMessage({ role: 'system', content: 'No agent available to clear memory.' });
    }
  },
};