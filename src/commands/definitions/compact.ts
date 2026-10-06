import { CommandDefinition, CommandContext } from '../base.js';

export const compactCommand: CommandDefinition = {
  command: 'compact',
  description: 'Summarize and compress conversation context',
  handler: ({ addMessage, agent }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'Compaction requires the agent to be loaded.' });
      return;
    }
    const before = agent.estimateTokens?.() ?? 0;
    const summary = agent.summarize();
    // Reset non-system history to a system marker carrying the summary.
    agent.compactWithSummary(summary);
    const after = agent.estimateTokens?.() ?? 0;
    addMessage({
      role: 'system',
      content: `Context compacted. Before: ~${before} tokens. After: ~${after} tokens.\n\nThe conversation was summarized; earlier details were removed to free context. If you need specifics, ask to re-read files.`,
    });
  },
};