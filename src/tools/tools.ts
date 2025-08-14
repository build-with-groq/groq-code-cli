import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, createDirectory, displayTree } from '../utils/file-ops.js';
import { setReadFilesTracker } from './validators.js';
import { planTasks, executeNextTask } from './task-planner-tool.js';

const execAsync = promisify(exec);

export interface ToolResult {
  success: boolean;
  content?: any;
  data?: any;
  message?: string;
  error?: string;
}

interface TaskUpdate {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  updated_at?: string;
}

// Global task state
let currentTaskList: {
  user_query: string;
  tasks: Task[];
  created_at: string;
} | null = null;

// Track which files have been read in the current session
const readFiles = new Set<string>();

// Export readFiles for validator access
export function getReadFilesTracker(): Set<string> {
  return readFiles;
}

// Initialize validator with readFiles tracker
setReadFilesTracker(readFiles);

/**
 * Format key parameters for tool call display
 */
export function formatToolParams(toolName: string, toolArgs: Record<string, any>, options: { includePrefix?: boolean; separator?: string } = {}): string {
  const { includePrefix = true, separator = '=' } = options;
  
  const paramMappings: Record<string, string[]> = {
    read_file: ['file_path'],
    create_file: ['file_path'],
    edit_file: ['file_path'],
    delete_file: ['file_path'],
    list_files: ['directory'],
    search_files: ['pattern'],
    execute_command: ['command'],
    create_tasks: [],
    update_tasks: [],
  };

  const keyParams = paramMappings[toolName] || [];

  if (keyParams.length === 0) {
    return '';
  }

  const paramParts = keyParams
    .filter(param => param in toolArgs)
    .map(param => {
      let value = toolArgs[param];
      // Truncate long values
      if (typeof value === 'string' && value.length > 50) {
        value = value.substring(0, 47) + '...';
      } else if (Array.isArray(value) && value.length > 3) {
        value = `[${value.length} items]`;
      }
      return `${param}${separator}${JSON.stringify(value)}`;
    });

  if (paramParts.length === 0) {
    return includePrefix ? `Arguments: ${JSON.stringify(toolArgs)}` : JSON.stringify(toolArgs);
  }

  const formattedParams = paramParts.join(', ');
  return includePrefix ? `Parameters: ${formattedParams}` : formattedParams;
}

/**
 * Create a standardized tool response format
 */
export function createToolResponse(success: boolean, data?: any, message: string = '', error: string = ''): ToolResult {
  const response: ToolResult = { success };

  if (success) {
    if (data !== undefined) {
      response.content = data;
    }
    if (message) {
      response.message = message;
    }
  } else {
    response.error = error;
    if (message) {
      response.message = message;
    }
  }

  return response;
}

/**
 * Read the contents of a file, optionally specifying line range
 */
export async function readFile(filePath: string, startLine?: number, endLine?: number): Promise<ToolResult> {
  try {
    const resolvedPath = path.resolve(filePath);

    // Check if file exists
    try {
      await fs.promises.access(resolvedPath);
    } catch {
      return createToolResponse(false, undefined, '', 'Error: File not found');
    }

    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) {
      return createToolResponse(false, undefined, '', 'Error: Path is not a file');
    }

    // Check file size (50MB limit)
    if (stats.size > 50 * 1024 * 1024) {
      return createToolResponse(false, undefined, '', 'Error: File too large (max 50MB)');
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n');

    // Handle line range if specified
    if (startLine !== undefined) {
      const startIdx = Math.max(0, startLine - 1); // Convert to 0-indexed
      let endIdx = lines.length;

      if (endLine !== undefined) {
        endIdx = Math.min(lines.length, endLine);
      }

      if (startIdx >= lines.length) {
        return createToolResponse(false, undefined, '', 'Error: Start line exceeds file length');
      }

      const selectedLines = lines.slice(startIdx, endIdx);
      const selectedContent = selectedLines.join('\n');
      // Add file to read tracking for partial reads too
      readFiles.add(resolvedPath);
      const message = `Read lines ${startLine}-${endIdx} from ${filePath}`;

      return createToolResponse(true, selectedContent, message);
    } else {
      // Add file to read tracking
      readFiles.add(resolvedPath);
      const message = `Read ${lines.length} lines from ${filePath}`;
      return createToolResponse(true, content, message);
    }

  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return createToolResponse(false, undefined, '', 'Error: File not found');
    }
    return createToolResponse(false, undefined, '', 'Error: Failed to read file');
  }
}

/**
 * Create a new file or directory with specified content
 */
