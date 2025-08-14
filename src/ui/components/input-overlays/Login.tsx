import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConfigManager } from '../../../utils/local-settings.js';

interface LoginProps {
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
}

const configManager = new ConfigManager();

export default function Login({ onSubmit, onCancel }: LoginProps) {
  const [apiKey, setApiKey] = useState('');
  const provider = configManager.getProvider() || 'groq';

  useInput((input, key) => {
    if (key.return) {
      if (apiKey.trim()) {
        onSubmit(apiKey.trim());
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.backspace || key.delete) {
      setApiKey(prev => prev.slice(0, -1));
      return;
    }

    if (key.ctrl && input === 'c') {
      onCancel();
      return;
    }

    // Regular character input
    if (input && !key.meta && !key.ctrl) {
      setApiKey(prev => prev + input);
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>Login with {provider} API Key</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color="gray">
          Enter your {provider} API key to continue.
        </Text>
      </Box>

      <Box>
        <Text color="cyan">API Key: </Text>
        <Text>
          {'*'.repeat(Math.min(apiKey.length, 20))}
          {apiKey.length > 20 && '...'}
        </Text>
        <Text backgroundColor="cyan" color="cyan">▌</Text>
      </Box>
    </Box>
  );
}