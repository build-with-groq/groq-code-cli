import * as fs from 'fs';
import * as path from 'path';
import { IGNORE_PATTERNS } from './constants.js';

/**
 * Write content to a file with safety checks
 */
export async function writeFile(filepath: string, content: string, force: boolean = false, backup: boolean = false): Promise<boolean> {
  try {
    const filePath = path.resolve(filepath);
    
    // Create parent directories if they don't exist
    const parentDir = path.dirname(filePath);
    await fs.promises.mkdir(parentDir, { recursive: true });
    
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a directory with parent directories
 */
export async function createDirectory(directoryPath: string): Promise<boolean> {
  try {
    await fs.promises.mkdir(directoryPath, { recursive: true });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a file with safety checks
 */
export async function deleteFile(filepath: string, force: boolean = false): Promise<boolean> {
  const filePath = path.resolve(filepath);
  
  try {
    const stats = await fs.promises.stat(filePath);
    
    if (!force) {
      return false;
    }
    
    if (stats.isFile()) {
      await fs.promises.unlink(filePath);
    } else if (stats.isDirectory()) {
      await fs.promises.rm(filePath, { recursive: true });
    }
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

/**
 * Simple tree display for list_files tool
 */
export async function displayTree(
  directory: string = '.', 
  showHidden: boolean = false
): Promise<string> {
  const directoryPath = path.resolve(directory);
  
  try {
    const exists = await fs.promises.access(directoryPath).then(() => true).catch(() => false);
    if (!exists) {
      return '';
    }
    
    const items = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    const validItems = items
      .filter(item => !shouldIgnore(path.join(directoryPath, item.name)))
      .filter(item => showHidden || !item.name.startsWith('.'))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    
    let output = `${path.basename(directoryPath)}/\n`;
    
    validItems.forEach((item, index) => {
      const isLast = index === validItems.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      
      if (item.isDirectory()) {
        output += `${prefix}${item.name}/\n`;
      } else {
        output += `${prefix}${item.name}\n`;
      }
    });
    
    return output.trim();
  } catch (error) {
    return '';
  }
}


/**
 * Check if a file or directory should be ignored
 */
export function shouldIgnore(filePath: string): boolean {
  const pathStr = path.resolve(filePath);
  const name = path.basename(pathStr);
  
  // First check if it's an allowed hidden file
  const allowedHiddenFiles = new Set(['.env', '.gitignore', '.dockerfile']);
  if (allowedHiddenFiles.has(name)) {
    return false;
  }
  
  // Check ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.includes('*')) {
      // Simple glob matching, convert * to regex
      const regexPattern = pattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(name)) {
        return true;
      }
    } else {
      // For exact patterns, check if the basename matches or the path contains the pattern as a directory
      if (name === pattern || pathStr.split(path.sep).includes(pattern)) {
        return true;
      }
    }
  }
  
  // Ignore other hidden files and directories (starting with .)
  if (name.startsWith('.')) {
    return true;
  }
  
  return false;
}

