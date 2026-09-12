import { useState, useCallback, useRef } from 'react';
import { Agent } from '../../core/agent.js';
import type { PermissionDecision } from '../../types.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_execution';
  content: string;
  reasoning?: string;
  timestamp: Date;
  toolExecution?: ToolExecution;
  type?: string;
  usageSnapshot?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_requests: number;
    total_time: number;
    queue_time: number;
    prompt_time: number;
    completion_time: number;
  };
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
  onAddApiTokens?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; total_time?: number }) => void,
  onPauseRequest?: () => void,
  onResumeRequest?: () => void,
  onCompleteRequest?: () => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userMessageHistory, setUserMessageHistory] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentToolExecution, setCurrentToolExecution] = useState<ToolExecution | null>(null);
  const [sessionAutoApprove, setSessionAutoApprove] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    args: Record<string, any>;
    resolve: (d: PermissionDecision) => void;
  } | null>(null);
  const [pendingError, setPendingError] = useState<{
    error: string;
    resolve: (retry: boolean) => void;
  } | null>(null);
  const streamingRef = useRef<{ id: string; content: string; reasoning?: string } | null>(null);
  const currentExecutionIdRef = useRef<string | null>(null);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)));
  }, []);

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (isProcessing) return;
      if (onStartRequest) onStartRequest();
      setUserMessageHistory((prev) => [...prev, userInput]);
      addMessage({ role: 'user', content: userInput });
      setIsProcessing(true);
      try {
        // Reset streaming ref.
        if (streamingRef.current) streamingRef.current = null;

        agent.setCallbacks({
          onStreamDelta: (delta) => {
            if (!streamingRef.current) {
              const id = addMessage({ role: 'assistant', content: '' });
              streamingRef.current = { id, content: '' };
            }
            streamingRef.current.content += delta;
            updateMessage(streamingRef.current.id, {
              content: streamingRef.current.content,
            });
          },
          onMessageEnd: (content, reasoning) => {
            if (streamingRef.current) {
              updateMessage(streamingRef.current.id, { content, reasoning });
              streamingRef.current = null;
            } else if (content) {
              addMessage({ role: 'assistant', content, reasoning });
            }
          },
          onToolStart: (name, args) => {
            const toolExecution: ToolExecution = {
              id: Math.random().toString(36).substr(2, 9),
              name,
              args,
              status: 'executing',
            };
            currentExecutionIdRef.current = toolExecution.id;
            addMessage({
              role: 'tool_execution',
              content: `Executing ${name}...`,
              toolExecution,
            });
            setCurrentToolExecution(toolExecution);
          },
          onToolEnd: (name, result) => {
            const execId = currentExecutionIdRef.current;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.toolExecution?.id === execId) {
                  return {
                    ...msg,
                    content: result?.userRejected
                      ? `🚫 ${name} rejected by user`
                      : result?.success
                        ? `✓ ${name} completed`
                        : `🔴 ${name} failed: ${result?.error || 'Unknown error'}`,
                    toolExecution: {
                      ...msg.toolExecution!,
                      status: result?.userRejected
                        ? 'canceled'
                        : result?.success
                          ? 'completed'
                          : 'failed',
                      result,
                    },
                  };
                }
                return msg;
              }),
            );
            setCurrentToolExecution(null);
            currentExecutionIdRef.current = null;
          },
          onApiUsage: (usage) => {
            if (onAddApiTokens) onAddApiTokens(usage);
          },
          onPermissionPrompt: (req) => {
            if (onPauseRequest) onPauseRequest();
            return new Promise<PermissionDecision>((resolve) => {
              setPendingApproval({ toolName: req.toolName, args: req.args, resolve });
            });
          },
          onError: (error) => {
            if (onPauseRequest) onPauseRequest();
            return new Promise<boolean>((resolve) => {
              setPendingError({ error, resolve });
            });
          },
          onSummaryRequested: async () => {
            return agent.summarize();
          },
        });

        await agent.chat(userInput);
      } catch (e: any) {
        const message =
          e instanceof Error
            ? e.name === 'AbortError' || e.message.includes('aborted')
              ? 'Request interrupted.'
              : e.message
            : String(e);
        addMessage({ role: 'system', content: message });
      } finally {
        setIsProcessing(false);
        setCurrentToolExecution(null);
        if (streamingRef.current) streamingRef.current = null;
        if (onCompleteRequest) onCompleteRequest();
      }
    },
    [agent, isProcessing, addMessage, updateMessage, onStartRequest, onAddApiTokens, onPauseRequest, onResumeRequest, onCompleteRequest],
  );

  const respondApproval = useCallback(
    (decision: PermissionDecision) => {
      if (pendingApproval) {
        if (onResumeRequest) onResumeRequest();
        pendingApproval.resolve(decision);
        if (decision.status === 'allow' && decision.alwaysAllowPath) {
          agent.approvePath(decision.alwaysAllowPath);
        }
        setPendingApproval(null);
      }
    },
    [pendingApproval, agent, onResumeRequest],
  );

  const respondError = useCallback(
    (retry: boolean) => {
      if (pendingError) {
        if (onResumeRequest) onResumeRequest();
        pendingError.resolve(retry);
        setPendingError(null);
      }
    },
    [pendingError, onResumeRequest],
  );

  const setApiKey = useCallback((k: string) => agent.setApiKey(k), [agent]);

  const toggleAutoApprove = useCallback(() => {
    setSessionAutoApprove((prev) => {
      const next = !prev;
      agent.setSessionAutoApprove(next);
      return next;
    });
  }, [agent]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setUserMessageHistory([]);
    agent.clearHistory();
  }, [agent]);

  const interruptRequest = useCallback(() => {
    agent.interrupt();
    setIsProcessing(false);
    setCurrentToolExecution(null);
    addMessage({ role: 'system', content: 'User has interrupted the request.' });
  }, [agent, addMessage]);

  const toggleReasoning = useCallback(() => setShowReasoning((p) => !p), []);

  return {
    messages,
    userMessageHistory,
    isProcessing,
    currentToolExecution,
    pendingApproval,
    pendingError,
    sessionAutoApprove,
    showReasoning,
    sendMessage,
    respondApproval,
    respondError,
    addMessage,
    setApiKey,
    clearHistory,
    toggleAutoApprove,
    toggleReasoning,
    interruptRequest,
  };
}