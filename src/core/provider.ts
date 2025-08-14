import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { createCerebras } from '@ai-sdk/cerebras';

export const getAIClient = (provider: string, apiKey: string) => {
  switch (provider) {
    case 'groq':
      return createGroq({ apiKey });
    case 'cerebras':
      return createCerebras({ apiKey });
    case 'openai':
      return createOpenAI({ apiKey });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};
