import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Agent } from '../../../core/agent.js';
import { useAgent } from '../../hooks/useAgent.js';
import { useTokenMetrics } from '../../hooks/useTokenMetrics.js';
import { useSessionStats } from '../../hooks/useSessionStats.js';
import MessageHistory from './MessageHistory.js';
import MessageInput from './MessageInput.js';
import TokenMetrics from '../display/TokenMetrics.js';
import PendingToolApproval from '../input-overlays/PendingToolApproval.js';
import Login from '../input-overlays/Login.js';
import ModelSelector from '../input-overlays/ModelSelector.js';
import MaxIterationsContinue from '../input-overlays/MaxIterationsContinue.js';
import ErrorRetry from '../input-overlays/ErrorRetry.js';
import { handleSlashCommand } from '../../../commands/index.js';

interface ChatProps {
  agent: Agent;
}

export default function Chat({ agent }: ChatProps) {
  const {
    completionTokens,
    startTime,
    endTime,
    pausedTime,
    isPaused,
    isActive,
    startRequest,
    addApiTokens,
    pauseMetrics,
    resumeMetrics,
    completeRequest,
    resetMetrics,
  } = useTokenMetrics();

  const {
    sessionStats,
    addSessionTokens,
    clearSessionStats,
  } = useSessionStats();

  // Wrapper function to add tokens to both per-request and session totals
  const handleApiTokens = (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => {
    addApiTokens(usage);      // Add to current request metrics
    addSessionTokens(usage);  // Add to cumulative session stats
  };

  const agentHook = useAgent(
    agent, 
    startRequest,      // Start tracking on new request
    handleApiTokens,   // Add API usage tokens to both request and session totals
    pauseMetrics,      // Pause during approval
    resumeMetrics,     // Resume after approval
    completeRequest    // Complete when agent is done
  );

  const {
    messages,
    userMessageHistory,
    isProcessing,
    currentToolExecution,
    pendingApproval,
    pendingMaxIterations,
    pendingError,
    sessionAutoApprove,
    showReasoning,
    sendMessage,
    approveToolExecution,
    respondToMaxIterations,
    respondToError,
    addMessage,
    setApiKey,
    clearHistory,
    toggleAutoApprove,
    toggleReasoning,
    interruptRequest,
  } = agentHook;

  const { exit } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Handle global keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    if (key.shift && key.tab) {
      toggleAutoApprove();
    }
    if (key.escape) {
      // If waiting for error retry decision, cancel retry
      if (pendingError) {
        handleErrorCancel();
      }
      // If waiting for tool approval, reject the tool
      else if (pendingApproval) {
        handleApproval(false);
      }
      // If model is actively processing (but not waiting for approval or executing tools after approval)
      else if (isProcessing && !currentToolExecution) {
        interruptRequest();
      }
      // If user is typing and nothing else is happening, clear the input
      else if (showInput && inputValue.trim()) {
        setInputValue('');
      }
    }
    
    // Handle error retry keys
    if (pendingError) {
      if (input.toLowerCase() === 'r') {
        handleErrorRetry();
      } else if (input.toLowerCase() === 'c') {
        handleErrorCancel();
      }
    }
  });

  // Hide input when processing, waiting for approval, error retry, or showing login/model selector
  useEffect(() => {
    setShowInput(!isProcessing && !pendingApproval && !pendingError && !showLogin && !showModelSelector);
  }, [isProcessing, pendingApproval, pendingError, showLogin, showModelSelector]);


  const handleSendMessage = async (message: string) => {
    if (message.trim() && !isProcessing) {
      setInputValue('');
      
      // Handle slash commands
      if (message.startsWith('/')) {
        handleSlashCommand(message, {
          addMessage,
          clearHistory: () => {
            clearHistory();
            clearSessionStats();
          },
          setShowLogin,
          setShowModelSelector,
          toggleReasoning,
          showReasoning,
          sessionStats,
        });
        return;
      }
      
      // The agent will handle starting request tracking
      await sendMessage(message);
    }
  };

  const handleApproval = (approved: boolean, autoApproveSession?: boolean) => {
    approveToolExecution(approved, autoApproveSession);
  };

  const handleErrorRetry = () => {
    respondToError(true);
  };

  const handleErrorCancel = () => {
    respondToError(false);
  };

  const handleLogin = (apiKey: string) => {
    setShowLogin(false);
    // Save the API key persistently
    agent.saveApiKey(apiKey);
    addMessage({
      role: 'system',
      content: 'API key saved successfully. You can now start chatting with the assistant.',
    });
  };

  const handleLoginCancel = () => {
    setShowLogin(false);
    addMessage({
      role: 'system',
      content: 'Login canceled.',
    });
  };

  const handleModelSelect = (model: string) => {
    setShowModelSelector(false);
    // Clear chat history and session stats when switching models
    clearHistory();
    clearSessionStats();
    // Set the new model on the agent
    agent.setModel(model);
    addMessage({
      role: 'system',
      content: `Switched to model: ${model}. Chat history has been cleared.`,
    });
  };

  const handleModelCancel = () => {
    setShowModelSelector(false);
    addMessage({
      role: 'system',
      content: 'Model selection canceled.',
    });
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat messages area */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <MessageHistory 
          messages={messages} 
          showReasoning={showReasoning} 
          usageData={{
            prompt_tokens: sessionStats.promptTokens,
            completion_tokens: sessionStats.completionTokens,
            total_tokens: sessionStats.totalTokens,
            total_requests: sessionStats.totalRequests,
            total_time: sessionStats.totalTime,
            queue_time: 0,
            prompt_time: 0,
            completion_time: 0,
          }}
        />
      </Box>

      {/* Token metrics */}
      <TokenMetrics
        isActive={isActive}
        isPaused={isPaused}
        startTime={startTime}
        endTime={endTime}
        pausedTime={pausedTime}
        completionTokens={completionTokens}
      />

      {/* Input area */}
      <Box borderStyle="round" borderColor="white" paddingX={1}>
        {pendingApproval ? (
          <PendingToolApproval
            toolName={pendingApproval.toolName}
            toolArgs={pendingApproval.toolArgs}
            onApprove={() => handleApproval(true, false)}
            onReject={() => handleApproval(false, false)}
            onApproveWithAutoSession={() => handleApproval(true, true)}
          />
        ) : pendingMaxIterations ? (
          <MaxIterationsContinue
            maxIterations={pendingMaxIterations.maxIterations}
            onContinue={() => respondToMaxIterations(true)}
            onStop={() => respondToMaxIterations(false)}
          />
        ) : pendingError ? (
          <ErrorRetry
            error={pendingError.error}
            onRetry={handleErrorRetry}
            onCancel={handleErrorCancel}
          />
        ) : showLogin ? (
          <Login
            onSubmit={handleLogin}
            onCancel={handleLoginCancel}
          />
        ) : showModelSelector ? (
          <ModelSelector
            onSubmit={handleModelSelect}
            onCancel={handleModelCancel}
            currentModel={agent.getCurrentModel?.() || undefined}
          />
        ) : showInput ? (
          <MessageInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSendMessage}
            placeholder="... (Esc to clear, Ctrl+C to exit)"
            userMessageHistory={userMessageHistory}
          />
        ) : (
          <Box>
            <Text color="gray" dimColor>Processing...</Text>
          </Box>
        )}
      </Box>

      <Box justifyContent="space-between" paddingX={1}>
        <Box>
          <Text color="cyan" bold>
            {sessionAutoApprove ? 'auto-approve edits is on' : ''}
          </Text>
        </Box>
        <Box>
          <Text color="gray" dimColor>
            {agent.getCurrentModel?.() || ''}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}