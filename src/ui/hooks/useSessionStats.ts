import { useState, useCallback } from 'react';

interface ApiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_time?: number;
}

interface SessionStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalRequests: number;
  totalTime: number;
}

export function useSessionStats() {
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalRequests: 0,
    totalTime: 0,
  });

  // Add tokens from an API response to the cumulative session totals
  const addSessionTokens = useCallback((usage: ApiUsage) => {
    setSessionStats(prev => ({
      promptTokens: prev.promptTokens + usage.prompt_tokens,
      completionTokens: prev.completionTokens + usage.completion_tokens,
      totalTokens: prev.totalTokens + usage.total_tokens,
      totalRequests: prev.totalRequests + 1, // Increment request count
      totalTime: prev.totalTime + (usage.total_time || 0), // Accumulate processing time
    }));
  }, []);

  // Clear session stats (called when chat history is cleared)
  const clearSessionStats = useCallback(() => {
    setSessionStats({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      totalTime: 0,
    });
  }, []);

  return {
    sessionStats,
    addSessionTokens,
    clearSessionStats,
  };
}