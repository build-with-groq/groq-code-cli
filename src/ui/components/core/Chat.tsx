import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Agent } from '../../../core/agent.js';
import { useAgent } from '../../hooks/useAgent.js';
import { useTokenMetrics } from '../../hooks/useTokenMetrics.js';
import MessageHistory from './MessageHistory.js';
import MessageInput from './MessageInput.js';
import TokenMetrics from '../display/TokenMetrics.js';
import PendingToolApproval from '../input-overlays/PendingToolApproval.js';
import Login from '../input-overlays/Login.js';
import ModelSelector from '../input-overlays/ModelSelector.js';
import MaxIterationsContinue from '../input-overlays/MaxIterationsContinue.js';
import { handleSlashCommand } from '../../../commands/index.js';
import { ConfigManager } from '../../../utils/local-settings.js';

interface ChatProps {
  agent: Agent;
}

const configManager = new ConfigManager();

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

  const agentHook = useAgent(
    agent, 
    startRequest,      // Start tracking on new request
    addApiTokens,      // Add API usage tokens throughout the request
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
      // If waiting for tool approval, reject the tool
      if (pendingApproval) {
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
  });

  // Hide input when processing, waiting for approval, or showing login/model selector
  useEffect(() => {
    setShowInput(!isProcessing && !pendingApproval && !showLogin && !showModelSelector);
  }, [isProcessing, pendingApproval, showLogin, showModelSelector]);


  const handleSendMessage = async (message: string) => {
    if (message.trim() && !isProcessing) {
      setInputValue('');
      
      // Handle slash commands
      if (message.startsWith('/')) {
        handleSlashCommand(message, {
          addMessage,
          clearHistory,
          setShowLogin,
          setShowModelSelector,
          toggleReasoning,
          showReasoning,
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

  const handleLogin = (apiKey: string) => {
    setShowLogin(false);
    const provider = configManager.getProvider() || 'groq';
    // Save the API key persistently
    agent.saveApiKey(provider, apiKey);
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
    // Clear chat history when switching models
    clearHistory();
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
        <MessageHistory messages={messages} showReasoning={showReasoning} />
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