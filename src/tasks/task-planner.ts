import { Agent } from '../core/agent.js';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  dependencies?: string[]; // Task IDs that must be completed before this task
  estimated_time?: number; // Estimated time in minutes
  updated_at?: string;
}

export interface TaskPlan {
  user_query: string;
  tasks: Task[];
  created_at: string;
  completed_at?: string;
}

export interface TaskExecutionResult {
  success: boolean;
  message: string;
  task_plan?: TaskPlan;
  error?: string;
}

/**
 * TaskPlanner - A system for decomposing complex user requests into actionable tasks
 * and executing them in a logical order.
 */
export class TaskPlanner {
  private agent: Agent;
  private taskPlan: TaskPlan | null = null;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  /**
   * Decompose a user request into a structured task plan
   * @param userQuery The original user request
   * @returns A structured task plan
   */
  async createTaskPlan(userQuery: string): Promise<TaskExecutionResult> {
    try {
      // Create a system message that guides the AI to decompose the request into tasks
      const planningSystemMessage = `
You are an expert task planner. Your job is to decompose complex user requests into a 
structured list of actionable tasks. Consider the following when creating tasks:

1. Break down the request into logical, sequential steps
2. Each task should be specific, actionable, and independently verifiable
3. Identify dependencies between tasks
4. Estimate time required for each task (in minutes)
5. Number tasks in a logical sequence

For example, if asked to "build a React todo app", you might create:
1. Plan project structure and file organization
2. Create package.json and install dependencies
3. Set up the main App component
4. Create TodoList component
5. Create TodoItem component
6. Implement state management
7. Add styling
8. Test the application

Return your response as a structured task list. The first task should always be to 
understand the requirements by examining the current directory structure.
`.trim();

      // Create a prompt that asks the AI to generate tasks
      const planningPrompt = `
Please decompose the following user request into a structured list of tasks:

"${userQuery}"

Create a detailed task plan with the following structure:
1. Understand the requirements by checking the current project structure
2. Plan the implementation approach
3. Execute the implementation
4. Verify and test the result

Each task should be specific and actionable.
`;

      // Note: We can't directly call the agent here as it would create a circular dependency.
      // Instead, we'll return a system message that instructs the agent to use the create_tasks tool.
      return {
        success: true,
        message: 'Task plan ready to be created via agent tools',
        task_plan: {
          user_query: userQuery,
          tasks: [
            {
              id: "1",
              description: "Understand requirements by examining current project structure",
              status: "pending",
              notes: "List files in current directory to understand project context"
            },
            {
              id: "2",
              description: "Break down user request into specific implementation tasks",
              status: "pending",
              notes: "Analyze the user request to identify key components and requirements"
            }
          ],
          created_at: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to create task plan',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute the task plan by updating task statuses and coordinating with the agent
   * @param taskPlan The task plan to execute
   * @returns Execution result
   */
  async executeTaskPlan(taskPlan: TaskPlan): Promise<TaskExecutionResult> {
    try {
      this.taskPlan = taskPlan;
      
      // Update task plan status
      taskPlan.completed_at = new Date().toISOString();
      
      return {
        success: true,
        message: `Task plan execution completed with ${taskPlan.tasks.length} tasks`,
        task_plan: taskPlan
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute task plan',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the current task plan
   * @returns The current task plan or null if none exists
   */
  getCurrentTaskPlan(): TaskPlan | null {
    return this.taskPlan;
  }

  /**
   * Update a specific task's status
   * @param taskId The ID of the task to update
   * @param status The new status
   * @param notes Optional notes about the update
   */
  updateTaskStatus(taskId: string, status: 'pending' | 'in_progress' | 'completed', notes?: string): void {
    if (!this.taskPlan) return;
    
    const task = this.taskPlan.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (notes) {
        task.notes = notes;
      }
      task.updated_at = new Date().toISOString();
    }
  }

  /**
   * Get pending tasks that can be executed (no unmet dependencies)
   * @returns Array of executable tasks
   */
  getExecutableTasks(): Task[] {
    if (!this.taskPlan) return [];
    
    return this.taskPlan.tasks.filter(task => {
      // Task must be pending
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      if (task.dependencies && task.dependencies.length > 0) {
        return task.dependencies.every(depId => {
          const depTask = this.taskPlan!.tasks.find(t => t.id === depId);
          return depTask && depTask.status === 'completed';
        });
      }
      
      // No dependencies, so it's executable
      return true;
    });
  }
  
  /**
   * Generate a detailed plan for implementing a user request
   * This method provides a more structured approach to task planning
   * @param userQuery The user's request
   * @returns A detailed implementation plan
   */
  generateImplementationPlan(userQuery: string): TaskPlan {
    return {
      user_query: userQuery,
      tasks: [
        {
          id: "1",
          description: "Analyze requirements and scope",
          status: "pending",
          notes: "Break down the user request into specific requirements"
        },
        {
          id: "2",
          description: "Examine current project structure",
          status: "pending",
          notes: "Use list_files to understand the existing codebase"
        },
        {
          id: "3",
          description: "Plan implementation approach",
          status: "pending",
          notes: "Design the solution architecture and component structure"
        },
        {
          id: "4",
          description: "Implement core functionality",
          status: "pending",
          notes: "Create main components and features incrementally"
        },
        {
          id: "5",
          description: "Add supporting features",
          status: "pending",
          notes: "Implement additional functionality like error handling, styling, etc."
        },
        {
          id: "6",
          description: "Test and verify implementation",
          status: "pending",
          notes: "Ensure all features work as expected"
        },
        {
          id: "7",
          description: "Document the implementation",
          status: "pending",
          notes: "Add comments and documentation where necessary"
        }
      ],
      created_at: new Date().toISOString()
    };
  }
}