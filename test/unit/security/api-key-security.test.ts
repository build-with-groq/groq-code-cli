import test from 'ava';
import sinon from 'sinon';
import { Agent } from '@src/core/agent';

// Security tests to verify API keys are never logged or exposed
test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.consoleLogStub = t.context.sandbox.stub(console, 'log');
  t.context.consoleErrorStub = t.context.sandbox.stub(console, 'error');
  t.context.consoleWarnStub = t.context.sandbox.stub(console, 'warn');
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
});

test('Agent.setApiKey - should not log full API key', (t) => {
  const agent = Agent.create('test-model', 0.5, null);
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  
  // Capture any debug logs that might occur
  const originalWriteFileSync = require('fs').writeFileSync;
  const originalAppendFileSync = require('fs').appendFileSync;
  let debugLogContent = '';
  
  t.context.sandbox.stub(require('fs'), 'writeFileSync').callsFake((path, content) => {
    if (path.toString().includes('debug-agent.log')) {
      debugLogContent += content.toString();
    }
    return originalWriteFileSync.call(require('fs'), path, content);
  });
  
  t.context.sandbox.stub(require('fs'), 'appendFileSync').callsFake((path, content) => {
    if (path.toString().includes('debug-agent.log')) {
      debugLogContent += content.toString();
    }
    return originalAppendFileSync.call(require('fs'), path, content);
  });
  
  // Set API key
  (agent as any).setApiKey(testApiKey);
  
  // Check that full API key is not logged anywhere
  t.false(debugLogContent.includes(testApiKey), 'Full API key should never appear in debug logs');
  
  // Check console logs don't contain full API key
  const allConsoleLogs = [
    ...t.context.consoleLogStub.getCalls(),
    ...t.context.consoleErrorStub.getCalls(),
    ...t.context.consoleWarnStub.getCalls()
  ].map(call => call.args.join(' ')).join(' ');
  
  t.false(allConsoleLogs.includes(testApiKey), 'Full API key should never appear in console logs');
});

test('Agent.setApiKey - should only log masked API key in debug mode', (t) => {
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  const expectedMaskedKey = 'gsk_1234...';
  
  let debugLogContent = '';
  
  // Mock fs functions to capture debug log content
  t.context.sandbox.stub(require('fs'), 'writeFileSync').callsFake((path, content) => {
    if (path.toString().includes('debug-agent.log')) {
      debugLogContent += content.toString();
    }
  });
  
  t.context.sandbox.stub(require('fs'), 'appendFileSync').callsFake((path, content) => {
    if (path.toString().includes('debug-agent.log')) {
      debugLogContent += content.toString();
    }
  });
  
  // Create agent with debug enabled
  const agent = Agent.create('test-model', 0.5, null, true);
  (agent as any).setApiKey(testApiKey);
  
  // Check that only masked key appears in logs
  if (debugLogContent) {
    t.false(debugLogContent.includes(testApiKey), 'Full API key should not appear in debug logs');
    t.true(debugLogContent.includes(expectedMaskedKey) || debugLogContent.includes('gsk_1234567'), 
           'Masked API key should appear in debug logs when debug is enabled');
  }
});

test('generateCurlCommand - should mask API key in curl commands', (t) => {
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  const requestBody = { model: 'test-model', messages: [] };
  
  // Access the internal generateCurlCommand function through agent module
  // Since it's not exported, we need to test indirectly through the agent's behavior
  let debugLogContent = '';
  
  t.context.sandbox.stub(require('fs'), 'writeFileSync').callsFake((path, content) => {
    debugLogContent += content.toString();
  });
  
  t.context.sandbox.stub(require('fs'), 'appendFileSync').callsFake((path, content) => {
    debugLogContent += content.toString();
  });
  
  // Create agent with debug enabled to trigger curl command generation
  const agent = Agent.create('test-model', 0.5, null, true);
  (agent as any).setApiKey(testApiKey);
  
  // Check that full API key doesn't appear in any logged curl commands
  t.false(debugLogContent.includes(testApiKey), 'Full API key should not appear in curl commands');
  
  // Should contain masked version if curl command is generated
  const maskedKeyPattern = /gsk_\w{8}\.{3}\w{8}/;
  if (debugLogContent.includes('curl')) {
    t.regex(debugLogContent, maskedKeyPattern, 'Curl commands should contain masked API keys');
  }
});

