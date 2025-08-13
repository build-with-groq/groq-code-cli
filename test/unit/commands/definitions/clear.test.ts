import test from 'ava';
import sinon from 'sinon';
import { clearCommand } from '@src/commands/definitions/clear';
import { CommandContext } from '@src/commands/base';

test('clearCommand - should have correct command properties', (t) => {
  t.is(clearCommand.command, 'clear');
  t.is(clearCommand.description, 'Clear chat history and context');
  t.is(typeof clearCommand.handler, 'function');
});

test('clearCommand - should call clearHistory and add confirmation message', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  clearCommand.handler(mockContext);

  t.is(mockContext.clearHistory.callCount, 1);
  t.is(mockContext.addMessage.callCount, 1);
  t.true(mockContext.addMessage.calledWith({
    role: 'system',
    content: 'Chat history and context cleared.',
  }));
});

test('clearCommand - should call clearHistory before adding message', (t) => {
  const callOrder: string[] = [];
  const mockContext: CommandContext = {
    addMessage: sinon.stub().callsFake(() => callOrder.push('addMessage')),
    clearHistory: sinon.stub().callsFake(() => callOrder.push('clearHistory')),
    setShowLogin: sinon.stub(),
  };

  clearCommand.handler(mockContext);

  t.deepEqual(callOrder, ['clearHistory', 'addMessage']);
});

test('clearCommand - should not call other context methods', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
  };

  clearCommand.handler(mockContext);

  t.false(mockContext.setShowLogin.called);
  t.false(mockContext.setShowModelSelector.called);
  t.false(mockContext.toggleReasoning.called);
});

test('clearCommand - should handle context destructuring correctly', (t) => {
  const mockAddMessage = sinon.stub();
  const mockClearHistory = sinon.stub();
  
  const mockContext: CommandContext = {
    addMessage: mockAddMessage,
    clearHistory: mockClearHistory,
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  clearCommand.handler(mockContext);

  t.is(mockClearHistory.callCount, 1);
  t.true(mockAddMessage.calledWith({
    role: 'system',
    content: 'Chat history and context cleared.',
  }));
});

test('clearCommand - should work with minimal context', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  t.notThrows(() => clearCommand.handler(mockContext));
  t.true(mockContext.clearHistory.called);
  t.true(mockContext.addMessage.called);
});

test('clearCommand - should add system message with correct content', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  clearCommand.handler(mockContext);

  const call = mockContext.addMessage.getCall(0).args[0];
  t.deepEqual(call, {
    role: 'system',
    content: 'Chat history and context cleared.',
  });
});