// Test script to verify Cerebras integration
import { getAIClient } from './dist/core/provider.js';
import { ConfigManager } from './dist/utils/local-settings.js';

async function testCerebras() {
  console.log('Testing Cerebras integration...');
  
  const configManager = new ConfigManager();
  const apiKey = configManager.getApiKey('cerebras');
  
  if (!apiKey) {
    console.error('No Cerebras API key found. Please set it using the CLI.');
    return;
  }
  
  console.log('API key found:', apiKey.substring(0, 8) + '...');
  
  try {
    const client = getAIClient('cerebras', apiKey);
    console.log('Client created successfully');
    console.log('Client structure:', Object.keys(client));
    console.log('Client.chat:', Object.keys(client.chat));
    console.log('Client.chat.completions:', Object.keys(client.chat.completions));
    
    console.log('\nTesting API call...');
    const response = await client.chat.completions.create({
      model: 'llama3.1-8b',  // Using a simpler model for testing
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one word.' }
      ],
      temperature: 0.7,
      max_tokens: 10,
      stream: false
    });
    
    console.log('Response received!');
    console.log('Response content:', response.choices[0].message.content);
    console.log('Model used:', response.model);
    console.log('Finish reason:', response.choices[0].finish_reason);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testCerebras();
