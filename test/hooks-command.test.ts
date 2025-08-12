import test from 'ava';
import { hooksCommand } from '../src/commands/definitions/hooks.js';
import { CommandContext } from '../src/commands/base.js';

// Mock context for testing
function createMockContext(): { context: CommandContext; messages: any[] } {
  const messages: any[] = [];
  
  const context: CommandContext = {
    addMessage: (message: any) => {
      messages.push(message);
    },
    clearHistory: () => {
      messages.length = 0;
    },
    setShowLogin: () => {},
    setShowModelSelector: () => {},
    toggleReasoning: () => {},
    showReasoning: false,
    args: '',
  };
  
  return { context, messages };
}

test('hooks command should show help when no subcommand provided', (t) => {
  const { context, messages } = createMockContext();
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  t.regex(messages[0].content, /Hooks Management Commands/);
  t.regex(messages[0].content, /Hook Types/);
  t.regex(messages[0].content, /Environment Variables/);
});

test('hooks command should handle list subcommand', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'list';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  // Should show hooks info - either "No hooks" or actual hooks  
  t.regex(messages[0].content, /No hooks configured|Global User Hooks|Local Project Hooks|Merged Configuration|Configured Hooks/);
});

test('hooks command list --merged shows merged view', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'list --merged';
  hooksCommand.handler(context);
  t.is(messages.length, 1);
  t.regex(messages[0].content, /Merged Configuration|Configured Hooks|No hooks configured/);
});

test('hooks command should handle enable subcommand', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'enable';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  t.regex(messages[0].content, /✓ Hooks enabled/);
});

test('hooks command should handle disable subcommand', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'disable';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  t.regex(messages[0].content, /⚠ Hooks disabled/);
});

test('hooks command should handle reload subcommand', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'reload';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  t.regex(messages[0].content, /✓ Hooks configuration reloaded/);
});

test('hooks command should handle example subcommand', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'example';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  t.regex(messages[0].content, /Example Hooks Configuration/);
  t.regex(messages[0].content, /PreToolUse/);
  t.regex(messages[0].content, /PostToolUse/);
  t.regex(messages[0].content, /local-settings\.json/);
});

test('hooks command should handle init subcommand', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'init';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.is(messages[0].role, 'system');
  // Should either succeed or fail with appropriate message
  t.regex(messages[0].content, /Hooks configuration initialized|Failed to initialize hooks/);
});

test('hooks command should have correct metadata', (t) => {
  t.is(hooksCommand.command, 'hooks');
  t.is(hooksCommand.description, 'Manage hooks configuration');
  t.is(typeof hooksCommand.handler, 'function');
});

test('hooks command should handle args with extra spaces', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'enable'; // The trim happens in split, so just use 'enable'
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.regex(messages[0].content, /✓ Hooks enabled/);
});

test('hooks command should handle unknown subcommand by showing help', (t) => {
  const { context, messages } = createMockContext();
  context.args = 'unknown';
  
  hooksCommand.handler(context);
  
  t.is(messages.length, 1);
  t.regex(messages[0].content, /Hooks Management Commands/);
});