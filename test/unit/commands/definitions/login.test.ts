import test from 'ava';
import sinon from 'sinon';
import { loginCommand } from '@src/commands/definitions/login';
import { CommandContext } from '@src/commands/base';

test('loginCommand - should have correct command properties', (t) => {
  t.is(loginCommand.command, 'login');
  t.is(loginCommand.description, 'Login with your credentials');
  t.is(typeof loginCommand.handler, 'function');
});

test('loginCommand - should call setShowLogin with true', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  loginCommand.handler(mockContext);

  t.is(mockContext.setShowLogin.callCount, 1);
  t.true(mockContext.setShowLogin.calledWith(true));
});

test('loginCommand - should not call other context methods', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
  };

  loginCommand.handler(mockContext);

  t.false(mockContext.addMessage.called);
  t.false(mockContext.clearHistory.called);
  t.false(mockContext.setShowModelSelector.called);
  t.false(mockContext.toggleReasoning.called);
});

test('loginCommand - should work with minimal context', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  t.notThrows(() => loginCommand.handler(mockContext));
  t.true(mockContext.setShowLogin.calledWith(true));
});

test('loginCommand - should handle context destructuring correctly', (t) => {
  const mockSetShowLogin = sinon.stub();
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: mockSetShowLogin,
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  loginCommand.handler(mockContext);

  t.true(mockSetShowLogin.calledWith(true));
});