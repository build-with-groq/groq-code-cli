import { CommandDefinition, CommandContext } from '../base.js';
import { getCurrentTasks } from '../../tools/registry.js';

/**
 * Estimated pricing (per 1M tokens). Groq's open models are cheap; use a
 * representative ~$0.30 / 1M input, ~$0.60 / 1M output as a rough default.
 * These are estimates — real pricing varies by model.
 */
const INPUT_PER_M = 0.3;
const OUTPUT_PER_M = 0.6;

export const costCommand: CommandDefinition = {
  command: 'cost',
  description: 'Estimate token/cost usage for this session',
  handler: ({ addMessage, sessionStats }: CommandContext) => {
    const s = sessionStats || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      totalTime: 0,
    };
    const inputCost = (s.promptTokens / 1_000_000) * INPUT_PER_M;
    const outputCost = (s.completionTokens / 1_000_000) * OUTPUT_PER_M;
    const totalCost = inputCost + outputCost;
    const timeSec = s.totalTime || 0;

    addMessage({
      role: 'system',
      content: [
        `💵 Cost & usage (this session)`,
        `Requests:      ${s.totalRequests}`,
        `Input tokens:  ${s.promptTokens.toLocaleString()}  (~$${inputCost.toFixed(4)})`,
        `Output tokens: ${s.completionTokens.toLocaleString()}  (~$${outputCost.toFixed(4)})`,
        `Total tokens:  ${s.totalTokens.toLocaleString()}`,
        `Total time:    ${timeSec.toFixed(1)}s`,
        `Est. cost:     ~$${totalCost.toFixed(4)}`,
        '',
        'Pricing is an estimate based on approximate open-model rates. Check Groq pricing for exact figures.',
      ].join('\n'),
    });
  },
};

export const todoCommand: CommandDefinition = {
  command: 'todo',
  description: 'Show the current task checklist',
  handler: ({ addMessage }: CommandContext) => {
    const tasks = getCurrentTasks();
    if (!tasks || tasks.tasks.length === 0) {
      addMessage({ role: 'system', content: 'No active task list. Ask the agent to break a task into steps and it will create one.' });
      return;
    }
    const lines = tasks.tasks.map((t) => {
      const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜';
      return `${icon} ${t.description}`;
    });
    addMessage({
      role: 'system',
      content: `📋 Task list — ${tasks.tasks.filter((t) => t.status === 'completed').length}/${tasks.tasks.length} done\n\n${lines.join('\n')}`,
    });
  },
};