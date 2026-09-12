/**
 * Shared types for the agent harness, tools, and permissions.
 */

export interface ToolResult {
  success: boolean;
  content?: any;
  data?: any;
  message?: string;
  error?: string;
  userRejected?: boolean;
}

export type ToolPermissionLevel = 'read' | 'write' | 'dangerous';

export interface ToolDefinition {
  name: string;
  description: string;
  /** Which permission level this tool requires. */
  permission: ToolPermissionLevel;
  /** Parameters schema (OpenAI function-calling style). */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  /** Execute the tool with validated args. */
  run: (args: Record<string, any>) => Promise<ToolResult>;
  /**
   * Optional predicate deciding whether a given call may auto-approve
   * without prompting (e.g. reads inside the project directory).
   */
  autoApprove?: (args: Record<string, any>) => boolean;
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
  };
}

export interface ApiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_time?: number;
}

export type PermissionDecision =
  | { status: 'allow'; autoApproveSession?: boolean; alwaysAllowPath?: string }
  | { status: 'deny'; reason?: string }
  | { status: 'prompt' };

/** Result of a permission check before a tool runs. */
export interface PermissionCheck {
  decision: PermissionDecision;
  /** Whether session auto-approve is currently enabled. */
  autoApproveSession?: boolean;
}