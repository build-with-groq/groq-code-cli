import test from 'ava';
import sinon from 'sinon';
import { CommandContext } from '@src/commands/base';
import { helpCommand } from '@src/commands/definitions/help';

// Note: We're testing helpCommand with the actual getAvailableCommands implementation
// since ES modules make it difficult to stub. The help command will show the actual
// available commands, which is fine for testing purposes.

test('helpCommand - should have correct command properties', (t) => {
  t.is(helpCommand.command, 'help');
  t.is(helpCommand.description, 'Show help and available commands');
  t.is(typeof helpCommand.handler, 'function');
});

test('helpCommand - should add system message with help content', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  helpCommand.handler(mockContext);

  t.is(mockContext.addMessage.callCount, 1);
  
  const call = mockContext.addMessage.getCall(0).args[0];
  t.is(call.role, 'system');
  t.true(call.content.includes('Available Commands:'));
  t.true(call.content.includes('/help - Show help and available commands'));
  t.true(call.content.includes('Navigation:'));
  t.true(call.content.includes('Keyboard Shortcuts:'));
  t.true(call.content.includes('Groq'));
});

test('helpCommand - should include all available commands in help message', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  helpCommand.handler(mockContext);

  const call = mockContext.addMessage.getCall(0).args[0];
  const content = call.content;

  // Should include various commands
  t.true(content.includes('/help'));
  t.true(content.includes('/login'));
  t.true(content.includes('/model'));
  t.true(content.includes('/clear'));
  t.true(content.includes('/reasoning'));
});

test('helpCommand - should include navigation instructions', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  helpCommand.handler(mockContext);

  const call = mockContext.addMessage.getCall(0).args[0];
  const content = call.content;

  t.true(content.includes('arrow keys'));
  t.true(content.includes('Enter to execute'));
  t.true(content.includes('Type \'/\''));
});

test('helpCommand - should include keyboard shortcuts', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  helpCommand.handler(mockContext);

  const call = mockContext.addMessage.getCall(0).args[0];
  const content = call.content;

  t.true(content.includes('Esc'));
  t.true(content.includes('Shift+Tab'));
  t.true(content.includes('Ctrl+C'));
  t.true(content.includes('Clear input box'));
  t.true(content.includes('Toggle auto-approval'));
  t.true(content.includes('Exit the application'));
});

test('helpCommand - should include application description', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  helpCommand.handler(mockContext);

  const call = mockContext.addMessage.getCall(0).args[0];
  const content = call.content;

  t.true(content.includes('lightweight'));
  t.true(content.includes('open-source'));
  t.true(content.includes('coding CLI'));
  t.true(content.includes('powered by Groq'));
});

test('helpCommand - should not call other context methods', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
  };

  helpCommand.handler(mockContext);

  t.false(mockContext.clearHistory.called);
  t.false(mockContext.setShowLogin.called);
  t.false(mockContext.setShowModelSelector.called);
  t.false(mockContext.toggleReasoning.called);
});