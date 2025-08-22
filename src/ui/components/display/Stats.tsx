import { Box, Text } from 'ink';

interface Usage {
  queue_time: number;
  prompt_tokens: number;
  prompt_time: number;
  completion_tokens: number;
  completion_time: number;
  total_tokens: number;
  total_requests?: number;
  total_time: number;
  prompt_tokens_details?: {
    cached_tokens: number;
  };
}

interface StatsProps {
  usage?: Usage;
}

export default function Stats({ usage }: StatsProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
    }
  };

  // Extract values from API response
  const cachedTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
  const promptTokens = usage?.prompt_tokens || 0;
  const cachedPercent = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : 0;

  const stats = {
    totalRequests: usage?.total_requests || 0,
    processingTime: formatTime(usage?.total_time || 0),
    promptTokens: promptTokens,
    completionTokens: usage?.completion_tokens || 0,
    cachedTokens,
    cachedPercent,
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>📊 Session Stats</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Box justifyContent="flex-start" marginBottom={1} borderStyle="single" borderColor="gray" borderTop={false} borderLeft={false} borderRight={false} paddingBottom={0}>
          <Text color="gray">Performance</Text>
        </Box>
        <Box flexDirection="row" justifyContent="center" gap={4}>
          <Box flexDirection="column" alignItems="center" paddingX={3}>
            <Text color="blue" bold>{stats.totalRequests}</Text>
            <Text color="gray" dimColor>Requests</Text>
          </Box>
          <Box flexDirection="column" alignItems="center" paddingX={3}>
            <Text color="yellow" bold>{stats.processingTime}</Text>
            <Text color="gray" dimColor>Response Time</Text>
          </Box>
        </Box>
      </Box>
      
      <Box flexDirection="column">
        <Box justifyContent="flex-start" marginBottom={1} borderStyle="single" borderColor="gray" borderTop={false} borderLeft={false} borderRight={false} paddingBottom={0}>
          <Text color="gray">Token Usage</Text>
        </Box>
        <Box flexDirection="row" justifyContent="center" gap={4}>
          <Box flexDirection="column" alignItems="center" paddingX={3}>
            <Text color="cyan" bold>{stats.promptTokens.toLocaleString()}</Text>
            <Text color="gray" dimColor>Input Tokens</Text>
          </Box>
          <Box flexDirection="column" alignItems="center" paddingX={3}>
            <Text color="green" bold>{stats.completionTokens.toLocaleString()}</Text>
            <Text color="gray" dimColor>Output Tokens</Text>
          </Box>
          {usage?.prompt_tokens_details && (
            <Box flexDirection="column" alignItems="center" paddingX={3}>
              <Text color="magenta" bold>{stats.cachedTokens.toLocaleString()} ({stats.cachedPercent}%)</Text>
              <Text color="gray" dimColor>Cached</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}