export async function createFile(filePath: string, content: string, fileType: string = 'file', overwrite: boolean = false): Promise<ToolResult> {
  try {
    const targetPath = path.resolve(filePath);

    // Check if file exists and handle overwrite
    const exists = await fs.promises.access(targetPath).then(() => true).catch(() => false);
    if (exists && !overwrite) {
      return createToolResponse(false, undefined, '', 'Error: File already exists, use overwrite=true');
    }

    if (fileType === 'directory') {
      const result = await createDirectory(targetPath);
      if (result) {
        return createToolResponse(true, { path: targetPath, type: 'directory' }, `Directory created: ${filePath}`);
      } else {
        return createToolResponse(false, undefined, '', 'Error: Failed to create directory');
      }
    } else if (fileType === 'file') {
      const result = await writeFile(targetPath, content, overwrite, true);
      if (result) {
        return createToolResponse(true, undefined, `File created: ${filePath}`);
      } else {
        return createToolResponse(false, undefined, '', 'Error: Failed to create file');
      }
    } else {
      return createToolResponse(false, undefined, '', "Error: Invalid file_type, must be 'file' or 'directory'");
    }

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to create file or directory');
  }
}

/**
 * Edit a file by replacing exact text strings
 * Note: Arguments are pre-validated by the validation system before this function is called
 */
