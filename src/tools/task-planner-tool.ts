import { ToolResult, createToolResponse } from './tools.js';
import { Task, TaskPlan } from '../tasks/task-planner.js';

interface TaskUpdate {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

/**
 * Plan tasks automatically based on user request
 * This tool helps the AI decompose complex requests into structured task lists
 */
export async function planTasks(userQuery: string): Promise<ToolResult> {
  try {
    // Validate input
    if (!userQuery || userQuery.trim().length === 0) {
      return createToolResponse(false, undefined, '', 'Error: User query is required');
    }

    // Create a structured task plan based on common patterns
    const taskPlan: TaskPlan = {
      user_query: userQuery,
      tasks: createInitialTaskList(userQuery),
      created_at: new Date().toISOString()
    };

    // Return a deep copy to prevent mutation of historical displays
    const snapshot = {
      user_query: taskPlan.user_query,
      tasks: taskPlan.tasks.map(task => ({ ...task })),
      created_at: taskPlan.created_at
    };

    return createToolResponse(
      true,
      snapshot,
      `Created automatic task plan with ${taskPlan.tasks.length} tasks for: ${userQuery}`
    );

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to plan tasks - ${error}`);
  }
}

/**
 * Create an initial task list based on the user query
 * @param userQuery The user's request
 * @returns An array of tasks
 */
function createInitialTaskList(userQuery: string): Task[] {
  // Common keywords that indicate different types of tasks
  const lowerQuery = userQuery.toLowerCase();
  
  // Default tasks that apply to most requests
  const tasks: Task[] = [
    {
      id: "1",
      description: "Analyze requirements and scope",
      status: "pending",
      notes: "Break down the user request into specific requirements"
    }
  ];
  
  // Add tasks based on keywords in the query
  if (lowerQuery.includes('build') || lowerQuery.includes('create') || lowerQuery.includes('make')) {
    tasks.push(
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
      }
    );
  }
  
  if (lowerQuery.includes('web') || lowerQuery.includes('app') || lowerQuery.includes('frontend') || lowerQuery.includes('react') || lowerQuery.includes('vue') || lowerQuery.includes('angular')) {
    tasks.push(
      {
        id: "4",
        description: "Set up project structure and dependencies",
        status: "pending",
        notes: "Create necessary directories and install required packages"
      },
      {
        id: "5",
        description: "Implement core components",
        status: "pending",
        notes: "Create main UI components and features"
      }
    );
  }
  
  if (lowerQuery.includes('api') || lowerQuery.includes('backend') || lowerQuery.includes('server') || lowerQuery.includes('database')) {
    tasks.push(
      {
        id: "6",
        description: "Design API endpoints and data models",
        status: "pending",
        notes: "Plan the REST API or GraphQL schema"
      },
      {
        id: "7",
        description: "Implement backend services",
        status: "pending",
        notes: "Create server logic and database connections"
      }
    );
  }
  
  if (lowerQuery.includes('test') || lowerQuery.includes('testing')) {
    tasks.push(
      {
        id: "8",
        description: "Create test suite",
        status: "pending",
        notes: "Set up testing framework and write unit tests"
      }
    );
  }
  
  // Always add these final tasks
  tasks.push(
    {
      id: (tasks.length + 1).toString(),
      description: "Implement and integrate all components",
      status: "pending",
      notes: "Combine all parts and ensure they work together"
    },
    {
      id: (tasks.length + 2).toString(),
      description: "Test and verify implementation",
      status: "pending",
      notes: "Ensure all features work as expected"
    },
    {
      id: (tasks.length + 3).toString(),
      description: "Document the implementation",
      status: "pending",
      notes: "Add comments and documentation where necessary"
    }
  );
  
  return tasks;
}

/**
 * Execute the next available task in the plan
 */
export async function executeNextTask(): Promise<ToolResult> {
  try {
    // This would normally interact with the task planner to get the next task
    // For now, we'll return a placeholder response
    return createToolResponse(
      true,
      { next_task_id: "1", description: "Sample task execution" },
      "Identified next task to execute"
    );

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to execute next task - ${error}`);
  }
}