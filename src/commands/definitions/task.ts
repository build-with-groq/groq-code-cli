import { CommandDefinition, CommandContext } from '../base.js';

export const taskCommand: CommandDefinition = {
  command: 'task',
  description: 'Task management system - decompose requests into tasks and execute them',
  handler: ({ addMessage }: CommandContext) => {
    // Parse subcommand
    const userInput = '/task help'; // Default to help since we don't have userInput
    const parts = userInput.split(' ');
    const subcommand = parts[1] ? parts[1].toLowerCase() : 'help';
    
    switch (subcommand) {
      case 'plan':
        const request = parts.slice(2).join(' ');
        if (request) {
          addMessage({
            role: 'system',
            content: `I'll help you decompose the request into tasks. Please use the plan_tasks tool to automatically break down this request:\n\n"${request}"\n\nThe AI will analyze this request and create a structured task plan for implementation.`
          });
        } else {
          addMessage({
            role: 'system',
            content: 'Please provide a request to plan. Usage: /task plan [your request]'
          });
        }
        break;
        
      case 'list':
        addMessage({
          role: 'system',
          content: 'To view the current task list, use the update_tasks tool with an empty update array to get the current status.'
        });
        break;
        
      case 'status':
        if (parts.length >= 4) {
          const taskId = parts[2];
          const status = parts[3];
          addMessage({
            role: 'system',
            content: `To update task ${taskId} status to ${status}, use the update_tasks tool with the appropriate parameters.`
          });
        } else {
          addMessage({
            role: 'system',
            content: 'Usage: /task status [task-id] [status]\nStatus can be: pending, in_progress, completed'
          });
        }
        break;
        
      case 'execute':
        addMessage({
          role: 'system',
          content: 'Task execution will be handled automatically as part of the normal tool workflow. The AI will execute tasks one by one as needed.'
        });
        break;
        
      case 'progress':
        addMessage({
          role: 'system',
          content: 'To check task execution progress, I will internally track progress and update task statuses using the update_tasks tool.'
        });
        break;
        
      case 'help':
      default:
        addMessage({
          role: 'system',
          content: `The task system helps you decompose complex requests into manageable tasks.
          
Available subcommands:
- /task plan [request] - Automatically decompose a request into tasks
- /task list - Show current task list
- /task status [task-id] [status] - Update task status
- /task execute - Execute pending tasks
- /task progress - Show execution progress

Example:
/task plan "Create a React todo app with authentication"
/task list
/task status 1 in_progress
/task execute
/task progress
`
        });
    }
  }
};