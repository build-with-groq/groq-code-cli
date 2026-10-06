import { CommandDefinition, CommandContext } from '../base.js';

export const saveCommand: CommandDefinition = {
  command: 'save',
  description: 'Save the current conversation for later resume',
  handler: ({ addMessage, agent }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'Save requires the agent to be loaded.' });
      return;
    }
    const file = agent.persistSession();
    const name = file.split(/[\\/]/).pop();
    addMessage({ role: 'system', content: `Session saved: ${name}\nUse /resume ${name} to load it later.` });
  },
};

export const resumeCommand: CommandDefinition = {
  command: 'resume',
  description: 'List or load saved conversations',
  handler: ({ addMessage, agent, rawCommand }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'Resume requires the agent to be loaded.' });
      return;
    }

    // Extract argument after "/resume"
    const rest = (rawCommand || '/resume').trim().split(' ').slice(1).join(' ');
    const arg = rest.trim();
    const sessions = agent.listSessions();

    if (arg && arg !== '/resume') {
      // Handle /resume <file> or /resume fresh
      if (arg === 'fresh') {
        addMessage({ role: 'system', content: 'Use /clear to start a fresh conversation.' });
        return;
      }
      const target = sessions.find((s) => s.id === arg) || sessions.find((s) => s.file.endsWith(arg));
      if (target) {
        const loaded = agent.loadSessionFile(target.file);
        if (loaded) {
          addMessage({
            role: 'system',
            content: `Resumed session ${target.id} — ${loaded.length} messages loaded.`,
          });
          return;
        }
        addMessage({ role: 'system', content: `Could not load session: ${arg}` });
        return;
      }
      addMessage({ role: 'system', content: `Session not found: ${arg}` });
      return;
    }

    if (sessions.length === 0) {
      addMessage({
        role: 'system',
        content: [
          'No saved sessions found.',
          '',
          'Conversations are auto-saved to .groq/sessions/ when you exit.',
          'Usage:  /resume             (list saved sessions)',
          '        /resume <file>      (load a specific session file)',
        ].join('\n'),
      });
      return;
    }

    const lines = sessions.map((s, i) => {
      const when = new Date(s.updated_at).toLocaleString();
      return `${i + 1}. ${s.id} — ${s.messageCount} msgs, ~${s.tokens} tokens (${when})`;
    });

    addMessage({
      role: 'system',
      content: `Saved sessions (newest first):\n${lines.join('\n')}\n\nType /resume <file> to load one, /resume fresh to start clean.`,
    });
  },
};

export const resumeClearCommand: CommandDefinition = {
  command: 'resume clear',
  description: 'Delete all saved sessions',
  handler: ({ addMessage, agent }: CommandContext) => {
    if (!agent) {
      addMessage({ role: 'system', content: 'No agent available.' });
      return;
    }
    for (const s of agent.listSessions()) agent.removeSession(s.file);
    addMessage({ role: 'system', content: 'All saved sessions deleted.' });
  },
};