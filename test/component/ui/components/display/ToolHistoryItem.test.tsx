import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, cleanup } from '@testing-library/react';
import ToolHistoryItem from '@src/ui/components/display/ToolHistoryItem';
import { ToolExecution } from '@src/ui/hooks/useAgent';

// Setup afterEach cleanup
test.afterEach.always(() => {
  cleanup();
  sinon.restore();
});

// Mock setup
const mockFormatToolParams = sinon.stub().callsFake((toolName, args, options) => {
  if (toolName === 'read_file') return `file_path: "${args.file_path}"`;
  if (toolName === 'edit_file') return `file_path: "${args.file_path}"`;
  if (toolName === 'execute_command') return `command: "${args.command}"`;
  return '';
});

test('ToolHistoryItem - should render tool name and status', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'read_file',
    status: 'completed',
    args: { file_path: '/test/file.txt' },
    result: 'File content'
  } as any;

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.truthy(getByText('read_file'));
  t.truthy(getByText('🟢'));
});

test('ToolHistoryItem - should render formatted tool parameters', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'edit_file',
    status: 'completed',
    args: { file_path: '/test/file.txt' },
    result: 'File edited'
  } as any;

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.true(mockFormatToolParams.calledWith(
    'edit_file',
    { file_path: '/test/file.txt' },
    { includePrefix: false, separator: ': ' }
  ));
  t.truthy(getByText('file_path: "/test/file.txt"'));
});

test('ToolHistoryItem - should not render parameters when formatToolParams returns empty', (t) => {
  mockFormatToolParams.returns('');
  
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'unknown_tool',
    status: 'completed',
    args: {},
    result: { success: true, content: 'Done' }
  };

  const { queryAllByTestId } = render(<ToolHistoryItem execution={execution} />);
  
  // The component should still render but without parameters
  t.true(mockFormatToolParams.called);
  // Check that no gray text with parameters is rendered
  const texts = queryAllByTestId('text');
  const grayTexts = texts.filter(el => el.getAttribute('data-color') === 'gray');
  t.is(grayTexts.length, 0);
});

test('ToolHistoryItem - should show success indicator for successful tools', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'completed',
    args: { command: 'ls -la' },
    result: 'Command output'
  };

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.truthy(getByText('🟢'));
});

test('ToolHistoryItem - should show error indicator for failed tools', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'failed',
    args: { command: 'invalid-command' },
    result: 'Command not found'
  };

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.truthy(getByText('🔴'));
});

test('ToolHistoryItem - should show pending indicator for pending tools', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'pending',
    args: { command: 'long-running-command' },
    result: ''
  };

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.truthy(getByText('?'));
});

test('ToolHistoryItem - should show diff preview for edit_file', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'edit_file',
    status: 'completed',
    args: { 
      file_path: '/test/file.txt',
      old_text: 'old content',
      new_text: 'new content'
    },
    result: 'File edited'
  };

  const { getByTestId } = render(<ToolHistoryItem execution={execution} />);
  
  const diffPreview = getByTestId('diff-preview');
  t.truthy(diffPreview);
  t.true(diffPreview.textContent!.includes('Tool: edit_file'));
  t.true(diffPreview.textContent!.includes('Historical: true'));
});

test('ToolHistoryItem - should show diff preview for create_file', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'create_file',
    status: 'completed',
    args: { 
      file_path: '/test/new-file.txt',
      content: 'new file content'
    },
    result: 'File created'
  };

  const { getByTestId } = render(<ToolHistoryItem execution={execution} />);
  
  const diffPreview = getByTestId('diff-preview');
  t.truthy(diffPreview);
  t.true(diffPreview.textContent!.includes('Tool: create_file'));
});

test('ToolHistoryItem - should not show diff preview for non-file operations', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'completed',
    args: { command: 'ls -la' },
    result: 'Command output'
  };

  const { queryByTestId } = render(<ToolHistoryItem execution={execution} />);
  
  t.falsy(queryByTestId('diff-preview'));
});

test('ToolHistoryItem - should display result text for successful tools', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'completed',
    args: { command: 'echo test' },
    result: { success: true, content: 'This is the command output' }
  } as any;

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.truthy(getByText('This is the command output'));
});

test('ToolHistoryItem - should display error message for failed tools', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'read_file',
    status: 'failed',
    args: { file_path: '/nonexistent.txt' },
    result: { error: 'File not found' }
  } as any;

  const { getByText } = render(<ToolHistoryItem execution={execution} />);
  
  t.truthy(getByText('Tool execution failed'));
});

test('ToolHistoryItem - should handle empty results', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'completed',
    args: { command: 'touch file.txt' },
    result: ''
  };

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Component should render without crashing
  t.truthy(container);
});

test('ToolHistoryItem - should handle very long results', (t) => {
  const longResult = 'a'.repeat(1000);
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'execute_command',
    status: 'completed',
    args: { command: 'cat largefile' },
    result: { success: true, content: longResult }
  } as any;

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Should render the long result
  t.true(container.textContent!.includes('aaaa'));
});

test('ToolHistoryItem - should handle undefined tool status', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'some_tool',
    status: undefined as any,
    args: {},
    result: 'Result'
  };

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Should render without crashing
  t.truthy(container);
});

test('ToolHistoryItem - should handle null result', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'some_tool',
    status: 'completed',
    args: {},
    result: null as any
  };

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Should render without crashing
  t.truthy(container);
});

test('ToolHistoryItem - should handle missing args', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'some_tool',
    status: 'completed',
    args: undefined as any,
    result: 'Result'
  };

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Should render without crashing
  t.truthy(container);
});

test('ToolHistoryItem - should handle complex nested args', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'complex_tool',
    status: 'completed',
    args: {
      nested: {
        deep: {
          value: 'test'
        }
      },
      array: [1, 2, 3]
    },
    result: 'Processed'
  };

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Should render without crashing
  t.truthy(container);
});

test('ToolHistoryItem - should apply correct colors for status', (t) => {
  const successTool: ToolExecution = {
    id: 'test-id',
    name: 'test',
    status: 'completed',
    args: {},
    result: 'ok'
  };

  const { container } = render(<ToolHistoryItem execution={successTool} />);
  
  const successIndicator = container.querySelector('[data-color="green"]');
  t.truthy(successIndicator);
});

test('ToolHistoryItem - should apply dimmed style to result text', (t) => {
  const execution: ToolExecution = {
    id: 'test-id',
    name: 'test',
    status: 'completed',
    args: {},
    result: { success: true, message: 'Some result message' }
  } as any;

  const { container } = render(<ToolHistoryItem execution={execution} />);
  
  // Check for gray colored text which is used for messages
  const grayText = container.querySelector('[data-color="gray"]');
  t.truthy(grayText);
});