export async function editFile(filePath: string, oldText: string, newText: string, replaceAll: boolean = false): Promise<ToolResult> {
  try {
    const resolvedPath = path.resolve(filePath);

    // Read current content (validation already confirmed file exists and was read)
    const originalContent = await fs.promises.readFile(resolvedPath, 'utf-8');

    // Perform the replacement (validation already confirmed old_text exists and is unambiguous)
    let updatedContent: string;
    if (replaceAll) {
      updatedContent = originalContent.split(oldText).join(newText);
    } else {
      updatedContent = originalContent.replace(oldText, newText);
    }

    // Write the updated content
    const result = await writeFile(filePath, updatedContent, true, true);
    if (result) {
      const replacementCount = replaceAll ? 
        (originalContent.split(oldText).length - 1) : 1;
      return createToolResponse(true, undefined, `Replaced ${replacementCount} occurrence(s) in ${filePath}`);
    } else {
      return createToolResponse(false, undefined, '', 'Error: Failed to write changes to file');
    }

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to edit file - ${error}`);
  }
}

/**
 * Delete a file or directory with safety checks
 */
export async function deleteFile(filePath: string, recursive: boolean = false): Promise<ToolResult> {
  try {
    const targetPath = path.resolve(filePath);
    const currentWorkingDir = path.resolve(process.cwd());

    // Safety check 1: Never delete the root directory itself
    if (targetPath === currentWorkingDir) {
      return createToolResponse(false, undefined, '', 'Error: Cannot delete the root project directory');
    }

    // Safety check 2: Never delete anything outside the current working directory
    if (!targetPath.startsWith(currentWorkingDir)) {
      return createToolResponse(false, undefined, '', 'Error: Cannot delete files outside the project directory');
    }

    const exists = await fs.promises.access(targetPath).then(() => true).catch(() => false);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: Path not found');
    }

    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory() && !recursive) {
      // Check if directory is empty
      const items = await fs.promises.readdir(targetPath);
      if (items.length > 0) {
        return createToolResponse(false, undefined, '', 'Error: Directory not empty, use recursive=true');
      }
    }

    // Perform deletion
    if (stats.isDirectory()) {
      await fs.promises.rmdir(targetPath, { recursive });
    } else {
      await fs.promises.unlink(targetPath);
    }

    const fileType = stats.isDirectory() ? 'directory' : 'file';
    return createToolResponse(true, undefined, `Deleted ${fileType}: ${filePath}`);

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to delete');
  }
}

/**
 * List files and directories in a path with tree-style display
 */
export async function listFiles(directory: string = '.', pattern: string = '*', recursive: boolean = false, showHidden: boolean = false): Promise<ToolResult> {
  try {
    const dirPath = path.resolve(directory);

    const exists = await fs.promises.access(dirPath).then(() => true).catch(() => false);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: Directory not found');
    }

    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      return createToolResponse(false, undefined, '', 'Error: Path is not a directory');
    }

    // Get tree display output
    const treeOutput = await displayTree(directory, pattern, recursive, showHidden);

    return createToolResponse(true, treeOutput, `Listed ${directory}`);

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to list files');
  }
}

/**
 * Search for text patterns in files with advanced filtering and matching options
 */
export async function searchFiles(
  pattern: string,
  filePattern: string = '*',
  directory: string = '.',
  caseSensitive: boolean = false,
  patternType: 'substring' | 'regex' | 'exact' | 'fuzzy' = 'substring',
  fileTypes?: string[],
  excludeDirs?: string[],
  excludeFiles?: string[],
  maxResults: number = 100,
  contextLines: number = 0,
  groupByFile: boolean = false
): Promise<ToolResult> {
  try {
    const searchDir = path.resolve(directory);

    // Check if directory exists
    const exists = await fs.promises.access(searchDir).then(() => true).catch(() => false);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: Directory not found');
    }

    const stats = await fs.promises.stat(searchDir);
    if (!stats.isDirectory()) {
      return createToolResponse(false, undefined, '', 'Error: Path is not a directory');
    }

    // Default exclusions
    const defaultExcludeDirs = ['.git', 'node_modules', '.next', 'dist', 'build', '.cache'];
    const defaultExcludeFiles = ['*.log', '*.tmp', '*.cache', '*.lock'];
    
    const finalExcludeDirs = [...defaultExcludeDirs, ...(excludeDirs || [])];
    const finalExcludeFiles = [...defaultExcludeFiles, ...(excludeFiles || [])];

    // Prepare search regex
    let searchRegex: RegExp;
    try {
      switch (patternType) {
        case 'exact':
          searchRegex = new RegExp(escapeRegex(pattern), caseSensitive ? 'g' : 'gi');
          break;
        case 'regex':
          searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
          break;
        case 'fuzzy':
          // Simple fuzzy search, insert .* between characters
          const fuzzyPattern = pattern.split('').map(escapeRegex).join('.*');
          searchRegex = new RegExp(fuzzyPattern, caseSensitive ? 'g' : 'gi');
          break;
        case 'substring':
        default:
          searchRegex = new RegExp(escapeRegex(pattern), caseSensitive ? 'g' : 'gi');
          break;
      }
    } catch (error) {
      return createToolResponse(false, undefined, '', 'Error: Invalid regex pattern');
    }

    // Collect all files to search
    const filesToSearch = await collectFiles(searchDir, filePattern, fileTypes, finalExcludeDirs, finalExcludeFiles);

    if (filesToSearch.length === 0) {
      return createToolResponse(true, [], 'No files found matching criteria');
    }

    // Search through files
    const results: SearchResult[] = [];
    let totalMatches = 0;

    for (const filePath of filesToSearch) {
      if (totalMatches >= maxResults) {
        break;
      }

      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const fileMatches: SearchMatch[] = [];

        for (let i = 0; i < lines.length && totalMatches < maxResults; i++) {
          const line = lines[i];
          const matches = Array.from(line.matchAll(searchRegex));

          if (matches.length > 0) {
            const contextStart = Math.max(0, i - contextLines);
            const contextEnd = Math.min(lines.length - 1, i + contextLines);
            
            const contextLinesArray: string[] = [];
            for (let j = contextStart; j <= contextEnd; j++) {
              contextLinesArray.push(lines[j]);
            }

            fileMatches.push({
              lineNumber: i + 1,
              lineContent: line,
              contextLines: contextLines > 0 ? contextLinesArray : undefined,
              matchPositions: matches.map(match => ({
                start: match.index || 0,
                end: (match.index || 0) + match[0].length,
                text: match[0]
              }))
            });

            totalMatches++;
          }
        }

        if (fileMatches.length > 0) {
          results.push({
            filePath: path.relative(process.cwd(), filePath),
            matches: fileMatches,
            totalMatches: fileMatches.length
          });
        }

      } catch (error) {
        // Skip files that can't be read (binary files, permission issues, etc.)
        continue;
      }
    }

    // Format results
    let formattedResults: any;
    if (groupByFile) {
      formattedResults = results;
    } else {
      // Flatten results
      formattedResults = results.flatMap(fileResult => 
        fileResult.matches.map(match => ({
          filePath: fileResult.filePath,
          lineNumber: match.lineNumber,
          lineContent: match.lineContent,
          contextLines: match.contextLines,
          matchPositions: match.matchPositions
        }))
      );
    }

    const message = `Found ${totalMatches} match(es) in ${results.length} file(s)`;
    return createToolResponse(true, formattedResults, message);

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to search files');
  }
}

// Helper interfaces for search results
interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  contextLines?: string[];
  matchPositions: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
  totalMatches: number;
}

// Helper function to escape regex special characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to collect files based on patterns and filters
async function collectFiles(
  directory: string,
  filePattern: string,
  fileTypes?: string[],
  excludeDirs?: string[],
  excludeFiles?: string[]
): Promise<string[]> {
  const files: string[] = [];

  async function walkDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Check if directory should be excluded
          if (excludeDirs && excludeDirs.some(pattern => matchesPattern(entry.name, pattern))) {
            continue;
          }
          // Skip hidden directories unless explicitly included
          if (entry.name.startsWith('.') && !entry.name.match(/^\.(config|env)$/)) {
            continue;
          }
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check file type filters
          if (fileTypes && fileTypes.length > 0) {
            const ext = path.extname(entry.name).slice(1);
            if (!fileTypes.includes(ext)) {
              continue;
            }
          }

          // Check file pattern
          if (!matchesPattern(entry.name, filePattern)) {
            continue;
          }

          // Check exclusions
          if (excludeFiles && excludeFiles.some(pattern => matchesPattern(entry.name, pattern))) {
            continue;
          }

          // Skip obviously binary files
          if (isBinaryFile(entry.name)) {
            continue;
          }

          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await walkDirectory(directory);
  return files;
}

// Helper function to match glob-like patterns
function matchesPattern(filename: string, pattern: string): boolean {
  if (pattern === '*') return true;
  
  // Simple glob matching, convert * to .* and ? to .
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regexPattern}$`, 'i').test(filename);
}

