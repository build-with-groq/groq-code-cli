import { useState, useCallback, useRef } from 'react';
import { Agent } from '../../core/agent.js';
import { DANGEROUS_TOOLS, APPROVAL_REQUIRED_TOOLS } from '../../tools/tool-schemas.js';
import { parseApiError, formatErrorForDisplay } from '../../utils/errorUtils.js';
import { ConfigManager } from '../../utils/local-settings.js';

const configManager = new ConfigManager();
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'tool_execution';
  content: string;
  reasoning?: string;
  timestamp: Date;
  toolExecution?: ToolExecution;
}

export interface ToolExecution {
  id: string;
  name: string;
  args: Record<string, any>;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'canceled';
  result?: any;
  needsApproval?: boolean;
}

export function useAgent(
  agent: Agent, 
  onStartRequest?: () => void,
  onAddApiTokens?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void, 
  onPauseRequest?: () => void,
  onResumeRequest?: () => void,
  onCompleteRequest?: () => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userMessageHistory, setUserMessageHistory] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentToolExecution, setCurrentToolExecution] = useState<ToolExecution | null>(null);
  const [sessionAutoApprove, setSessionAutoApprove] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const currentExecutionIdRef = useRef<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    toolArgs: Record<string, any>;
    resolve: (approvalResult: { approved: boolean; autoApproveSession?: boolean }) => void;
  } | null>(null);
  const [pendingMaxIterations, setPendingMaxIterations] = useState<{
    maxIterations: number;
    resolve: (shouldContinue: boolean) => void;
  } | null>(null);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  const sendMessage = useCallback(async (userInput: string) => {
    if (isProcessing) return;

    // Start tracking metrics for new agent request
    if (onStartRequest) {
      onStartRequest();
    }

    // Add user message to history
    setUserMessageHistory(prev => [...prev, userInput]);

    // Add user message
    addMessage({
      role: 'user',
      content: userInput,
    });

    setIsProcessing(true);

    try {
      // Set up tool execution callbacks
      agent.setToolCallbacks({
        onThinkingText: (content: string, reasoning?: string) => {
          // Add thinking text as assistant message when model uses tools
          addMessage({
            role: 'assistant',
            content: content,
            reasoning: reasoning,
          });
        },
        onFinalMessage: (content: string, reasoning?: string) => {
          // Add final assistant message when no tools are used
          addMessage({
            role: 'assistant',
            content: content,
            reasoning: reasoning,
          });
        },
        onToolStart: (name: string, args: Record<string, any>) => {
          const toolExecution: ToolExecution = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            args,
            status: 'pending',
            needsApproval: DANGEROUS_TOOLS.includes(name) || APPROVAL_REQUIRED_TOOLS.includes(name),
          };
          
          // Store the ID in ref for reliable matching across callbacks
          currentExecutionIdRef.current = toolExecution.id;
          
          // Always add tool execution message; approval is handled separately
          addMessage({
            role: 'tool_execution',
            content: `Executing ${name}...`,
            toolExecution,
          });
          
          setCurrentToolExecution(toolExecution);
        },
        onToolEnd: (name: string, result: any) => {
          const executionId = currentExecutionIdRef.current;
          
          // Only update the specific tool execution that just finished
          setMessages(prev => {
            return prev.map(msg => {
              // Match by the execution ID stored in ref (reliable across callbacks)
              if (msg.toolExecution?.id === executionId && msg.role === 'tool_execution') {
                return { 
                ...msg, 
                content: result.userRejected 
                  ? `🚫 ${name} rejected by user`
                  : result.success 
                    ? `✓ ${name} completed successfully` 
                    : `🔴 ${name} failed: ${result.error || 'Unknown error'}`,
                toolExecution: { 
                  ...msg.toolExecution!, 
                  status: result.userRejected 
                    ? 'canceled'
                    : result.success 
                      ? 'completed' 
                      : 'failed',
                  result 
                }
              };
            }
            return msg;
          });
        });
          setCurrentToolExecution(null);
          currentExecutionIdRef.current = null;
        },
        onApiUsage: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => {
          // Pass API usage data to token metrics
          if (onAddApiTokens) {
            onAddApiTokens(usage);
          }
        },
        onToolApproval: async (toolName: string, toolArgs: Record<string, any>) => {          
          // Pause metrics while waiting for approval
          if (onPauseRequest) {
            onPauseRequest();
          }
          
          return new Promise<{ approved: boolean; autoApproveSession?: boolean }>((resolve) => {
            setPendingApproval({ 
              toolName, 
              toolArgs, 
              resolve: (approvalResult: { approved: boolean; autoApproveSession?: boolean }) => {
                
                // Resume metrics after approval decision
                if (onResumeRequest) {
                  onResumeRequest();
                }
                
                // Update the existing tool execution message with approval result
                setMessages(prev => {
                  return prev.map(msg => {
                    if (msg.toolExecution?.id === currentExecutionIdRef.current && msg.role === 'tool_execution') {
                      const messageContent = approvalResult.approved 
                        ? `Executing ${toolName}...${approvalResult.autoApproveSession ? ' (Auto-approval enabled for session)' : ''}` 
                        : `Tool ${toolName} rejected by user`;
                      
                      return { 
                        ...msg, 
                        content: messageContent,
                        toolExecution: { 
                          ...msg.toolExecution!, 
                          status: approvalResult.approved ? 'approved' : 'canceled'
                        }
                      };
                    }
                    return msg;
                  });
                });
                
                if (approvalResult.autoApproveSession) {
                  setSessionAutoApprove(true);
                }
                resolve(approvalResult);
              }
            });
          });
        },
        onMaxIterations: async (maxIterations: number) => {          
          // Pause metrics while waiting for continuation decision
          if (onPauseRequest) {
            onPauseRequest();
          }
          
          return new Promise<boolean>((resolve) => {
            setPendingMaxIterations({ 
              maxIterations, 
              resolve: (shouldContinue: boolean) => {
                
                // Resume metrics after decision
                if (onResumeRequest) {
                  onResumeRequest();
                }
                
                resolve(shouldContinue);
              }
            });
          });
        },
      });

      await agent.chat(userInput);

    } catch (error) {
      // Don't show abort errors - user interruption message is already shown
      if (error instanceof Error && (
        error.message.includes('Request was aborted') ||
        error.message.includes('The operation was aborted') ||
        error.name === 'AbortError'
      )) {
        // Skip showing abort errors since user already sees "User has interrupted the request"
        return;
      }
      
      // Parse and format the error for display
      const parsedError = parseApiError(error);
      const errorMessage = formatErrorForDisplay(parsedError);
      
      addMessage({
        role: 'system',
        content: errorMessage,
      });
    } finally {
      setIsProcessing(false);
      setCurrentToolExecution(null);
      
      // Complete the request tracking
      if (onCompleteRequest) {
        onCompleteRequest();
      }
    }
  }, [agent, isProcessing, addMessage, updateMessage, onStartRequest, onAddApiTokens, onPauseRequest, onResumeRequest, onCompleteRequest]);

  const approveToolExecution = useCallback((approved: boolean, autoApproveSession?: boolean) => {
    if (pendingApproval) {
      pendingApproval.resolve({ approved, autoApproveSession });
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const respondToMaxIterations = useCallback((shouldContinue: boolean) => {
    if (pendingMaxIterations) {
      pendingMaxIterations.resolve(shouldContinue);
      setPendingMaxIterations(null);
    }
  }, [pendingMaxIterations]);

  const setApiKey = useCallback((apiKey: string) => {
    const provider = configManager.getProvider() || 'groq';
    agent.setApiKey(provider, apiKey);
  }, [agent]);

  const toggleAutoApprove = useCallback(() => {
    const newAutoApproveState = !sessionAutoApprove;
    setSessionAutoApprove(newAutoApproveState);
    agent.setSessionAutoApprove(newAutoApproveState);
  }, [sessionAutoApprove, agent]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setUserMessageHistory([]);
    // Don't reset sessionAutoApprove, it should persist across /clear
    agent.clearHistory();
  }, [agent]);

  const interruptRequest = useCallback(() => {
    agent.interrupt();
    setIsProcessing(false);
    setCurrentToolExecution(null);
    
    // Add the interruption message to the UI
    addMessage({
      role: 'system',
      content: 'User has interrupted the request.',
    });
  }, [agent, addMessage]);

  const toggleReasoning = useCallback(() => {
    setShowReasoning(prev => !prev);
  }, []);

  return {
    messages,
    userMessageHistory,
    isProcessing,
    currentToolExecution,
    pendingApproval,
    pendingMaxIterations,
    sessionAutoApprove,
    showReasoning,
    sendMessage,
    approveToolExecution,
    respondToMaxIterations,
    addMessage,
    setApiKey,
    clearHistory,
    toggleAutoApprove,
    toggleReasoning,
    interruptRequest,
  };
}