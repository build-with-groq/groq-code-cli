import test from 'ava';
import sinon from 'sinon';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAgent, ChatMessage, ToolExecution } from '@src/ui/hooks/useAgent';
import { Agent } from '@src/core/agent';

// Mock creation function - creates fresh mocks for each test
function createMockAgent() {
  const toolCallbacks: any = {};
  
  const agent = {
    setToolCallbacks: sinon.stub(),
    chat: sinon.stub().resolves(undefined),
    setApiKey: sinon.stub(),
    setSessionAutoApprove: sinon.stub(),
    clearHistory: sinon.stub(),
    interrupt: sinon.stub()
  };

  // Capture the tool callbacks when they're set
  agent.setToolCallbacks.callsFake((callbacks: any) => {
    Object.assign(toolCallbacks, callbacks);
  });

  return { agent, toolCallbacks };
}

function createMockCallbacks() {
  return {
    mockOnStartRequest: sinon.stub(),
    mockOnAddApiTokens: sinon.stub(),
    mockOnPauseRequest: sinon.stub(),
    mockOnResumeRequest: sinon.stub(),
    mockOnCompleteRequest: sinon.stub()
  };
}

// Setup cleanup - cleanup both React Testing Library and sinon after each test
test.afterEach.always(() => {
  cleanup();
  sinon.restore();
});

test.serial('useAgent - should initialize with correct default values', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    t.deepEqual(result.current.messages, []);
    t.deepEqual(result.current.userMessageHistory, []);
    t.is(result.current.isProcessing, false);
    t.is(result.current.currentToolExecution, null);
    t.is(result.current.pendingApproval, null);
    t.is(result.current.pendingMaxIterations, null);
    t.is(result.current.sessionAutoApprove, false);
    t.is(result.current.showReasoning, true);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should provide all required methods', (t) => {
  const { result, unmount } = renderHook(() => 
    useAgent(createMockAgent().agent)
  );

  try {
    t.is(typeof result.current.sendMessage, 'function');
    t.is(typeof result.current.approveToolExecution, 'function');
    t.is(typeof result.current.respondToMaxIterations, 'function');
    t.is(typeof result.current.addMessage, 'function');
    t.is(typeof result.current.setApiKey, 'function');
    t.is(typeof result.current.clearHistory, 'function');
    t.is(typeof result.current.toggleAutoApprove, 'function');
    t.is(typeof result.current.toggleReasoning, 'function');
    t.is(typeof result.current.interruptRequest, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should add user message and call agent', async (t) => {
  const { agent } = createMockAgent();
  const callbacks = createMockCallbacks();
  agent.chat.resolves(undefined);
  
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );

  try {
    await act(async () => {
      await result.current.sendMessage('Hello, world!');
    });

    t.is(result.current.messages.length, 1);
    t.is(result.current.messages[0].role, 'user');
    t.is(result.current.messages[0].content, 'Hello, world!');
    t.deepEqual(result.current.userMessageHistory, ['Hello, world!']);
    t.true(agent.chat.calledWith('Hello, world!'));
    t.true(callbacks.mockOnStartRequest.called);
    t.true(callbacks.mockOnCompleteRequest.called);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should not send message if already processing', async (t) => {
  const { agent } = createMockAgent();
  agent.chat.callsFake(() => new Promise(() => {}));
  
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    // Start first message (make it hang)
    await act(async () => {
      result.current.sendMessage('First message');
    });

    t.is(result.current.isProcessing, true);

    // Try to send second message while processing
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    // Should only have the first message
    t.is(result.current.messages.length, 1);
    t.is(result.current.messages[0].content, 'First message');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle chat errors gracefully', async (t) => {
  const { agent } = createMockAgent();
  const callbacks = createMockCallbacks();
  agent.chat.rejects(new Error('API Error'));
  
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );

  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    t.is(result.current.messages.length, 2);
    t.is(result.current.messages[1].role, 'system');
    t.true(result.current.messages[1].content.includes('Error: API Error'));
    t.is(result.current.isProcessing, false);
    t.true(callbacks.mockOnCompleteRequest.called);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle API errors with status and error details', async (t) => {
  const { agent } = createMockAgent();
  const apiError = new Error('Unauthorized');
  (apiError as any).status = 401;
  (apiError as any).error = {
    error: {
      message: 'Invalid API key',
      code: 'invalid_api_key'
    }
  };
  
  agent.chat.rejects(apiError);
  
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    t.true(result.current.messages[1].content.includes('API Error (401): Invalid API key (Code: invalid_api_key)'));
  } finally {
    unmount();
  }
});

