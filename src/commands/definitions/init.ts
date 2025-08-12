import { CommandDefinition, CommandContext } from '../base.js';
import { writeProjectContext } from '../../utils/context.js';

export const initCommand: CommandDefinition = {
  command: 'init',
  description: 'Generate project context files in .groq/',
  handler: ({ addMessage }: CommandContext) => {
    try {
      const rootDir = process.env.GROQ_CONTEXT_DIR || process.cwd();
      const { mdPath, jsonPath } = writeProjectContext(rootDir);
      addMessage({
        role: 'system',
        content: `Project context generated.\n- Markdown: ${mdPath}\n- JSON: ${jsonPath}\nThe assistant will automatically load this context on startup. Re-run /init to refresh.`
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      addMessage({
        role: 'system',
        content: `Failed to generate project context: ${message}`
      });
    }
  }
};
