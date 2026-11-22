import { CommandDefinition, CommandContext } from '../base.js';
import { listSessions, formatTokens, timeAgo } from '../../utils/sessions.js';

export const sessionsCommand: CommandDefinition = {
  command: 'sessions',
  description: 'List saved sessions for this directory (/sessions all for every directory)',
  handler: ({ addMessage, args, currentSessionId }: CommandContext) => {
    const showAll = args === 'all';
    const sessions = listSessions({ allDirs: showAll }).slice(0, 15);

    if (sessions.length === 0) {
      addMessage({
        role: 'system',
        content: showAll ? 'No saved sessions yet.' : 'No saved sessions for this directory. Try /sessions all',
      });
      return;
    }

    const lines = sessions.map(s => {
      const current = s.id === currentSessionId ? ' (current)' : '';
      const where = showAll ? `  ${s.cwd}` : '';
      return `${s.id}${current}  ${timeAgo(s.updatedAt)}  ${s.messageCount} msgs  ${formatTokens(s.usage?.totalTokens || 0)} tokens${where}\n    ${s.title}`;
    });

    addMessage({
      role: 'system',
      content: `Saved sessions:\n${lines.join('\n')}\n\nUse /resume <id> to continue one (a unique prefix is enough).`,
    });
  }
};
