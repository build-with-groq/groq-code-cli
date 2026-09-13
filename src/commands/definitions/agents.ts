import { CommandDefinition, CommandContext } from '../base.js';

/**
 * /agents "<research question>"
 *
 * Spawns a background research sub-agent that explores the codebase read-only
 * and reports findings back into the conversation (as a system message).
 * The main agent's conversation is untouched.
 */
export const agentsCommand: CommandDefinition = {
  command: 'agents',
  description: 'Spawn a background research sub-agent',
  handler: async ({ addMessage, agent, rawCommand }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'Sub-agents require the agent to be loaded.' });
      return;
    }

    // Parse the question from the raw command, stripping quotes.
    const rest = (rawCommand || '/agents').split(' ').slice(1).join(' ').trim();
    const question = rest.replace(/^["']|["']$/g, '').trim();

    if (!question) {
      addMessage({
        role: 'system',
        content: [
          'Usage: /agents "<research question>"',
          '',
          'Spawns a read-only background research sub-agent that explores the codebase',
          'and reports findings. e.g.:  /agents "How does the auth flow work?"',
        ].join('\n'),
      });
      return;
    }

    addMessage({ role: 'system', content: `🧵 Spawning research sub-agent for: "${question}"... (read-only)` });

    const start = Date.now();
    const findings = await agent.research(question).catch((e) => `Sub-agent failed: ${e instanceof Error ? e.message : String(e)}`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    addMessage({
      role: 'system',
      content: `🧵 Research sub-agent findings (${elapsed}s):\n\n${findings}\n\n---\nYou can ask the main agent to act on these findings.`,
    });
  },
};