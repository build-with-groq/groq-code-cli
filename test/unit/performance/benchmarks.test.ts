import test from 'ava';
import sinon from 'sinon';
import { performance } from 'perf_hooks';
import { Agent } from '@src/core/agent';
import { ConfigManager } from '@src/utils/local-settings';
import { executeTool } from '@src/tools/tools';

// Performance benchmark tests for critical paths
test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
});

test('Agent creation - should complete within performance threshold', async (t) => {
  const startTime = performance.now();
  
  const agent = await Agent.create('test-model', 0.5, null);
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  // Agent creation should complete within 100ms
  t.true(executionTime < 100, `Agent creation took ${executionTime}ms, should be under 100ms`);
  t.true(agent instanceof Agent);
});

test('ConfigManager initialization - should be fast', (t) => {
  const iterations = 100;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    new ConfigManager();
  }
  
  const endTime = performance.now();
  const averageTime = (endTime - startTime) / iterations;
  
  // Each ConfigManager creation should average under 1ms
  t.true(averageTime < 1, `ConfigManager init averaged ${averageTime}ms, should be under 1ms`);
});

test('API key setting - should be immediate', (t) => {
  const agent = Agent.create('test-model', 0.5, null);
  const testApiKey = 'gsk_test1234567890abcdefghij';
  
  const startTime = performance.now();
  
  (agent as any).setApiKey(testApiKey);
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  // API key setting should be nearly instantaneous (under 10ms)
  t.true(executionTime < 10, `API key setting took ${executionTime}ms, should be under 10ms`);
});

test('Model switching - should be fast', (t) => {
  const agent = Agent.create('initial-model', 0.5, null);
  
  const startTime = performance.now();
  
  (agent as any).setModel('new-model');
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  // Model switching should complete quickly (under 50ms)
  t.true(executionTime < 50, `Model switching took ${executionTime}ms, should be under 50ms`);
  t.is((agent as any).getCurrentModel(), 'new-model');
});

test('Message history operations - should scale well', (t) => {
  const agent = Agent.create('test-model', 0.5, null);
  
  // Add many messages to test scaling
  const messageCount = 1000;
  for (let i = 0; i < messageCount; i++) {
    (agent as any).messages.push({
      role: 'user',
      content: `Test message ${i}`
    });
  }
  
  const startTime = performance.now();
  
  (agent as any).clearHistory();
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  // History clearing should be fast even with many messages (under 50ms)
  t.true(executionTime < 50, `History clearing took ${executionTime}ms with ${messageCount} messages, should be under 50ms`);
  
  // Should only have system messages left
  const remainingMessages = (agent as any).messages.filter(msg => msg.role === 'system');
  t.true(remainingMessages.length <= 2, 'Only system messages should remain after clearing history');
});

test('Tool execution setup - should be efficient', (t) => {
  const toolName = 'read_file';
  const toolArgs = { file_path: '/test/path.txt' };
  
  // Mock file system to avoid actual I/O
  t.context.sandbox.stub(require('fs'), 'existsSync').returns(true);
  t.context.sandbox.stub(require('fs'), 'readFileSync').returns('test content');
  t.context.sandbox.stub(require('fs'), 'statSync').returns({ isDirectory: () => false });
  
  const iterations = 50;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    // Test the setup overhead, not actual execution
    const mockToolCall = {
      id: `test-${i}`,
      function: {
        name: toolName,
        arguments: JSON.stringify(toolArgs)
      }
    };
    
    // Just test argument parsing performance
    const parsedArgs = JSON.parse(mockToolCall.function.arguments);
    t.is(parsedArgs.file_path, '/test/path.txt');
  }
  
  const endTime = performance.now();
  const averageTime = (endTime - startTime) / iterations;
  
  // Tool call setup should average under 1ms per call
  t.true(averageTime < 1, `Tool setup averaged ${averageTime}ms, should be under 1ms`);
});