// Helper function to detect binary files
function isBinaryFile(filename: string): boolean {
  const binaryExtensions = [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
  ];
  
  const ext = path.extname(filename).toLowerCase();
  return binaryExtensions.includes(ext);
}


/**
 * Execute a shell command or run code
 */
export async function executeCommand(command: string, commandType: string, workingDirectory?: string, timeout: number = 30000): Promise<ToolResult> {
  try {
    // Validate command type
    if (!['bash', 'python', 'setup', 'run'].includes(commandType)) {
      return createToolResponse(false, undefined, '', 'Error: Invalid command_type');
    }

    let originalCwd: string | undefined;
    if (workingDirectory) {
      const wdPath = path.resolve(workingDirectory);
      const exists = await fs.promises.access(wdPath).then(() => true).catch(() => false);
      if (!exists) {
        return createToolResponse(false, undefined, '', 'Error: Working directory not found');
      }
      originalCwd = process.cwd();
      process.chdir(workingDirectory);
    }

    try {
      let execCommand: string;
      if (commandType === 'python') {
        execCommand = `python -c "${command.replace(/"/g, '\\"')}"`;
      } else {
        execCommand = command;
      }

      const { stdout, stderr } = await execAsync(execCommand, { timeout });
      const success = true; // If no error was thrown, consider it successful

      return createToolResponse(
        success,
        `stdout: ${stdout}\nstderr: ${stderr}`,
        `Command executed successfully`
      );

    } finally {
      // Restore original working directory
      if (originalCwd) {
        process.chdir(originalCwd);
      }
    }

  } catch (error: any) {
    const isTimeout = error.killed && error.signal === 'SIGTERM';
    if (isTimeout) {
      return createToolResponse(false, undefined, '', 'Error: Command timed out');
    }
    return createToolResponse(false, undefined, '', 'Error: Failed to execute command');
  }
}

/**
 * Create a task list of subtasks to complete the user's request
 */
