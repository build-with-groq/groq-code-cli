#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { Agent } from './agent.js';
import App from '../ui/App.js';

const program = new Command();

async function startChat(
  temperature: number,
  system: string | null,
  debug?: boolean
): Promise<void> {
  console.log(chalk.hex('#FF4500')(`                             

    █████╗ ██████╗  ██████╗ ███████╗███╗   ██╗████████╗     ██████╗██╗     ██╗    
    ██╔══██╗██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝    ██╔════╝██║     ██║    
    ███████║██████╔╝██║  ███╗█████╗  ██╔██╗ ██║   ██║       ██║     ██║     ██║    
    ██╔══██║██╔══██╗██║   ██║██╔══╝  ██║╚██╗██║   ██║       ██║     ██║     ██║    
    ██║  ██║██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║       ╚██████╗███████╗██║    
    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝        ╚═════╝╚══════╝╚═╝      
`));
    
  let defaultModel = 'moonshotai/kimi-k2-instruct';
  try {
    // Create agent (API key will be checked on first message)
    const agent = await Agent.create(defaultModel, temperature, system, debug);

    render(React.createElement(App, { agent }));
  } catch (error) {
    console.log(chalk.red(`Error initializing agent: ${error}`));
    process.exit(1);
  }
}

program
  .name('groq')
  .description('Groq Code CLI')
  .version('1.0.2')
  .option('-t, --temperature <temperature>', 'Temperature for generation', parseFloat, 1.0)
  .option('-s, --system <message>', 'Custom system message')
  .option('-d, --debug', 'Enable debug logging to debug-agent.log in current directory')
  .action(async (options) => {
    await startChat(
      options.temperature,
      options.system || null,
      options.debug
    );
  });

program.parse();
