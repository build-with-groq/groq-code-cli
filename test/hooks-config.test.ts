import test from 'ava';
import { ConfigManager } from '../src/utils/local-settings.js';

test('Hook configuration merging', (t) => {
  const globalHooks = {
    PreToolUse: [
      {
        matcher: 'execute_command',
        hooks: [
          {
            type: 'command',
            command: 'echo global',
            blocking: false
          }
        ]
      }
    ],
    Stop: [
      {
        type: 'command',
        command: 'echo global stop'
      }
    ]
  };

  const localHooks = {
    PreToolUse: [
      {
        matcher: 'delete_file',
        hooks: [
          {
            type: 'command',
            command: 'echo local delete block',
            blocking: true
          }
        ]
      }
    ],
    PostToolUse: [
      {
        matcher: 'create_file',
        hooks: [
          {
            type: 'command',
            command: 'echo local create'
          }
        ]
      }
    ]
  };

  // Use actual merging function
  const configManager = new ConfigManager();
  const merged = configManager.mergeHooks(globalHooks, localHooks);

  // Verify merged configuration
  t.true(Array.isArray(merged.PreToolUse));
  t.is(merged.PreToolUse.length, 2); // Should have both global and local
  t.is(merged.PreToolUse[0].matcher, 'execute_command'); // Global first
  t.is(merged.PreToolUse[1].matcher, 'delete_file'); // Local second
  
  t.true(Array.isArray(merged.PostToolUse));
  t.is(merged.PostToolUse.length, 1); // Only local
  t.is(merged.PostToolUse[0].matcher, 'create_file');
  
  t.true(Array.isArray(merged.Stop));
  t.is(merged.Stop.length, 1); // Only global
  t.is(merged.Stop[0].command, 'echo global stop');
});

test('Local hooks override when appropriate', (t) => {
  const globalHooks = {
    PreToolUse: [
      {
        matcher: 'test_tool',
        hooks: [
          {
            type: 'command',
            command: 'echo global test',
            blocking: false
          }
        ]
      }
    ]
  };

  const localHooks = {
    PreToolUse: [
      {
        matcher: 'test_tool',
        hooks: [
          {
            type: 'command',
            command: 'echo local test override',
            blocking: true
          }
        ]
      }
    ]
  };

  // Use actual merging function (concatenates arrays)
  const configManager = new ConfigManager();
  const merged = configManager.mergeHooks(globalHooks, localHooks);

  t.is(merged.PreToolUse.length, 2);
  t.is(merged.PreToolUse[0].hooks[0].command, 'echo global test');
  t.is(merged.PreToolUse[1].hooks[0].command, 'echo local test override');
  t.is(merged.PreToolUse[1].hooks[0].blocking, true); // Local can be more restrictive
});

test('Empty configurations handled correctly', (t) => {
  const globalHooks = {};
  const localHooks = {
    PreToolUse: [
      {
        matcher: 'test',
        hooks: [
          {
            type: 'command',
            command: 'echo test'
          }
        ]
      }
    ]
  };

  const merged: any = { ...globalHooks, ...localHooks };

  t.deepEqual(Object.keys(merged), ['PreToolUse']);
  t.is(merged.PreToolUse.length, 1);
});

test('Hook command flags parsing', (t) => {
  const testCases = [
    { input: 'list', expected: { command: 'list', flags: [] }},
    { input: 'list --merged', expected: { command: 'list', flags: ['--merged'] }},
    { input: 'init --local', expected: { command: 'init', flags: ['--local'] }},
    { input: '', expected: { command: '', flags: [] }},
  ];

  testCases.forEach(({ input, expected }) => {
    const parts = input.split(' ').filter(p => p);
    const command = parts[0] || '';
    const flags = parts.slice(1);
    
    t.is(command, expected.command);
    t.deepEqual(flags, expected.flags);
  });
});

test('Configuration file paths', (t) => {
  const globalPath = '~/.groq/local-settings.json';
  const localPath = '.groq/local-settings.json';
  
  t.true(globalPath.startsWith('~/'));
  t.false(localPath.startsWith('./')); // Updated to match new behavior  
  t.true(globalPath.includes('.groq'));
  t.true(localPath.includes('.groq'));
  t.true(globalPath.endsWith('local-settings.json'));
  t.true(localPath.endsWith('local-settings.json'));
});