test('Memory usage - Agent should not leak memory', async (t) => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Create many agents and let them be garbage collected
  for (let i = 0; i < 100; i++) {
    const agent = await Agent.create(`test-model-${i}`, 0.5, null);
    (agent as any).setApiKey('test-key');
    (agent as any).clearHistory();
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
  
  // Memory increase should be reasonable (under 50MB for 100 agents)
  t.true(memoryIncrease < 50, `Memory increased by ${memoryIncrease}MB, should be under 50MB`);
});

test('Large message handling - should remain performant', (t) => {
  const agent = Agent.create('test-model', 0.5, null);
  
  // Create a large message (1MB of text)
  const largeContent = 'A'.repeat(1024 * 1024);
  
  const startTime = performance.now();
  
  (agent as any).messages.push({
    role: 'user',
    content: largeContent
  });
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  // Adding large messages should still be fast (under 100ms)
  t.true(executionTime < 100, `Large message handling took ${executionTime}ms, should be under 100ms`);
});

test('Concurrent agent operations - should not block', async (t) => {
  const concurrentCount = 10;
  const startTime = performance.now();
  
  // Create multiple agents concurrently
  const agentPromises = Array.from({ length: concurrentCount }, (_, i) => 
    Agent.create(`concurrent-model-${i}`, 0.5, null)
  );
  
  const agents = await Promise.all(agentPromises);
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  const averageTime = executionTime / concurrentCount;
  
  // Concurrent creation shouldn't be much slower than sequential
  t.true(averageTime < 200, `Concurrent agent creation averaged ${averageTime}ms, should be under 200ms`);
  t.is(agents.length, concurrentCount);
  
  // All agents should be properly initialized
  agents.forEach((agent, index) => {
    t.true(agent instanceof Agent);
    t.is((agent as any).getCurrentModel(), `concurrent-model-${index}`);
  });
});

test('System message generation - should be optimized', (t) => {
  const iterations = 100;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const agent = Agent.create(`model-${i}`, 0.5, null);
    // System message is generated during creation
    const systemMessage = (agent as any).systemMessage;
    t.true(typeof systemMessage === 'string');
    t.true(systemMessage.length > 0);
  }
  
  const endTime = performance.now();
  const averageTime = (endTime - startTime) / iterations;
  
  // System message generation should be fast (under 5ms average)
  t.true(averageTime < 5, `System message generation averaged ${averageTime}ms, should be under 5ms`);
});

test('Benchmark report - critical path performance summary', async (t) => {
  const benchmarks = {};
  
  // Agent creation benchmark
  const agentStartTime = performance.now();
  const testAgent = await Agent.create('benchmark-model', 0.5, null);
  benchmarks['Agent Creation'] = `${(performance.now() - agentStartTime).toFixed(2)}ms`;
  
  // API key setting benchmark
  const keyStartTime = performance.now();
  (testAgent as any).setApiKey('test-key');
  benchmarks['API Key Setting'] = `${(performance.now() - keyStartTime).toFixed(2)}ms`;
  
  // Model switching benchmark
  const modelStartTime = performance.now();
  (testAgent as any).setModel('new-benchmark-model');
  benchmarks['Model Switching'] = `${(performance.now() - modelStartTime).toFixed(2)}ms`;
  
  // History clearing benchmark
  for (let i = 0; i < 100; i++) {
    (testAgent as any).messages.push({ role: 'user', content: `msg ${i}` });
  }
  const historyStartTime = performance.now();
  (testAgent as any).clearHistory();
  benchmarks['History Clear (100 msgs)'] = `${(performance.now() - historyStartTime).toFixed(2)}ms`;
  
  // ConfigManager benchmark
  const configStartTime = performance.now();
  new ConfigManager();
  benchmarks['ConfigManager Init'] = `${(performance.now() - configStartTime).toFixed(2)}ms`;
  
  // Log benchmark results for reference
  console.log('\n=== Performance Benchmark Results ===');
  Object.entries(benchmarks).forEach(([operation, time]) => {
    console.log(`${operation}: ${time}`);
  });
  console.log('=====================================\n');
  
  t.pass('Benchmark report generated successfully');
});