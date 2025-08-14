import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConfigManager } from '../../../utils/local-settings.js';

interface ModelSelectorProps {
  onSubmit: (model: string) => void;
  onCancel: () => void;
  currentModel?: string;
}

const configManager = new ConfigManager();

const PROVIDERS = [
  { id: 'groq', name: 'Groq', models: [
    { id: 'llama3-8b-8192', name: 'LLaMA3-8b-8192', description: 'Small, fast, and cheap model' },
    { id: 'llama3-70b-8192', name: 'LLaMA3-70b-8192', description: 'Large, fast, and capable model' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral-8x7b-32768', description: 'Large, fast, and capable model' },
  ]},
  { id: 'cerebras', name: 'Cerebras', models: [
    { id: 'btlm-3b-8k-base', name: 'BTLM-3B-8k-base', description: 'Small, fast, and cheap model' },
  ]},
];

export default function ModelSelector({ onSubmit, onCancel, currentModel }: ModelSelectorProps) {
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(() => {
    const providerId = configManager.getProvider() || 'groq';
    return PROVIDERS.findIndex(p => p.id === providerId);
  });
  const [selectedModelIndex, setSelectedModelIndex] = useState(() => {
    const provider = PROVIDERS[selectedProviderIndex];
    return provider.models.findIndex(m => m.id === currentModel) || 0;
  });
  const [isSelectingProvider, setIsSelectingProvider] = useState(true);

  useEffect(() => {
    const provider = PROVIDERS[selectedProviderIndex];
    setSelectedModelIndex(provider.models.findIndex(m => m.id === currentModel) || 0);
  }, [selectedProviderIndex, currentModel]);

  useInput((input, key) => {
    if (key.escape) {
      if (!isSelectingProvider) {
        setIsSelectingProvider(true);
      } else {
        onCancel();
      }
      return;
    }

    if (key.return) {
      if (isSelectingProvider) {
        setIsSelectingProvider(false);
        configManager.setProvider(PROVIDERS[selectedProviderIndex].id);
      } else {
        onSubmit(PROVIDERS[selectedProviderIndex].models[selectedModelIndex].id);
      }
      return;
    }

    if (key.upArrow) {
      if (isSelectingProvider) {
        setSelectedProviderIndex(prev => Math.max(0, prev - 1));
      } else {
        setSelectedModelIndex(prev => Math.max(0, prev - 1));
      }
      return;
    }

    if (key.downArrow) {
      if (isSelectingProvider) {
        setSelectedProviderIndex(prev => Math.min(PROVIDERS.length - 1, prev + 1));
      } else {
        setSelectedModelIndex(prev => Math.min(PROVIDERS[selectedProviderIndex].models.length - 1, prev + 1));
      }
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>{isSelectingProvider ? 'Select Provider' : 'Select Model'}</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          Choose a provider and model for your conversation. The chat will be cleared when you switch.
        </Text>
      </Box>

      {isSelectingProvider ? (
        <ProviderList
          providers={PROVIDERS}
          selectedIndex={selectedProviderIndex}
          currentProviderId={configManager.getProvider()}
        />
      ) : (
        <ModelList
          models={PROVIDERS[selectedProviderIndex].models}
          selectedIndex={selectedModelIndex}
          currentModelId={currentModel}
        />
      )}
    </Box>
  );
}

const ProviderList = ({ providers, selectedIndex, currentProviderId }) => (
  <Box flexDirection="column" marginBottom={1}>
    {providers.map((provider, index) => (
      <Box key={provider.id} marginBottom={index === providers.length - 1 ? 0 : 1}>
        <Text
          color={index === selectedIndex ? 'black' : 'white'}
          backgroundColor={index === selectedIndex ? 'cyan' : undefined}
          bold={index === selectedIndex}
        >
          {index === selectedIndex ? <Text bold>{">"}</Text> : "  "} {""}
          {provider.name}
          {provider.id === currentProviderId ? ' (current)' : ''}
        </Text>
      </Box>
    ))}
  </Box>
);

const ModelList = ({ models, selectedIndex, currentModelId }) => (
  <Box flexDirection="column" marginBottom={1}>
    {models.map((model, index) => (
      <Box key={model.id} marginBottom={index === models.length - 1 ? 0 : 1}>
        <Text
          color={index === selectedIndex ? 'black' : 'white'}
          backgroundColor={index === selectedIndex ? 'cyan' : undefined}
          bold={index === selectedIndex}
        >
          {index === selectedIndex ? <Text bold>{">"}</Text> : "  "} {""}
          {model.name}
          {model.id === currentModelId ? ' (current)' : ''}
        </Text>
        {index === selectedIndex && (
          <Box marginLeft={4} marginTop={0}>
            <Text color="gray" dimColor>
              {model.description}
            </Text>
          </Box>
        )}
      </Box>
    ))}
  </Box>
);