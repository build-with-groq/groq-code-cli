import { CommandDefinition, CommandContext } from '../base.js';

export const statsCommand: CommandDefinition = {
  command: 'stats',
  description: 'Display session statistics and token usage',
  handler: ({ addMessage, sessionStats }: CommandContext) => {
    addMessage({
      role: 'system',
      content: 'SHOW_STATS',
      type: 'stats',
      usageSnapshot: sessionStats ? {
        prompt_tokens: sessionStats.promptTokens,
        completion_tokens: sessionStats.completionTokens,
        total_tokens: sessionStats.totalTokens,
        total_requests: sessionStats.totalRequests,
        total_time: sessionStats.totalTime,
        queue_time: 0,
        prompt_time: 0,
        completion_time: 0,
      } : undefined
    });
  }
};