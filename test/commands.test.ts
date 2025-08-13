import test from 'ava';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initConfigCommand } from '../src/commands/definitions/init-config.js';
import { showConfigCommand } from '../src/commands/definitions/show-config.js';

// Mock context for testing commands
const createMockContext = () => {
  const messages: any[] = [];
  return {
    messages,
    addMessage: (message: any) => {
      messages.push(message);
    },
    setShowLogin: () => {},
    setShowModelSelector: () => {},
    setShowReasoningToggle: () => {},
    clearMessages: () => {},
    agent: null as any
  };
};


test('command definitions have correct properties', t => {
  // Test init-config command
  t.is(initConfigCommand.command, 'init-config');
  t.truthy(initConfigCommand.description);
  t.is(typeof initConfigCommand.handler, 'function');
  
  // Test config command
  t.is(showConfigCommand.command, 'config');
  t.truthy(showConfigCommand.description);
  t.is(typeof showConfigCommand.handler, 'function');
});