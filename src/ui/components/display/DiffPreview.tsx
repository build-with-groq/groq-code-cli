import React from 'react';
import { Box, Text } from 'ink';
import * as fs from 'fs';
import * as path from 'path';

interface DiffChunk {
  header: string;
  lines: string[];
}

interface ToolArgs {
  old_text?: string;
  new_text?: string;
  replace_all?: boolean;
  content?: string;
  file_path?: string;
}

interface DiffPreviewProps {
  toolName: string;
  toolArgs: ToolArgs;
  isHistorical?: boolean;
}

export default function DiffPreview({ toolName, toolArgs, isHistorical = false }: DiffPreviewProps) {
  const [diffChunks, setDiffChunks] = React.useState<DiffChunk[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    generateDiff();
  }, [toolName, toolArgs]);

  const generateDiff = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const filePath = toolArgs.file_path;
      if (!filePath) {
        setError('No file path provided');
        return;
      }

      let reconstructedOriginal: string;
      let simulatedContent: string;
      
      if (isHistorical) {
        // For historical edits, generate synthetic diff directly from parameters
        if (toolArgs.old_text !== undefined && toolArgs.new_text !== undefined) {
          // edit_file operation
          reconstructedOriginal = toolArgs.old_text;
          simulatedContent = toolArgs.new_text;
        } else if (toolArgs.content !== undefined) {
          // create_file operation, show as adding all content
          reconstructedOriginal = '';
          simulatedContent = toolArgs.content;
        } else {
          // Fallback
          reconstructedOriginal = '';
          simulatedContent = '';
        }
      } else {
        // For non-historical edits, use the existing file-based logic
        let originalContent = '';
        
        // Read current file content
        try {
          const resolvedPath = path.resolve(filePath);
          originalContent = await fs.promises.readFile(resolvedPath, 'utf-8');
        } catch (error) {
          // File doesn't exist or can't be read, use empty content
        }
        
        reconstructedOriginal = originalContent;
        
        // Handle different operation types
        if (toolArgs.old_text !== undefined && toolArgs.new_text !== undefined) {
          // String-based edit_file operation
          if (!originalContent.includes(toolArgs.old_text)) {
            // If old_text not found, the edit may have already been applied
            // Try to reconstruct the original by reversing the edit
            if (originalContent.includes(toolArgs.new_text)) {
              if (toolArgs.replace_all) {
                reconstructedOriginal = originalContent.split(toolArgs.new_text).join(toolArgs.old_text);
              } else {
                reconstructedOriginal = originalContent.replace(toolArgs.new_text, toolArgs.old_text);
              }
              simulatedContent = originalContent; // Current content is the result
            } else {
              // Neither old nor new text found, show as no changes
              simulatedContent = originalContent;
            }
          } else {
            // old_text found, apply the edit normally
            if (toolArgs.replace_all) {
              simulatedContent = originalContent.split(toolArgs.old_text).join(toolArgs.new_text);
            } else {
              simulatedContent = originalContent.replace(toolArgs.old_text, toolArgs.new_text);
            }
          }
        } else {
          // For create_file or other operations, treat as full content replacement
          simulatedContent = toolArgs.content || '';
        }
      }
      
      // Generate unified diff
      const reconstructedOriginalLines = reconstructedOriginal.split('\n');
      const simulatedLines = simulatedContent.split('\n');
      const diff = generateUnifiedDiff(
        reconstructedOriginalLines,
        simulatedLines,
        `${filePath} (original)`,
        `${filePath} (new)`,
        5 // 5 lines of context
      );
      
      if (diff.length === 0) {
        setDiffChunks([]);
        return;
      }
      
      // Parse diff into chunks for intelligent rendering
      const chunks = parseDiffIntoChunks(diff);
      setDiffChunks(chunks);

    } catch (err) {
      setError(`Error generating diff: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderDiffLine = (line: string, index: number) => {
    if (line.startsWith('+++') || line.startsWith('---')) {
      return (
        <Text key={index} bold color="blue">
          {line}
        </Text>
      );
    } else if (line.startsWith('@@')) {
      return (
        <Text key={index} color="cyan">
          {line}
        </Text>
      );
    } else if (line.startsWith('+')) {
      return (
        <Text key={index} backgroundColor="rgb(124, 214, 114)" color="black">
          + {line.slice(1)}
        </Text>
      );
    } else if (line.startsWith('-')) {
      return (
        <Text key={index} backgroundColor="rgb(214, 114, 114)" color="black">
          - {line.slice(1)}
        </Text>
      );
    } else if (line.startsWith(' ')) {
      return (
        <Text key={index} dimColor>
          {'  ' + line.slice(1)}
        </Text>
      );
    } else {
      return (
        <Text key={index} dimColor>
          {line}
        </Text>
      );
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Text color="yellow">Generating diff preview...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (diffChunks.length === 0) {
    return (
      <Box>
        <Text dimColor>No changes to show</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Diff Preview:</Text>
      {diffChunks.map((chunk, chunkIndex) => (
        <Box key={chunkIndex} flexDirection="column" marginTop={chunkIndex > 0 ? 1 : 0}>
          {chunkIndex > 0 && (
            <Text dimColor>...</Text>
          )}
          {chunk.lines.map((line, lineIndex) => renderDiffLine(line, lineIndex))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Generate a unified diff between two sets of lines
 */
// LCS-based diff algorithm for proper change detection
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }
  
  return lcs;
}

function generateUnifiedDiff(
  originalLines: string[],
  newLines: string[],
  fromFile: string,
  toFile: string,
  context: number = 3
): string[] {
  const result: string[] = [];
  
  if (originalLines.join('\n') === newLines.join('\n')) {
    return result;
  }
  
  // Compute LCS to find actual changes
  const lcs = computeLCS(originalLines, newLines);
  
  // Generate diff operations
  const operations: Array<{type: 'equal' | 'delete' | 'insert', oldLine?: string, newLine?: string, oldIndex?: number, newIndex?: number}> = [];
  
  let i = originalLines.length;
  let j = newLines.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === newLines[j - 1]) {
      operations.unshift({type: 'equal', oldLine: originalLines[i - 1], newLine: newLines[j - 1], oldIndex: i - 1, newIndex: j - 1});
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      operations.unshift({type: 'insert', newLine: newLines[j - 1], newIndex: j - 1});
      j--;
    } else if (i > 0 && (j === 0 || lcs[i][j - 1] < lcs[i - 1][j])) {
      operations.unshift({type: 'delete', oldLine: originalLines[i - 1], oldIndex: i - 1});
      i--;
    }
  }
  
  // Group operations into hunks with context
  const hunks: Array<{
    oldStart: number, oldCount: number, newStart: number, newCount: number,
    operations: typeof operations
  }> = [];
  
  let currentHunk: typeof hunks[0] | null = null;
  
  for (let k = 0; k < operations.length; k++) {
    const op = operations[k];
    
    if (op.type !== 'equal') {
      // Start a new hunk if needed
      if (!currentHunk) {
        const contextStart = Math.max(0, k - context);
        const oldStart = operations[contextStart].oldIndex !== undefined ? operations[contextStart].oldIndex! + 1 : 1;
        const newStart = operations[contextStart].newIndex !== undefined ? operations[contextStart].newIndex! + 1 : 1;
        
        currentHunk = {
          oldStart,
          oldCount: 0,
          newStart,
          newCount: 0,
          operations: operations.slice(contextStart, k + 1)
        };
      } else {
        // Extend current hunk
        currentHunk.operations.push(op);
      }
    } else if (currentHunk) {
      // Add context after changes
      currentHunk.operations.push(op);
      
      // Check if we should close this hunk
      let contextAfter = 0;
      for (let l = k + 1; l < operations.length && l <= k + context; l++) {
        if (operations[l].type === 'equal') {
          contextAfter++;
          currentHunk.operations.push(operations[l]);
        } else {
          break;
        }
      }
      
      // Close hunk if no more changes within context
      let hasMoreChanges = false;
      for (let l = k + contextAfter + 1; l < Math.min(operations.length, k + context * 2); l++) {
        if (operations[l].type !== 'equal') {
          hasMoreChanges = true;
          break;
        }
      }
      
      if (!hasMoreChanges) {
        // Calculate counts
        currentHunk.oldCount = currentHunk.operations.filter(op => op.type === 'equal' || op.type === 'delete').length;
        currentHunk.newCount = currentHunk.operations.filter(op => op.type === 'equal' || op.type === 'insert').length;
        
        hunks.push(currentHunk);
        currentHunk = null;
        k += contextAfter; // Skip the context we already processed
      }
    }
  }
  
  // Close any remaining hunk
  if (currentHunk) {
    currentHunk.oldCount = currentHunk.operations.filter(op => op.type === 'equal' || op.type === 'delete').length;
    currentHunk.newCount = currentHunk.operations.filter(op => op.type === 'equal' || op.type === 'insert').length;
    hunks.push(currentHunk);
  }
  
  // Generate unified diff output
  result.push(`--- ${fromFile}`);
  result.push(`+++ ${toFile}`);
  
  for (const hunk of hunks) {
    result.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
    
    for (const op of hunk.operations) {
      if (op.type === 'equal') {
        result.push(` ${op.oldLine}`);
      } else if (op.type === 'delete') {
        result.push(`-${op.oldLine}`);
      } else if (op.type === 'insert') {
        result.push(`+${op.newLine}`);
      }
    }
  }
  
  return result;
}

/**
 * Parse diff lines into chunks
 */
function parseDiffIntoChunks(diffLines: string[]): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let currentChunk: DiffChunk | null = null;
  
  for (const line of diffLines) {
    if (line.startsWith('@@')) {
      // New chunk marker
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = { header: line, lines: [line] };
    } else if (currentChunk) {
      currentChunk.lines.push(line);
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}