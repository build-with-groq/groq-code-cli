import { Task, TaskPlan } from './task-planner.js';
import { Agent } from '../core/agent.js';

export interface TaskExecutionContext {
  agent: Agent;
  taskPlan: TaskPlan;
  currentTaskIndex: number;
  executionHistory: Array<{
    taskId: string;
    status: 'started' | 'completed' | 'failed';
    timestamp: string;
    result?: any;
  }>;
}

export interface TaskExecutionResult {
  success: boolean;
  message: string;
  taskId?: string;
  error?: string;
  nextTaskId?: string;
}

/**
 * TaskExecutionManager - Manages the execution of tasks in a task plan
 * Coordinates between the agent and the task planner to execute tasks in order
 */
export class TaskExecutionManager {
  private context: TaskExecutionContext;
  private isExecuting: boolean = false;

  constructor(agent: Agent, taskPlan: TaskPlan) {
    this.context = {
      agent,
      taskPlan,
      currentTaskIndex: 0,
      executionHistory: []
    };
  }

  /**
   * Execute the next pending task in the task plan
   * @returns Execution result
   */
  async executeNextTask(): Promise<TaskExecutionResult> {
    if (this.isExecuting) {
      return {
        success: false,
        message: 'Task execution already in progress'
      };
    }

    this.isExecuting = true;

    try {
      // Get the next executable task
      const nextTask = this.getNextExecutableTask();
      
      if (!nextTask) {
        // Check if all tasks are completed
        const allCompleted = this.context.taskPlan.tasks.every(task => task.status === 'completed');
        
        if (allCompleted) {
          return {
            success: true,
            message: 'All tasks completed successfully',
            nextTaskId: undefined
          };
        } else {
          return {
            success: true,
            message: 'No tasks ready for execution (waiting on dependencies)',
            nextTaskId: undefined
          };
        }
      }

      // Log task start
      this.context.executionHistory.push({
        taskId: nextTask.id,
        status: 'started',
        timestamp: new Date().toISOString()
      });

      // Update task status to in_progress
      nextTask.status = 'in_progress';
      nextTask.updated_at = new Date().toISOString();

      // In a real implementation, this would coordinate with the agent to execute the task
      // For now, we'll simulate task execution
      
      // Simulate task execution
      await this.simulateTaskExecution(nextTask);
      
      // Update task status to completed
      nextTask.status = 'completed';
      nextTask.updated_at = new Date().toISOString();
      
      // Log task completion
      const historyEntry = this.context.executionHistory.find(entry => 
        entry.taskId === nextTask.id && entry.status === 'started');
      if (historyEntry) {
        historyEntry.status = 'completed';
        historyEntry.timestamp = new Date().toISOString();
      }

      // Find the next task to execute
      const nextExecutableTask = this.getNextExecutableTask();
      
      return {
        success: true,
        message: `Task ${nextTask.id} completed successfully`,
        taskId: nextTask.id,
        nextTaskId: nextExecutableTask ? nextExecutableTask.id : undefined
      };

    } catch (error) {
      this.isExecuting = false;
      return {
        success: false,
        message: 'Failed to execute task',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Get the next task that can be executed (pending and dependencies met)
   * @returns The next executable task or null if none available
   */
  private getNextExecutableTask(): Task | null {
    return this.context.taskPlan.tasks.find(task => {
      // Task must be pending
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      if (task.dependencies && task.dependencies.length > 0) {
        return task.dependencies.every(depId => {
          const depTask = this.context.taskPlan.tasks.find(t => t.id === depId);
          return depTask && depTask.status === 'completed';
        });
      }
      
      // No dependencies, so it's executable
      return true;
    }) || null;
  }

  /**
   * Simulate task execution (in a real implementation, this would coordinate with the agent)
   * @param task The task to execute
   */
  private async simulateTaskExecution(task: Task): Promise<void> {
    // Simulate some work being done
    return new Promise(resolve => {
      setTimeout(() => {
        // In a real implementation, this would:
        // 1. Analyze the task description
        // 2. Determine what tools are needed
        // 3. Coordinate with the agent to execute those tools
        // 4. Monitor progress and update status
        resolve();
      }, 1000);
    });
  }

  /**
   * Get the current execution context
   * @returns The current execution context
   */
  getContext(): TaskExecutionContext {
    return { ...this.context };
  }

  /**
   * Check if all tasks are completed
   * @returns True if all tasks are completed, false otherwise
   */
  isComplete(): boolean {
    return this.context.taskPlan.tasks.every(task => task.status === 'completed');
  }

  /**
   * Get execution progress
   * @returns Progress information
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    const total = this.context.taskPlan.tasks.length;
    const completed = this.context.taskPlan.tasks.filter(task => task.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }
}