import Groq from 'groq-sdk';
import chalk from 'chalk';
import * as readline from 'readline';
import * as os from 'os';
import * as path from 'path';
import { displayTree } from '../utils/file-ops.js';
import { formatToolParams, executeTool } from '../tools/builtin/tools.js';
import { validateReadBeforeEdit, getReadBeforeEditError } from '../tools/validators.js';
import { ALL_TOOLS, DANGEROUS_TOOLS } from '../tools/builtin/tool-schemas.js';
import { ConfigManager } from '../utils/local-settings.js';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export class Agent {
  private client: Groq | null = null;
  private messages: Message[] = [];
  private apiKey: string | null = null;
  private model: string;
  private temperature: number;
  private noContext: boolean;
  private directory: string;
  private autoWrite: boolean;
  private systemMessage: string;
  private configManager: ConfigManager;
  private onToolStart?: (name: string, args: Record<string, any>) => void;
  private onToolEnd?: (name: string, result: any) => void;
  private onToolApproval?: (toolName: string, toolArgs: Record<string, any>) => Promise<boolean>;
  private onThinkingText?: (content: string) => void;
  private onFinalMessage?: (content: string) => void;

  private constructor(
    model: string,
    temperature: number,
    systemMessage: string | null,
    noContext: boolean,
    directory: string,
    autoWrite: boolean
  ) {
    this.model = model;
    this.temperature = temperature;
    this.noContext = noContext;
    this.directory = directory;
    this.autoWrite = autoWrite;
    this.configManager = new ConfigManager();

    // Build system message
    if (systemMessage) {
      this.systemMessage = systemMessage;
    } else {
      this.systemMessage = this.buildDefaultSystemMessage();
    }

    // Add system message to conversation
    this.messages.push({ role: 'system', content: this.systemMessage });
  }

  /**
   * Gather lightweight directory context - just environment info and file tree
   */
  private static async gatherDirectoryContext(directory: string = '.'): Promise<string> {
    const context: string[] = [];
    const directoryPath = path.resolve(directory);
    
    // Environment information
    context.push('=== ENVIRONMENT ===');
    context.push(`Operating System: ${os.platform()} ${os.release()}`);
    context.push(`Architecture: ${os.arch()}`);
    context.push(`Node.js Version: ${process.version}`);
    context.push(`Current Working Directory: ${directoryPath}`);
    context.push(`Date: ${new Date().toISOString()}`);
    context.push(`User: ${os.userInfo().username}`);
    
    context.push('\n=== PROJECT STRUCTURE ===');
    
    // Get directory tree using existing displayTree function
    try {
      const tree = await displayTree(directory, '*', true, false);
      context.push(tree);
    } catch (error) {
      context.push(`Error generating directory tree: ${error}`);
    }
    
    return context.join('\n');
  }

  // TODO: Add remaining flags
  static async create(
    model: string,
    temperature: number,
    systemMessage: string | null,
    noContext: boolean,
    directory: string,
    autoWrite: boolean
  ): Promise<Agent> {
    // Check for default model in config if model not explicitly provided
    const configManager = new ConfigManager();
    const defaultModel = configManager.getDefaultModel();
    const selectedModel = defaultModel || model;
    
    const agent = new Agent(
      selectedModel,
      temperature,
      systemMessage,
      noContext,
      directory,
      autoWrite
    );

    // Add directory context if not disabled
    if (!noContext) {
      try {
        const context = await Agent.gatherDirectoryContext(directory);
        if (context) {
          const contextMsg = `Directory context for ${directory}:\n\n${context}`;
          agent.messages.push({ role: 'system', content: contextMsg });
        }
      } catch (error) {
      }
    }

    return agent;
  }

  private buildDefaultSystemMessage(): string {
    return `You are a coding assistant powered by ${this.model} on Groq. You have access to file system tools.

Use tools to:
- Read and understand files
- Create, edit, and manage files  
- Execute commands
- Search for information

IMPORTANT: When creating files, keep them focused and reasonably sized. For large applications:
1. Start with a simple, minimal version first
2. Create separate files for different components
3. Build incrementally rather than generating massive files at once

Be direct and efficient. Ask for approval before making destructive changes.

When asked about your identity, you should identify yourself as a coding assistant running on the ${this.model} model via Groq.`;
  }


  public setToolCallbacks(callbacks: {
    onToolStart?: (name: string, args: Record<string, any>) => void;
    onToolEnd?: (name: string, result: any) => void;
    onToolApproval?: (toolName: string, toolArgs: Record<string, any>) => Promise<boolean>;
    onThinkingText?: (content: string) => void;
    onFinalMessage?: (content: string) => void;
  }) {
    this.onToolStart = callbacks.onToolStart;
    this.onToolEnd = callbacks.onToolEnd;
    this.onToolApproval = callbacks.onToolApproval;
    this.onThinkingText = callbacks.onThinkingText;
    this.onFinalMessage = callbacks.onFinalMessage;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new Groq({ apiKey });
  }

  public saveApiKey(apiKey: string): void {
    this.configManager.setApiKey(apiKey);
    this.setApiKey(apiKey);
  }

  public clearApiKey(): void {
    this.configManager.clearApiKey();
    this.apiKey = null;
    this.client = null;
  }

  public clearHistory(): void {
    // Reset messages to only contain system messages
    this.messages = this.messages.filter(msg => msg.role === 'system');
  }

  public setModel(model: string): void {
    this.model = model;
    // Save as default model
    this.configManager.setDefaultModel(model);
    // Update system message to reflect new model
    const newSystemMessage = this.buildDefaultSystemMessage();
    this.systemMessage = newSystemMessage;
    // Update the system message in the conversation
    const systemMsgIndex = this.messages.findIndex(msg => msg.role === 'system' && msg.content.includes('coding assistant'));
    if (systemMsgIndex >= 0) {
      this.messages[systemMsgIndex].content = newSystemMessage;
    }
  }

  public getCurrentModel(): string {
    return this.model;
  }

  async chat(userInput: string): Promise<void> {
    // Check API key on first message send
    if (!this.client) {
      // Try environment variable first
      const envApiKey = process.env.GROQ_API_KEY;
      if (envApiKey) {
        this.setApiKey(envApiKey);
      } else {
        // Try config file
        const configApiKey = this.configManager.getApiKey();
        if (configApiKey) {
          this.setApiKey(configApiKey);
        } else {
          throw new Error('No API key available. Please use /login to set your Groq API key.');
        }
      }
    }

    // Add user message
    this.messages.push({ role: 'user', content: userInput });

    const maxIterations = 20;
    let iteration = 0;

    while (true) { // Outer loop for iteration reset
      while (iteration < maxIterations) {
        try {
          // Check client exists
          if (!this.client) {
            throw new Error('Groq client not initialized');
          }
          
          // Use non-streaming API call for tool execution phases
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: this.messages as any,
            tools: ALL_TOOLS,
            tool_choice: 'auto',
            temperature: this.temperature,
            max_tokens: 8000,
            stream: false
          });

          const message = response.choices[0].message;

          // Handle tool calls if present
          if (message.tool_calls) {
            // Show thinking text if present
            if (message.content) {
              if (this.onThinkingText) {
                this.onThinkingText(message.content);
              }
            }

            // Add assistant message to history
            const assistantMsg: Message = {
              role: 'assistant',
              content: message.content || ''
            };
            assistantMsg.tool_calls = message.tool_calls;
            this.messages.push(assistantMsg);

            // Execute tool calls
            for (const toolCall of message.tool_calls) {
              const result = await this.executeToolCall(toolCall);

              // Add tool result to conversation (including rejected ones)
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });

              // Check if user rejected the tool - if so, stop processing
              if (result.userRejected) {
                // Add a note to the conversation that the user rejected the tool
                this.messages.push({
                  role: 'system',
                  content: `The user rejected the ${toolCall.function.name} tool execution. The response has been terminated. Please wait for the user's next instruction.`
                });
                return;
              }
            }

            // Continue loop to get model response to tool results
            iteration++;
            continue;
          }

          // No tool calls - this is the final response
          const content = message.content || '';
          
          if (this.onFinalMessage) {
            this.onFinalMessage(content);
          }

          // Add final response to conversation history
          this.messages.push({
            role: 'assistant',
            content: content
          });

          return; // Successfully completed, exit both loops

        } catch (error) {
          // Error handling is done by TUI
          return; // Error occurred, exit both loops
        }
      }

      // Hit max iterations - ask user if they want to continue
      if (iteration >= maxIterations) {
        const shouldContinue = await this.askContinue(maxIterations);
        if (shouldContinue) {
          iteration = 0; // Reset iteration counter
          continue; // Continue the outer loop
        } else {
          return; // Exit both loops
        }
      }
    }
  }

  private async executeToolCall(toolCall: any): Promise<Record<string, any>> {
    try {
      const toolName = toolCall.function.name;

      // Handle truncated tool calls
      let toolArgs: any;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        return {
          error: `Tool arguments truncated: ${error}. Please break this into smaller pieces or use shorter content.`,
          success: false
        };
      }

      // Notify UI about tool start
      if (this.onToolStart) {
        this.onToolStart(toolName, toolArgs);
      }

      // Check read-before-edit for edit tools
      if (toolName === 'edit_file' && toolArgs.file_path) {
        if (!validateReadBeforeEdit(toolArgs.file_path)) {
          const errorMessage = getReadBeforeEditError(toolArgs.file_path);
          const result = { error: errorMessage, success: false };
          if (this.onToolEnd) {
            this.onToolEnd(toolName, result);
          }
          return result;
        }
      }

      // Check if tool needs approval (only after validation passes)
      if (DANGEROUS_TOOLS.includes(toolName) && !this.autoWrite) {
        let approved: boolean;
        
        if (this.onToolApproval) {
          approved = await this.onToolApproval(toolName, toolArgs);
        } else {
          approved = await this.getToolApproval(toolName, toolArgs);
        }
        
        if (!approved) {
          const result = { error: 'Tool execution canceled by user', success: false, userRejected: true };
          if (this.onToolEnd) {
            this.onToolEnd(toolName, result);
          }
          return result;
        }
      }

      // Execute tool
      const result = await executeTool(toolName, toolArgs);

      // Notify UI about tool completion
      if (this.onToolEnd) {
        this.onToolEnd(toolName, result);
      }

      return result;

    } catch (error) {
      const errorMsg = `Tool execution error: ${error}`;
      return { error: errorMsg, success: false };
    }
  }

  private async getToolApproval(toolName: string, toolArgs: Record<string, any>): Promise<boolean> {
    console.log(chalk.yellow(`⚠️ ${toolName} requires approval`));
    return await this.confirm(`Execute ${toolName}?`);
  }

  private async askContinue(maxIterations: number): Promise<boolean> {
    return await this.confirm(`Maximum iterations (${maxIterations}) reached. Continue?`);
  }

  private async confirm(question: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${question} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

}