import { CommandDefinition, CommandContext } from '../base.js';
import { hooksManager } from '../../utils/hooks.js';
import { ConfigManager } from '../../utils/local-settings.js';

function listHooks(showSource: boolean = true): string {
  const globalHooks = hooksManager.getGlobalHooks();
  const localHooks = hooksManager.getLocalHooks();
  const mergedHooks = hooksManager.getActiveHooks();
  
  if (!mergedHooks || Object.keys(mergedHooks).length === 0) {
    return 'No hooks configured\nRun "/hooks init" for global hooks or "/hooks init --local" for project-specific hooks';
  }

  let output = '\n';
  
  // Show global hooks
  if (showSource && Object.keys(globalHooks).length > 0) {
    output += 'Global User Hooks (~/.groq/local-settings.json):\n';
    output += '─'.repeat(45) + '\n';
    output += formatHooks(globalHooks);
  }
  
  // Show local hooks  
  if (showSource && Object.keys(localHooks).length > 0) {
    if (output.length > 1) output += '\n';
    output += 'Local Project Hooks (.groq/local-settings.json):\n';
    output += '─'.repeat(50) + '\n';
    output += formatHooks(localHooks);
  }
  
  // Show merged result
  if (showSource && (Object.keys(globalHooks).length > 0 || Object.keys(localHooks).length > 0)) {
    output += '\nMerged Configuration (active):\n';
    output += '─'.repeat(40) + '\n';
  } else {
    output += 'Configured Hooks:\n';
    output += '─'.repeat(40) + '\n';
  }
  output += formatHooks(mergedHooks);
  
  return output;
}

function formatHooks(hooks: any): string {
  let output = '';
  
  for (const [hookType, hookDefs] of Object.entries(hooks)) {
    output += `\n${hookType}:\n`;
    
    if (Array.isArray(hookDefs)) {
      if (hookType === 'PreToolUse' || hookType === 'PostToolUse') {
        // These have matchers
        for (const matcher of hookDefs as any[]) {
          output += `  Matcher: ${matcher.matcher}\n`;
          for (const hook of matcher.hooks) {
            output += `    - Command: ${hook.command}\n`;
            if (hook.timeout !== undefined) output += `      Timeout: ${hook.timeout}ms\n`;
            if (hook.blocking !== undefined) output += `      Blocking: ${hook.blocking}\n`;
          }
        }
      } else {
        // Direct hook definitions
        for (const hook of hookDefs as any[]) {
          output += `  - Command: ${hook.command}\n`;
          if (hook.timeout !== undefined) output += `    Timeout: ${hook.timeout}ms\n`;
          if (hook.blocking !== undefined) output += `    Blocking: ${hook.blocking}\n`;
        }
      }
    }
  }
  
  return output;
}

