import { CommandDefinition, CommandContext } from '../base.js';
import { McpClient } from '../../core/mcp.js';

export const mcpCommand: CommandDefinition = {
  command: 'mcp',
  description: 'Show MCP server status and available tools',
  handler: async ({ addMessage }: CommandContext) => {
    addMessage({ role: 'system', content: 'Checking MCP server configuration...' });

    const configs = McpClient.fromConfigFile();
    const names = Object.keys(configs);
    if (names.length === 0) {
      addMessage({
        role: 'system',
        content: [
          'No MCP servers configured.',
          '',
          'Configure servers in ~/.groq/mcp.json:',
          '  { "servers": {',
          '      "example": {',
          '        "command": "npx",',
          '        "args": ["-y", "some-mcp-server", "arg1"]',
          '      }',
          '    }',
          '  }',
          '',
          'The client connects lazily at startup; restart to pick up changes.',
        ].join('\n'),
      });
      return;
    }

    const clients: McpClient[] = [];
    const lines: string[] = [];
    for (const name of names) {
      const c = new McpClient(name, configs[name]);
      try {
        await c.connect();
        const tools = await c.listMcpTools();
        clients.push(c);
        lines.push(`✓ ${name} — ${tools.length} tools${tools.length ? ':' : ''}`);
        for (const t of tools) lines.push(`    - ${t.name} — ${t.description.slice(0, 80)}`);
      } catch (e) {
        lines.push(`✗ ${name} — failed to connect: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (const c of clients) c.close();
    addMessage({ role: 'system', content: lines.join('\n') || 'No MCP tools found.' });
  },
};