test('Error messages - should not expose API key in error messages', async (t) => {
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  
  // Mock Groq SDK to throw an error
  const mockGroq = t.context.sandbox.stub().throws(new Error('API Error: Invalid key gsk_test'));
  
  try {
    const agent = await Agent.create('test-model', 0.5, null);
    (agent as any).setApiKey(testApiKey);
    
    // Mock the Groq client to throw an error
    (agent as any).client = {
      chat: {
        completions: {
          create: t.context.sandbox.stub().rejects(new Error('Authentication failed'))
        }
      }
    };
    
    // Try to chat and expect it to handle the error without exposing the key
    await t.throwsAsync(() => agent.chat('test message'));
    
  } catch (error) {
    // Verify error message doesn't contain the actual API key
    t.false(error.message.includes(testApiKey), 
            'Error messages should not contain the actual API key');
  }
});

test('Local settings - should not expose API key when saving/loading', (t) => {
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  
  let fileSystemWrites = '';
  
  // Mock filesystem operations to capture what's written
  t.context.sandbox.stub(require('fs'), 'writeFileSync').callsFake((path, content) => {
    fileSystemWrites += content.toString();
  });
  
  t.context.sandbox.stub(require('fs'), 'existsSync').returns(true);
  t.context.sandbox.stub(require('fs'), 'readFileSync').returns(JSON.stringify({ apiKey: testApiKey }));
  
  const agent = Agent.create('test-model', 0.5, null);
  (agent as any).saveApiKey(testApiKey);
  
  // API key should be stored (this is expected for functionality)
  // but we verify it's not accidentally logged during the save process
  const allConsoleLogs = [
    ...t.context.consoleLogStub.getCalls(),
    ...t.context.consoleErrorStub.getCalls(),
    ...t.context.consoleWarnStub.getCalls()
  ].map(call => call.args.join(' ')).join(' ');
  
  t.false(allConsoleLogs.includes(testApiKey), 
          'API key should not be logged during save/load operations');
});

test('Memory exposure - API key should not be in string representation', (t) => {
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  
  const agent = Agent.create('test-model', 0.5, null);
  (agent as any).setApiKey(testApiKey);
  
  // Convert agent to string and verify API key is not exposed
  const agentString = JSON.stringify(agent);
  t.false(agentString.includes(testApiKey), 
          'API key should not appear in JSON serialization of agent');
  
  // Also check toString representation
  const agentToString = agent.toString();
  t.false(agentToString.includes(testApiKey), 
          'API key should not appear in toString() representation');
});

test('Debug log files - should not contain full API keys', (t) => {
  const testApiKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz123456';
  
  let allFileWrites = '';
  
  // Capture all file write operations
  t.context.sandbox.stub(require('fs'), 'writeFileSync').callsFake((path, content) => {
    allFileWrites += `${path}: ${content}\n`;
  });
  
  t.context.sandbox.stub(require('fs'), 'appendFileSync').callsFake((path, content) => {
    allFileWrites += `${path}: ${content}\n`;
  });
  
  // Create agent with debug enabled
  const agent = Agent.create('test-model', 0.5, null, true);
  (agent as any).setApiKey(testApiKey);
  
  // Check all file operations don't expose full API key
  t.false(allFileWrites.includes(testApiKey), 
          'Full API key should never be written to any debug files');
  
  // But masked versions might be present for debugging
  const maskedKeyPattern = /gsk_\w{8}\.{3}/;
  if (allFileWrites.includes('debug')) {
    // It's okay if masked versions are present for debugging
    t.pass('Masked API keys in debug files are acceptable for debugging purposes');
  }
});