function showExampleConfig(): string {
  const example = {
    "PreToolUse": [
      {
        "matcher": "execute_command",
        "hooks": [
          {
            "type": "command",
            "command": "echo '[HOOK] Command execution: $HOOK_TOOL_NAME'",
            "blocking": true
          }
        ]
      },
      {
        "matcher": "delete_file",
        "hooks": [
          {
            "type": "command",
            "command": "echo '[HOOK] File deletion blocked' && exit 1",
            "blocking": true
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "create_file",
        "hooks": [
          {
            "type": "command",
            "command": "echo '[HOOK] File created'"
          }
        ]
      }
    ],
    "Notification": [
      {
        "type": "command",
        "command": "echo '[NOTIFICATION] $HOOK_CONTEXT' >> ~/groq-notifications.log"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "echo '[HOOK] Session ended at $HOOK_TIMESTAMP'"
      }
    ],
    "SubagentStop": [
      {
        "type": "command",
        "command": "echo '[HOOK] Subagent \"$HOOK_CONTEXT\" completed'"
      }
    ]
  };

  let output = '\nExample Hooks Configuration:\n';
  output += '─'.repeat(40) + '\n';
  output += JSON.stringify(example, null, 2);
  output += '\n\nAdd this to your ~/.groq/local-settings.json under the "hooks" key';
  
  return output;
}

function initializeHooks(isLocal: boolean = false): string {
  const configManager = new ConfigManager();
  
  // Create a safe example configuration
  const exampleHooks = {
    "PreToolUse": [
      {
        "matcher": "execute_command",
        "hooks": [
          {
            "type": "command",
            "command": `echo '[HOOK] Executing command (${isLocal ? 'local' : 'global'})'`,
            "blocking": false
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "create_file",
        "hooks": [
          {
            "type": "command",
            "command": `echo '[HOOK] File operation completed (${isLocal ? 'local' : 'global'})'`
          }
        ]
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": `echo '[HOOK] Session completed (${isLocal ? 'local' : 'global'})'`
      }
    ]
  };

  try {
    configManager.setHooksConfig(exampleHooks, !isLocal); // isGlobal is opposite of isLocal
    hooksManager.reloadHooks();
    
    const configPath = isLocal ? '.groq/local-settings.json' : '~/.groq/local-settings.json';
    let message = `✓ Hooks configuration initialized with examples\nEdit ${configPath} to customize hooks`;
    
    if (isLocal) {
      message += '\n\nNote: Local hooks file is automatically added to .gitignore';
    }
    
    return message;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Failed to initialize hooks: ${msg}`;
  }
}

function showHelp(): string {
  let output = '\nHooks Management Commands:\n';
  output += '─'.repeat(40) + '\n';
  output += '  /hooks list              - List all configured hooks\n';
  output += '  /hooks list --merged     - List only merged hooks\n';
  output += '  /hooks enable            - Enable hooks execution\n';
  output += '  /hooks disable           - Disable hooks execution\n';
  output += '  /hooks reload            - Reload hooks configuration\n';
  output += '  /hooks example           - Show example configuration\n';
  output += '  /hooks init              - Initialize global hooks\n';
  output += '  /hooks init --local      - Initialize local project hooks\n';
  
  output += '\n\nHook Types:\n';
  output += '─'.repeat(40) + '\n';
  output += '  PreToolUse    - Run before tool execution\n';
  output += '  PostToolUse   - Run after tool execution\n';
  output += '  Notification  - Run on notifications\n';
  output += '  Stop          - Run when session ends\n';
  output += '  SubagentStop  - Run when subagent completes\n';
  
  output += '\n\nEnvironment Variables:\n';
  output += '─'.repeat(40) + '\n';
  output += '  $HOOK_TYPE      - Type of hook trigger\n';
  output += '  $HOOK_TOOL_NAME - Name of tool being executed\n';
  output += '  $HOOK_TIMESTAMP - ISO timestamp\n';
  output += '  $HOOK_CONTEXT   - Full context as JSON\n';
  
  output += '\n\nConfiguration Files:\n';
  output += '─'.repeat(40) + '\n';
  output += '  Global: ~/.groq/local-settings.json (user-wide)\n';
  output += '  Local:  .groq/local-settings.json (project-specific, not in git)\n';
  output += '\n  Local hooks extend and override global hooks\n';
  output += '  Local settings are automatically added to .gitignore\n';
  
  return output;
}

export const hooksCommand: CommandDefinition = {
  command: 'hooks',
  description: 'Manage hooks configuration',
  handler: ({ addMessage, args = '' }: CommandContext) => {
    const parts = args.split(' ').filter(p => p);
    const subcommand = parts[0] || '';
    const flags = parts.slice(1);
    
    let responseMessage = '';
    
    switch (subcommand) {
      case 'list': {
        const showMergedOnly = flags.includes('--merged');
        responseMessage = listHooks(!showMergedOnly);
        break;
      }
      
      case 'enable':
        hooksManager.setEnabled(true);
        responseMessage = '✓ Hooks enabled';
        break;
      
      case 'disable':
        hooksManager.setEnabled(false);
        responseMessage = '⚠ Hooks disabled';
        break;
      
      case 'reload':
        hooksManager.reloadHooks();
        responseMessage = '✓ Hooks configuration reloaded';
        break;
      
      case 'example':
        responseMessage = showExampleConfig();
        break;
      
      case 'init': {
        const isLocal = flags.includes('--local');
        responseMessage = initializeHooks(isLocal);
        break;
      }
      
      default:
        responseMessage = showHelp();
    }
    
    addMessage({
      role: 'system',
      content: responseMessage
    });
  }
};