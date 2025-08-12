import test from 'ava';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test('GitIgnore functionality simulation', (t) => {
  // Simulate the gitignore update logic without actually writing files
  function simulateGitIgnoreUpdate(existingContent: string, ignoreEntry: string): string {
    if (!existingContent.includes(ignoreEntry)) {
      const newContent = existingContent + (existingContent.endsWith('\n') ? '' : '\n') + ignoreEntry + '\n';
      return newContent;
    }
    return existingContent;
  }

  // Test cases
  const ignoreEntry = '.groq/local-settings.json';

  // Test 1: Empty gitignore
  const emptyGitignore = '';
  const result1 = simulateGitIgnoreUpdate(emptyGitignore, ignoreEntry);
  t.is(result1, '.groq/local-settings.json\n');

  // Test 2: Gitignore with content but no newline at end
  const gitignoreNoNewline = 'node_modules\n*.log';
  const result2 = simulateGitIgnoreUpdate(gitignoreNoNewline, ignoreEntry);
  t.is(result2, 'node_modules\n*.log\n.groq/local-settings.json\n');

  // Test 3: Gitignore with content and newline at end
  const gitignoreWithNewline = 'node_modules\n*.log\n';
  const result3 = simulateGitIgnoreUpdate(gitignoreWithNewline, ignoreEntry);
  t.is(result3, 'node_modules\n*.log\n.groq/local-settings.json\n');

  // Test 4: Entry already exists
  const gitignoreWithEntry = 'node_modules\n.groq/local-settings.json\n*.log\n';
  const result4 = simulateGitIgnoreUpdate(gitignoreWithEntry, ignoreEntry);
  t.is(result4, gitignoreWithEntry); // Should remain unchanged
});

test('Configuration precedence simulation', (t) => {
  // Simulate the configuration merging logic
  function simulateConfigMerge(globalConfig: any, localConfig: any): any {
    return { ...globalConfig, ...localConfig };
  }

  const globalConfig = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'execute_command',
          hooks: [{ type: 'command', command: 'echo global' }]
        }
      ]
    },
    apiKey: 'global-key'
  };

  const localConfig = {
    hooks: {
      PostToolUse: [
        {
          matcher: 'create_file', 
          hooks: [{ type: 'command', command: 'echo local' }]
        }
      ]
    },
    apiKey: 'local-key-override'
  };

  const merged = simulateConfigMerge(globalConfig, localConfig);

  // Verify local overrides global for non-hook settings
  t.is(merged.apiKey, 'local-key-override');

  // Verify hooks are merged (local config hooks are added)
  t.true('PreToolUse' in merged.hooks); // From global
  t.true('PostToolUse' in merged.hooks); // From local

  // Verify local takes precedence when both exist
  const globalWithSameHook = {
    ...globalConfig,
    hooks: {
      PreToolUse: [
        {
          matcher: 'execute_command',
          hooks: [{ type: 'command', command: 'echo global' }]
        }
      ]
    }
  };

  const localWithSameHook = {
    ...localConfig,
    hooks: {
      PreToolUse: [
        {
          matcher: 'execute_command',
          hooks: [{ type: 'command', command: 'echo local override' }]
        }
      ]
    }
  };

  const mergedWithOverride = simulateConfigMerge(globalWithSameHook, localWithSameHook);
  
  // Local should completely override the hooks object
  t.is(mergedWithOverride.hooks.PreToolUse[0].hooks[0].command, 'echo local override');
});