import test from 'ava';
import sinon from 'sinon';
import { modelCommand } from '@src/commands/definitions/model';
import { CommandContext } from '@src/commands/base';

test('modelCommand - should have correct command properties', (t) => {
  t.is(modelCommand.command, 'model');
  t.is(modelCommand.description, 'Select your Groq model');
  t.is(typeof modelCommand.handler, 'function');
});

test('modelCommand - should call setShowModelSelector with true when available', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
  };

  modelCommand.handler(mockContext);

  t.is(mockContext.setShowModelSelector.callCount, 1);
  t.true(mockContext.setShowModelSelector.calledWith(true));
});

test('modelCommand - should not crash when setShowModelSelector is undefined', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    // setShowModelSelector is undefined
  };

  t.notThrows(() => modelCommand.handler(mockContext));
});

test('modelCommand - should not call setShowModelSelector when it is undefined', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    // setShowModelSelector is undefined
  };

  modelCommand.handler(mockContext);

  // Should not throw and should not call other methods unnecessarily
  t.false(mockContext.addMessage.called);
  t.false(mockContext.clearHistory.called);
  t.false(mockContext.setShowLogin.called);
});

test('modelCommand - should not call other context methods when setShowModelSelector is available', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
  };

  modelCommand.handler(mockContext);

  t.false(mockContext.addMessage.called);
  t.false(mockContext.clearHistory.called);
  t.false(mockContext.setShowLogin.called);
  t.false(mockContext.toggleReasoning.called);
});

test('modelCommand - should handle context destructuring correctly', (t) => {
  const mockSetShowModelSelector = sinon.stub();
  
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: mockSetShowModelSelector,
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  modelCommand.handler(mockContext);

  t.true(mockSetShowModelSelector.calledWith(true));
});

test('modelCommand - should check for setShowModelSelector existence before calling', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: undefined, // Explicitly undefined
  };

  t.notThrows(() => modelCommand.handler(mockContext));
});

test('modelCommand - should work correctly with all optional properties present', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: true,
  };

  modelCommand.handler(mockContext);

  t.true(mockContext.setShowModelSelector.calledWith(true));
  // Other methods should not be called
  t.false(mockContext.addMessage.called);
  t.false(mockContext.clearHistory.called);
  t.false(mockContext.setShowLogin.called);
  t.false(mockContext.toggleReasoning.called);
});