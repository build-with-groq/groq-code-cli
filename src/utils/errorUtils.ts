export interface ParsedApiError {
  type: 'rate_limit' | 'token_limit' | 'auth' | 'network' | 'unknown';
  message: string;
  details?: {
    code?: string;
    param?: string;
    retryAfter?: number;
    suggestions?: string[];
  };
}

export function parseApiError(error: any): ParsedApiError {
  // Check if it's an abort error
  if (error?.message?.includes('aborted') || error?.name === 'AbortError') {
    return {
      type: 'unknown',
      message: 'Request was interrupted',
    };
  }

  // Parse Cerebras/Groq API errors
  if (error?.message?.includes('API error:')) {
    try {
      // Extract JSON from error message
      const jsonMatch = error.message.match(/\{.*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        
        // Handle rate limit errors
        if (errorData.code === 'request_quota_exceeded' || 
            errorData.type === 'too_many_requests_error') {
          const isTokenLimit = errorData.code === 'token_quota_exceeded';
          return {
            type: isTokenLimit ? 'token_limit' : 'rate_limit',
            message: errorData.message || 'Rate limit exceeded',
            details: {
              code: errorData.code,
              param: errorData.param,
              suggestions: isTokenLimit ? [
                'You have exceeded your hourly token quota',
                'Wait until the next hour for the quota to reset',
                'Consider switching to a different model with /model',
                'Or switch to a different API provider if available'
              ] : [
                'Too many requests sent in a short time',
                'Wait a few seconds before trying again',
                'The system will automatically retry with backoff'
              ]
            }
          };
        }

        // Handle authentication errors
        if (errorData.code === 'invalid_api_key' || 
            errorData.type === 'authentication_error') {
          return {
            type: 'auth',
            message: errorData.message || 'Authentication failed',
            details: {
              code: errorData.code,
              suggestions: [
                'Your API key may be invalid or expired',
                'Use /login to set a new API key',
                'Check that your API key has the correct permissions'
              ]
            }
          };
        }

        // Generic API error
        return {
          type: 'unknown',
          message: errorData.message || error.message,
          details: {
            code: errorData.code,
            param: errorData.param
          }
        };
      }
    } catch (parseError) {
      // If we can't parse the JSON, fall through to default handling
    }
  }

  // Network errors
  if (error?.message?.includes('fetch') || 
      error?.message?.includes('network') ||
      error?.message?.includes('ECONNREFUSED')) {
    return {
      type: 'network',
      message: 'Network connection error',
      details: {
        suggestions: [
          'Check your internet connection',
          'The API server may be temporarily unavailable',
          'Try again in a few moments'
        ]
      }
    };
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: error?.message || 'An unexpected error occurred',
    details: {}
  };
}

export function formatErrorForDisplay(parsedError: ParsedApiError): string {
  let display = `❌ ${parsedError.message}`;
  
  if (parsedError.details?.code) {
    display += ` (${parsedError.details.code})`;
  }
  
  if (parsedError.details?.suggestions && parsedError.details.suggestions.length > 0) {
    display += '\n\n💡 Suggestions:';
    parsedError.details.suggestions.forEach(suggestion => {
      display += `\n  • ${suggestion}`;
    });
  }
  
  return display;
}

export function shouldRetryError(parsedError: ParsedApiError): boolean {
  // Don't retry auth errors or token limit errors
  if (parsedError.type === 'auth' || parsedError.type === 'token_limit') {
    return false;
  }
  
  // Retry rate limits and network errors
  if (parsedError.type === 'rate_limit' || parsedError.type === 'network') {
    return true;
  }
  
  return false;
}

export function getRetryDelay(attemptNumber: number, parsedError: ParsedApiError): number {
  // Base delay in milliseconds
  let baseDelay = 1000;
  
  if (parsedError.type === 'rate_limit') {
    // Longer delay for rate limits
    baseDelay = 2000;
  }
  
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), 30000); // Max 30 seconds
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 500;
  
  return delay + jitter;
}
