import test from 'ava';
import sinon from 'sinon';
import { BaseCommand, CommandContext, CommandDefinition } from '@src/commands/base';

test('CommandContext - should define correct interface structure', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: true,
  };

  t.truthy(mockContext.addMessage);
  t.truthy(mockContext.clearHistory);
  t.truthy(mockContext.setShowLogin);
  t.truthy(mockContext.setShowModelSelector);
  t.truthy(mockContext.toggleReasoning);
  t.is(typeof mockContext.showReasoning, 'boolean');
});

test('CommandContext - should work with minimal required properties', (t) => {
  const minimalContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  t.truthy(minimalContext.addMessage);
  t.truthy(minimalContext.clearHistory);
  t.truthy(minimalContext.setShowLogin);
  t.is(minimalContext.setShowModelSelector, undefined);
  t.is(minimalContext.toggleReasoning, undefined);
  t.is(minimalContext.showReasoning, undefined);
});

test('CommandDefinition - should define correct interface structure', (t) => {
  const mockHandler = sinon.stub();
  const mockDefinition: CommandDefinition = {
    command: 'test',
    description: 'Test command',
    handler: mockHandler,
  };

  t.is(mockDefinition.command, 'test');
  t.is(mockDefinition.description, 'Test command');
  t.is(mockDefinition.handler, mockHandler);
});

class TestCommand extends BaseCommand {
  command = 'test';
  description = 'Test command for unit tests';
  
  handler(context: CommandContext): void {
    context.addMessage({
      role: 'system',
      content: 'Test message',
    });
  }
}

test('BaseCommand - should create a command instance with required properties', (t) => {
  const testCommand = new TestCommand();
  
  t.is(testCommand.command, 'test');
  t.is(testCommand.description, 'Test command for unit tests');
  t.is(typeof testCommand.handler, 'function');
});

test('BaseCommand - should execute handler correctly', (t) => {
  const testCommand = new TestCommand();
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
  };

  testCommand.handler(mockContext);

  t.true(mockContext.addMessage.calledWith({
    role: 'system',
    content: 'Test message',
  }));
});

test('BaseCommand - should implement CommandDefinition interface', (t) => {
  const testCommand = new TestCommand();
  
  // Should be assignable to CommandDefinition
  const definition: CommandDefinition = testCommand;
  
  t.is(definition.command, 'test');
  t.is(definition.description, 'Test command for unit tests');
  t.is(typeof definition.handler, 'function');
});

class AnotherTestCommand extends BaseCommand {
  command = 'another';
  description = 'Another test command';
  
  handler(context: CommandContext): void {
    if (context.setShowModelSelector) {
      context.setShowModelSelector(true);
    }
    context.clearHistory();
  }
}

test('BaseCommand - should handle optional context properties', (t) => {
  const anotherCommand = new AnotherTestCommand();
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
  };

  anotherCommand.handler(mockContext);

  t.true(mockContext.setShowModelSelector.calledWith(true));
  t.true(mockContext.clearHistory.called);
});

test('BaseCommand - should handle missing optional context properties gracefully', (t) => {
  const anotherCommand = new AnotherTestCommand();
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    // setShowModelSelector is undefined
  };

  t.notThrows(() => anotherCommand.handler(mockContext));
  t.true(mockContext.clearHistory.called);
});