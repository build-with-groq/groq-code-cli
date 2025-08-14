import Groq from 'groq-sdk';

export const getAIClient = (provider: string, apiKey: string) => {
  switch (provider) {
    case 'groq':
      // Use the Groq SDK directly for the expected API interface
      return new Groq({ apiKey });
    case 'cerebras':
      // Create a wrapper for Cerebras that mimics the Groq SDK interface
      return {
        chat: {
          completions: {
            create: async (params: any, options?: any) => {
              // Make a direct HTTP request to Cerebras API
              const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
                signal: options?.signal,
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(`Cerebras API error: ${JSON.stringify(error)}`);
              }
              
              return await response.json();
            }
          }
        }
      };
    case 'openai':
      // Create a wrapper for OpenAI that mimics the Groq SDK interface
      return {
        chat: {
          completions: {
            create: async (params: any, options?: any) => {
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
                signal: options?.signal,
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
              }
              
              return await response.json();
            }
          }
        }
      };
    case 'openrouter':
      // Create a wrapper for OpenRouter that mimics the Groq SDK interface
      return {
        chat: {
          completions: {
            create: async (params: any, options?: any) => {
              const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://github.com/user/groq-code-cli', // Optional but recommended
                  'X-Title': 'Groq Code CLI', // Optional but recommended
                },
                body: JSON.stringify(params),
                signal: options?.signal,
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
              }
              
              return await response.json();
            }
          }
        }
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};
