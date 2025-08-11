#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { Agent } from './agent.js';
import App from '../ui/App.js';

const program = new Command();

async function startChat(
  temperature: number | undefined,
  system: string | undefined,
  debug?: boolean
): Promise<void> {
  console.log(chalk.hex('#FF4500')(`                             
  ██████    ██████   ██████   ██████
 ███░░███░░███░░░██ ███░░███ ███░░███ 
░███ ░███ ░███ ░░░ ░███ ░███░███ ░███ 
░███ ░███ ░███     ░███ ░███░███ ░███ 
░░███░███ ░███     ░░██████ ░░███░███ 
 ░░░░░███ ░░░░      ░░░░░░   ░░░░░███ 
 ██  ░███                        ░███ 
░░██████                         ░███
 ░░░░░░                          ░░░ 
                        ███          
                      ░░███           
  ██████   ██████   ███████   ██████  
 ███░░███ ███░░███ ███░░███  ███░░███ 
░███ ░░░ ░███ ░███░███ ░███ ░███████  
░███  ███░███ ░███░███ ░███ ░███░░░   
░░██████ ░░██████ ░░███████ ░░██████  
 ░░░░░░   ░░░░░░   ░░░░░░░░  ░░░░░░   
`));
    
  try {
    // Create agent (config values will be used for undefined parameters)
    const agent = await Agent.create(
      undefined, // Model will be determined from config or use default
      temperature,
      system ?? null,
      debug
    );

    render(React.createElement(App, { agent }));
  } catch (error) {
    console.log(chalk.red(`Error initializing agent: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

program
  .name('groq')
  .description('Groq Code CLI')
  .version('1.0.2')
  .option('-t, --temperature <temperature>', 'Temperature for generation (0-2)', (value) => {
    const temp = parseFloat(value);
    if (isNaN(temp)) {
      throw new Error('Temperature must be a number');
    }
    // Clamp temperature between 0 and 2
    return Math.max(0, Math.min(2, temp));
  })
  .option('-s, --system <message>', 'Custom system message')
  .option('-d, --debug', 'Enable debug logging to debug-agent.log in current directory')
  .action(async (options) => {
    await startChat(
      options.temperature,
      options.system,
      options.debug
    );
  });

program.parse();
