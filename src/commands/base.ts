export interface CommandContext {
  addMessage: (message: any) => void;
  clearHistory: () => void;
  setShowLogin: (show: boolean) => void;
  setShowModelSelector?: (show: boolean) => void;
  toggleReasoning?: () => void;
  showReasoning?: boolean;
  // Optional: allow commands to trigger an agent request directly
  sendMessage?: (message: string) => Promise<void>;
}

export interface CommandDefinition {
  command: string;
  description: string;
  handler: (context: CommandContext) => void;
  // Optional: if provided, this command is a preset prompt command.
  // When executed, the system will insert this prompt into the chat as a message
  // instead of invoking the handler. If both are present, the preset prompt takes precedence.
  customPrompt?: string;
  // If true, any text typed after the slash command will be appended to the custom prompt.
  // Example: "/review src" appends "src" to the preset prompt.
  appendArgs?: boolean;
  // Role to use when inserting the custom prompt (defaults to 'user')
  role?: 'user' | 'system';
}

export abstract class BaseCommand implements CommandDefinition {
  abstract command: string;
  abstract description: string;
  abstract handler(context: CommandContext): void;
  customPrompt?: string | undefined;
  appendArgs?: boolean | undefined;
  role?: 'user' | 'system' | undefined;
}