export async function createTasks(userQuery: string, tasks: Task[]): Promise<ToolResult> {
  try {
    // Validate task structure
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.id || !task.description) {
        return createToolResponse(false, undefined, '', `Error: Task ${i} missing required fields (id, description)`);
      }

      // Set default status if not provided
      if (!task.status) {
        task.status = 'pending';
      }

      // Validate status
      if (!['pending', 'in_progress', 'completed'].includes(task.status)) {
        return createToolResponse(false, undefined, '', `Error: Invalid status '${task.status}' for task ${task.id}`);
      }
    }

    // Store the task list globally
    currentTaskList = {
      user_query: userQuery,
      tasks: tasks,
      created_at: new Date().toISOString()
    };


    // Return a deep copy to prevent mutation of historical displays
    const snapshot = {
      user_query: currentTaskList.user_query,
      tasks: currentTaskList.tasks.map(task => ({ ...task })),
      created_at: currentTaskList.created_at
    };

    return createToolResponse(
      true,
      snapshot,
      `Created task list with ${tasks.length} tasks for: ${userQuery}`
    );

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to create tasks - ${error}`);
  }
}

/**
 * Update the status of one or more tasks in the task list
 */
export async function updateTasks(taskUpdates: TaskUpdate[]): Promise<ToolResult> {
  try {
    if (!currentTaskList) {
      return createToolResponse(false, undefined, '', 'Error: No task list exists. Create tasks first.');
    }

    // Track updates made
    const updatesMade: Array<{
      id: string;
      description: string;
      old_status: string;
      new_status: string;
    }> = [];

    for (const update of taskUpdates) {
      if (!update.id || !update.status) {
        return createToolResponse(false, undefined, '', 'Error: Task update missing required fields (id, status)');
      }

      // Validate status
      if (!['pending', 'in_progress', 'completed'].includes(update.status)) {
        return createToolResponse(false, undefined, '', `Error: Invalid status '${update.status}'`);
      }

      // Find and update the task
      let taskFound = false;
      for (const task of currentTaskList.tasks) {
        if (task.id === update.id) {
          const oldStatus = task.status;
          task.status = update.status;

          // Add notes if provided
          if (update.notes) {
            task.notes = update.notes;
          }

          // Add update timestamp
          task.updated_at = new Date().toISOString();

          updatesMade.push({
            id: update.id,
            description: task.description,
            old_status: oldStatus,
            new_status: update.status
          });
          taskFound = true;
          break;
        }
      }

      if (!taskFound) {
        return createToolResponse(false, undefined, '', `Error: Task '${update.id}' not found`);
      }
    }

    // Return a deep copy to prevent mutation of historical displays
    const snapshot = {
      user_query: currentTaskList.user_query,
      tasks: currentTaskList.tasks.map(task => ({ ...task })),
      created_at: currentTaskList.created_at
    };

    return createToolResponse(
      true,
      snapshot,
      `Updated ${updatesMade.length} task(s)`
    );

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to update tasks - ${error}`);
  }
}

// Tool Registry: maps tool names to functions
export const TOOL_REGISTRY = {
  read_file: readFile,
  create_file: createFile,
  edit_file: editFile,
  delete_file: deleteFile,
  list_files: listFiles,
  search_files: searchFiles,
  execute_command: executeCommand,
  create_tasks: createTasks,
  update_tasks: updateTasks,
  plan_tasks: planTasks,
  execute_next_task: executeNextTask,
};

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(toolName: string, toolArgs: Record<string, any>): Promise<ToolResult> {
  if (!(toolName in TOOL_REGISTRY)) {
    return createToolResponse(false, undefined, '', 'Error: Unknown tool');
  }

  try {
    const toolFunction = (TOOL_REGISTRY as any)[toolName];
    
    // Call the function with the appropriate arguments based on the tool
    switch (toolName) {
      case 'read_file':
        return await toolFunction(toolArgs.file_path, toolArgs.start_line, toolArgs.end_line);
      case 'create_file':
        return await toolFunction(toolArgs.file_path, toolArgs.content, toolArgs.file_type, toolArgs.overwrite);
      case 'edit_file':
        return await toolFunction(toolArgs.file_path, toolArgs.old_text, toolArgs.new_text, toolArgs.replace_all);
      case 'delete_file':
        return await toolFunction(toolArgs.file_path, toolArgs.recursive);
      case 'list_files':
        return await toolFunction(toolArgs.directory, toolArgs.pattern, toolArgs.recursive, toolArgs.show_hidden);
      case 'search_files':
        return await toolFunction(
          toolArgs.pattern,
          toolArgs.file_pattern,
          toolArgs.directory,
          toolArgs.case_sensitive,
          toolArgs.pattern_type,
          toolArgs.file_types,
          toolArgs.exclude_dirs,
          toolArgs.exclude_files,
          toolArgs.max_results,
          toolArgs.context_lines,
          toolArgs.group_by_file
        );
      case 'execute_command':
        return await toolFunction(toolArgs.command, toolArgs.command_type, toolArgs.working_directory, toolArgs.timeout);
      case 'create_tasks':
        return await toolFunction(toolArgs.user_query, toolArgs.tasks);
      case 'update_tasks':
        return await toolFunction(toolArgs.task_updates);
      case 'plan_tasks':
        return await toolFunction(toolArgs.user_query);
      case 'execute_next_task':
        return await toolFunction();
      default:
        return createToolResponse(false, undefined, '', 'Error: Tool not implemented');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return createToolResponse(false, undefined, '', 'Error: Invalid tool arguments');
    }
    return createToolResponse(false, undefined, '', 'Error: Unexpected tool error');
  }
}