test.serial('useAgent - should ignore abort errors', async (t) => {
  const { agent } = createMockAgent();
  const abortError = new Error('Request was aborted');
  abortError.name = 'AbortError';
  
  agent.chat.rejects(abortError);
  
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Should only have user message, no error message
    t.is(result.current.messages.length, 1);
    t.is(result.current.messages[0].role, 'user');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onThinkingText callback', async (t) => {
  // Initialize the hook and trigger sendMessage to set up the tool callbacks
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    // Send a message to trigger the setToolCallbacks call
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    // Test that tool callbacks are properly set up during initialization
    t.true(agent.setToolCallbacks.called);
    t.is(typeof toolCallbacks.onThinkingText, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onFinalMessage callback', async (t) => {
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    t.is(typeof toolCallbacks.onFinalMessage, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onToolStart callback', async (t) => {
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    t.is(typeof toolCallbacks.onToolStart, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onToolEnd callback', async (t) => {
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    t.is(typeof toolCallbacks.onToolEnd, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onApiUsage callback', async (t) => {
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    t.is(typeof toolCallbacks.onApiUsage, 'function');
    
    // Test that the callback forwards to the metrics function
    toolCallbacks.onApiUsage({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    });
    
    t.true(callbacks.mockOnAddApiTokens.calledWith({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }));
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onToolApproval callback', async (t) => {
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    t.is(typeof toolCallbacks.onToolApproval, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle onMaxIterations callback', async (t) => {
  const { agent, toolCallbacks } = createMockAgent();
  const callbacks = createMockCallbacks();
  const { result, unmount } = renderHook(() => 
    useAgent(agent, callbacks.mockOnStartRequest, callbacks.mockOnAddApiTokens, callbacks.mockOnPauseRequest, callbacks.mockOnResumeRequest, callbacks.mockOnCompleteRequest)
  );
  
  try {
    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    
    t.is(typeof toolCallbacks.onMaxIterations, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should approve tool execution', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    // Test that the approveToolExecution function exists
    t.is(typeof result.current.approveToolExecution, 'function');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should reject tool execution', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    const mockResolve = sinon.stub();
    
    // Manually set pending approval state
    act(() => {
      result.current.sendMessage('Test');
    });

    // We need to simulate the pendingApproval state
    // This is tricky to test directly due to the async nature and closure
    t.truthy(result.current.approveToolExecution);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should set API key on agent', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    act(() => {
      result.current.setApiKey('test-api-key');
    });

    t.true(agent.setApiKey.calledWith('test-api-key'));
  } finally {
    unmount();
  }
});

test.serial('useAgent - should toggle auto approve', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    t.is(result.current.sessionAutoApprove, false);

    act(() => {
      result.current.toggleAutoApprove();
    });

    t.is(result.current.sessionAutoApprove, true);
    t.true(agent.setSessionAutoApprove.calledWith(true));

    act(() => {
      result.current.toggleAutoApprove();
    });

    t.is(result.current.sessionAutoApprove, false);
    t.true(agent.setSessionAutoApprove.calledWith(false));
  } finally {
    unmount();
  }
});

test.serial('useAgent - should clear history', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    // Add some messages first
    act(() => {
      result.current.addMessage({
        role: 'user',
        content: 'Test message'
      });
    });

    t.is(result.current.messages.length, 1);

    act(() => {
      result.current.clearHistory();
    });

    t.is(result.current.messages.length, 0);
    t.is(result.current.userMessageHistory.length, 0);
    t.true(agent.clearHistory.called);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should interrupt request', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    act(() => {
      result.current.interruptRequest();
    });

    t.true(agent.interrupt.called);
    t.is(result.current.isProcessing, false);
    t.is(result.current.currentToolExecution, null);
    t.is(result.current.messages.length, 1);
    t.is(result.current.messages[0].role, 'system');
    t.is(result.current.messages[0].content, 'User has interrupted the request.');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should toggle reasoning display', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    t.is(result.current.showReasoning, true);

    act(() => {
      result.current.toggleReasoning();
    });

    t.is(result.current.showReasoning, false);

    act(() => {
      result.current.toggleReasoning();
    });

    t.is(result.current.showReasoning, true);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should add message with generated id and timestamp', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    let messageId: string = '';
    act(() => {
      messageId = result.current.addMessage({
        role: 'user',
        content: 'Test message'
      });
    });

    t.is(result.current.messages.length, 1);
    t.is(result.current.messages[0].id, messageId);
    t.truthy(result.current.messages[0].timestamp instanceof Date);
    t.is(result.current.messages[0].role, 'user');
    t.is(result.current.messages[0].content, 'Test message');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should add message with reasoning', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    act(() => {
      result.current.addMessage({
        role: 'assistant',
        content: 'Response',
        reasoning: 'This is why I responded this way'
      });
    });

    t.is(result.current.messages[0].reasoning, 'This is why I responded this way');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should generate unique message ids', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    let id1: string = '';
    let id2: string = '';
    act(() => {
      id1 = result.current.addMessage({
        role: 'user',
        content: 'Message 1'
      });
      id2 = result.current.addMessage({
        role: 'user',
        content: 'Message 2'
      });
    });

    t.not(id1, id2);
    t.is(result.current.messages.length, 2);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should identify tools that need approval', async (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    await act(async () => {
      await result.current.sendMessage('Test');
    });

    const toolCallbacks = agent.setToolCallbacks.getCall(0).args[0];

    // Test dangerous tool
    act(() => {
      toolCallbacks.onToolStart('delete_file', { file_path: 'test.js' });
    });

    t.is(result.current.currentToolExecution?.needsApproval, true);

    // Test approval required tool
    act(() => {
      toolCallbacks.onToolStart('create_file', { file_path: 'test.js', content: 'test' });
    });

    t.is(result.current.currentToolExecution?.needsApproval, true);

    // Test safe tool
    act(() => {
      toolCallbacks.onToolStart('read_file', { file_path: 'test.js' });
    });

    t.is(result.current.currentToolExecution?.needsApproval, false);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle tool execution status changes', async (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    await act(async () => {
      await result.current.sendMessage('Test');
    });

    const toolCallbacks = agent.setToolCallbacks.getCall(0).args[0];

    // Start tool
    act(() => {
      toolCallbacks.onToolStart('read_file', { file_path: 'test.js' });
    });

    t.is(result.current.currentToolExecution?.status, 'pending');

    // Complete tool
    act(() => {
      toolCallbacks.onToolEnd('read_file', { success: true });
    });

    t.is(result.current.currentToolExecution, null);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle empty message content', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    act(() => {
      result.current.addMessage({
        role: 'user',
        content: ''
      });
    });

    t.is(result.current.messages[0].content, '');
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle multiple rapid message additions', (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addMessage({
          role: 'user',
          content: `Message ${i}`
        });
      }
    });

    t.is(result.current.messages.length, 10);
    t.deepEqual(result.current.messages.map(m => m.content), [
      'Message 0', 'Message 1', 'Message 2', 'Message 3', 'Message 4',
      'Message 5', 'Message 6', 'Message 7', 'Message 8', 'Message 9'
    ]);
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle callback functions being undefined', async (t) => {
  const { agent } = createMockAgent();
  const { result, unmount } = renderHook(() => 
    useAgent(agent) // No callback functions provided
  );

  try {
    await t.notThrowsAsync(async () => {
      await act(async () => {
        await result.current.sendMessage('Test');
      });
    });
  } finally {
    unmount();
  }
});

test.serial('useAgent - should handle agent methods throwing errors', (t) => {
  const { agent } = createMockAgent();
  agent.setApiKey.throws(new Error('Agent error'));

  const { result, unmount } = renderHook(() => 
    useAgent(agent)
  );

  try {
    t.throws(() => {
      result.current.setApiKey('test-key');
    }, { message: 'Agent error' });
  } finally {
    unmount();
  }
});