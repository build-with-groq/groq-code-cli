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
    { id: 'qwen-3-coder-480b', name: 'Qwen3 Coder', description: 'Most capable model' },
  ]},
  { id: 'openrouter', name: 'OpenRouter', models: [
    { id: 'ai21/jamba-1.5-large', name: 'Jamba-1.5 Large', description: 'Mixture of experts model with 32K context window' },
    { id: 'ai21/jamba-1.5-mini', name: 'Jamba-1.5 Mini', description: 'Smaller, faster version of Jamba with 256K context window' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Most intelligent model, excels at coding, complex tasks' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fastest and most compact model for near-instant responses' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'LLaMA 3.1 8B', description: 'Balanced model with good performance' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'LLaMA 3.1 70B', description: 'Large, fast, and capable model' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'LLaMA 3.1 405B', description: 'Meta\'s most capable model' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', description: 'Alibaba\'s latest coding-focused model' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Alibaba\'s latest large language model' },
    { id: 'qwen/qwen3-coder:nitro', name: 'Qwen 3 Coder (Cerebras)', description: 'Alibaba\'s best coding model' },
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

interface ProviderListProps {
  providers: typeof PROVIDERS;
  selectedIndex: number;
  currentProviderId: string | null;
}

const ProviderList: React.FC<ProviderListProps> = ({ providers, selectedIndex, currentProviderId }) => (
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

interface ModelListProps {
  models: typeof PROVIDERS[0]['models'];
  selectedIndex: number;
  currentModelId?: string;
}

const ModelList: React.FC<ModelListProps> = ({ models, selectedIndex, currentModelId }) => (
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