import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConfigManager } from '../../utils/local-settings.js';

interface ModelSelectorProps {
  agent: any;
  onModelSelect: (provider: string, model: string) => void;
  onClose: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ agent, onModelSelect, onClose }) => {
  const [providerIndex, setProviderIndex] = useState<number>(0);
  const [modelIndex, setModelIndex] = useState<number>(0);
  const [isSelectingProvider, setIsSelectingProvider] = useState<boolean>(true);

  // Common models for each provider
  const providerModels = {
    groq: [
      'llama3-8b-8192',
      'llama3-70b-8192',
      'mixtral-8x7b-32768',
      'gemma-7b-it',
      'gemma2-9b-it',
    ],
    cerebras: [
      'llama3.1-8b',
      'llama3.1-70b',
    ],
    openai: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'gpt-4o',
      'gpt-4o-mini',
    ],
    openrouter: [
      'openrouter/auto', // Auto-selects best model
      'openrouter/ai21/jamba-1.5-large', // Mixture of experts model with 32K context window
      'openrouter/ai21/jamba-1.5-mini', // Smaller, faster version of Jamba with 256K context window
      'openrouter/anthropic/claude-3.5-sonnet', // Most intelligent model, excels at coding, complex tasks
      'openrouter/anthropic/claude-3-haiku', // Fastest and most compact model for near-instant responses
      'openrouter/meta-llama/llama-3.1-8b-instruct', // Balanced model with good performance
      'openrouter/meta-llama/llama-3.1-70b-instruct', // Large, fast, and capable model
      'openrouter/meta-llama/llama-3.1-405b-instruct', // Meta's most capable model
      'openrouter/qwen/qwen-3-72b-instruct', // Alibaba's latest large language model
      'openrouter/qwen/qwen-3-coder-480b', // Alibaba's latest coding-focused model
    ],
  };

  const providers = ['groq', 'cerebras', 'openai', 'openrouter'];

  useEffect(() => {
    const configManager = new ConfigManager();
    const savedProvider = configManager.getProvider();
    const savedModel = configManager.getDefaultModel();
    
    if (savedProvider) {
      const providerIdx = providers.findIndex(p => p === savedProvider);
      if (providerIdx !== -1) {
        setProviderIndex(providerIdx);
        setIsSelectingProvider(false);
      }
    }
    
    if (savedModel) {
      const models = providerModels[providers[providerIndex] as keyof typeof providerModels] || [];
      const modelIdx = models.findIndex(m => m === savedModel);
      if (modelIdx !== -1) {
        setModelIndex(modelIdx);
      }
    }
  }, [providerIndex]);

  useInput((input, key) => {
    // Handle escape key
    if (key.escape) {
      onClose();
      return;
    }

    // Handle return/enter key
    if (key.return) {
      if (isSelectingProvider) {
        setIsSelectingProvider(false);
      } else {
        const selectedProvider = providers[providerIndex];
        const models = providerModels[selectedProvider as keyof typeof providerModels] || [];
        const selectedModel = models[modelIndex];
        if (selectedProvider && selectedModel) {
          onModelSelect(selectedProvider, selectedModel);
          onClose();
        }
      }
      return;
    }

    // Handle up arrow
    if (key.upArrow) {
      if (isSelectingProvider) {
        setProviderIndex(prev => Math.max(0, prev - 1));
      } else {
        const models = providerModels[providers[providerIndex] as keyof typeof providerModels] || [];
        setModelIndex(prev => Math.max(0, prev - 1));
      }
      return;
    }

    // Handle down arrow
    if (key.downArrow) {
      if (isSelectingProvider) {
        setProviderIndex(prev => Math.min(providers.length - 1, prev + 1));
      } else {
        const models = providerModels[providers[providerIndex] as keyof typeof providerModels] || [];
        setModelIndex(prev => Math.min(models.length - 1, prev + 1));
      }
      return;
    }
  });

  const selectedProvider = providers[providerIndex];
  const models = providerModels[selectedProvider as keyof typeof providerModels] || [];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Select AI Provider and Model</Text>
      
      <Box marginTop={1} flexDirection="column">
        <Text>Provider:</Text>
        {providers.map((provider, index) => (
          <Box key={provider} marginTop={index === 0 ? 1 : 0}>
            <Text
              color={index === providerIndex ? 'black' : 'white'}
              backgroundColor={index === providerIndex ? 'cyan' : undefined}
              bold={index === providerIndex}
            >
              {index === providerIndex ? <Text bold>{">"}</Text> : "  "} {provider}
            </Text>
          </Box>
        ))}
      </Box>
      
      {!isSelectingProvider && (
        <Box marginTop={1} flexDirection="column">
          <Text>Model:</Text>
          {models.map((model, index) => (
            <Box key={model} marginTop={index === 0 ? 1 : 0}>
              <Text
                color={index === modelIndex ? 'black' : 'white'}
                backgroundColor={index === modelIndex ? 'cyan' : undefined}
                bold={index === modelIndex}
              >
                {index === modelIndex ? <Text bold>{">"}</Text> : "  "} {model}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text>
          {isSelectingProvider 
            ? "Press Enter to select this provider" 
            : (selectedProvider && models[modelIndex] 
                ? `Press Enter to confirm selection: ${selectedProvider}/${models[modelIndex]}` 
                : "Select both provider and model to continue")}
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text>Press ESC to cancel</Text>
      </Box>
    </Box>
  );
};

export default ModelSelector;