/**
 * Context / conversation management.
 *
 * Provides a rough token estimator (chars/4) so we can keep the conversation
 * within a target budget, auto-trim old tool results, and support /compact.
 */

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

const MAX_CONTEXT_TOKENS = 128_000;
const TARGET_CONTEXT_TOKENS = 80_000;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough heuristic: ~4 chars per token. Accurate enough for trimming decisions.
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(m: AgentMessage): number {
  let n = 4; // role + overhead
  if (m.content) n += estimateTokens(m.content);
  if (m.tool_calls) {
    for (const tc of m.tool_calls) {
      n += estimateTokens(tc.function?.name || '') + estimateTokens(tc.function?.arguments || '');
    }
  }
  return n;
}

export function estimateConversationTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

export function isOverBudget(messages: AgentMessage[]): boolean {
  return estimateConversationTokens(messages) > TARGET_CONTEXT_TOKENS;
}

/**
 * Trim the oldest non-system, non-recent messages when over budget.
 * Keeps the system prompt and the most recent messages intact.
 */
export function trimConversation(messages: AgentMessage[], maxTokens = TARGET_CONTEXT_TOKENS): AgentMessage[] {
  if (!isOverBudget(messages)) return messages;
  const result = [...messages];
  // Find index of first non-system message.
  const firstNonSystem = result.findIndex((m) => m.role !== 'system');
  const over = () => estimateConversationTokens(result) > maxTokens;

  // Drop oldest non-system messages until under budget, keeping at least the
  // most recent few messages so the tail of the conversation stays coherent.
  // A single message that alone exceeds the target is always droppable first.
  let iterations = 0;
  while (over() && firstNonSystem >= 0 && result.length > firstNonSystem) {
    // Stop shrinking if we'd be comfortable even with the hard cap, unless the
    // head message alone is still over the target.
    if (iterations > 0) {
      const tail = result.slice(firstNonSystem);
      if (result.length >= 4 && estimateConversationTokens(tail) <= maxTokens) break;
    }
    result.splice(firstNonSystem, 1);
    iterations++;
    if (iterations > 1000) break;
  }
  // Hard fallback: if still over the hard cap, keep system prompt + last 4.
  if (estimateConversationTokens(result) > MAX_CONTEXT_TOKENS) {
    const systems = result.filter((m) => m.role === 'system');
    const tail = result.slice(-4);
    return [...systems, ...tail];
  }
  return result;
}

/** Build a compacted system note to inject after a summary. */
export function compactMarker(summary: string): string {
  return [
    '[CONTEXT COMPACTED]',
    'Earlier parts of the conversation were summarized to free space. Summary:',
    summary,
    '',
    'Continue where you left off. Do not repeat work already done.',
  ].join('\n');
}

export { MAX_CONTEXT_TOKENS, TARGET_CONTEXT_TOKENS };