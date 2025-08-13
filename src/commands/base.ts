export interface CommandContext {
  addMessage: (message: any) => void;
  clearHistory: () => void;
  setShowLogin: (show: boolean) => void;
  setShowModelSelector?: (show: boolean) => void;
  toggleReasoning?: () => void;
  showReasoning?: boolean;
}

export interface CommandDefinition {
  command: string;
  aliases?: string[];
  description: string;
  handler: (context: CommandContext) => void;
}

export abstract class BaseCommand implements CommandDefinition {
  abstract command: string;
  abstract description: string;
  abstract handler(context: CommandContext): void;
}