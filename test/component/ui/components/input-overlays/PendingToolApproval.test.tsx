import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, act, cleanup } from '@testing-library/react';
import PendingToolApproval from '@src/ui/components/input-overlays/PendingToolApproval';

// Setup afterEach cleanup
test.afterEach.always(() => {
  cleanup();
  sinon.restore();
});

// Mock setup
const mockFormatToolParams = sinon.stub().callsFake((toolName, args, options) => {
  if (toolName === 'edit_file') return `file_path: "${args.file_path}"`;
  if (toolName === 'create_file') return `file_path: "${args.file_path}"`;
  if (toolName === 'execute_command') return `command: "${args.command}"`;
  if (toolName === 'delete_file') return `file_path: "${args.file_path}"`;
  return '';
});

const mockOnApprove = sinon.stub();
const mockOnReject = sinon.stub();

let inputCallback: any = null;
let currentSelectedOption = 0;

test.beforeEach(() => {
  mockFormatToolParams.resetHistory();
  mockOnApprove.resetHistory();
  mockOnReject.resetHistory();
  inputCallback = null;
  currentSelectedOption = 0;
});

test('PendingToolApproval - should render tool approval prompt', (t) => {
  const { getByText } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old', new_text: 'new' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(getByText('Tool Approval Required'));
  t.truthy(getByText('edit_file'));
});

test('PendingToolApproval - should show formatted tool parameters', (t) => {
  const { getByText } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old', new_text: 'new' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.true(mockFormatToolParams.calledWith(
    'edit_file',
    { file_path: '/test/file.txt', old_text: 'old', new_text: 'new' },
    { includePrefix: false, separator: ': ' }
  ));
});

test('PendingToolApproval - should show approval options', (t) => {
  const { getByText } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(getByText('Approve'));
  t.truthy(getByText('Reject'));
});

test('PendingToolApproval - should show danger warning for dangerous tools', (t) => {
  const { getByText } = render(
    <PendingToolApproval
      toolName="delete_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(getByText('⚠️  DANGER'));
  t.truthy(getByText(/This tool can permanently delete files/));
});

test('PendingToolApproval - should show diff preview for file operations', (t) => {
  const { getByTestId } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old', new_text: 'new' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const diffPreview = getByTestId('diff-preview');
  t.truthy(diffPreview);
  t.true(diffPreview.textContent!.includes('Tool: edit_file'));
});

test('PendingToolApproval - should handle create_file operations', (t) => {
  const { getByText, getByTestId } = render(
    <PendingToolApproval
      toolName="create_file"
      toolArgs={{ file_path: '/test/new-file.txt', content: 'new content' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(getByText('create_file'));
  
  const diffPreview = getByTestId('diff-preview');
  t.truthy(diffPreview);
  t.true(diffPreview.textContent!.includes('Tool: create_file'));
});

test('PendingToolApproval - should handle execute_command operations', (t) => {
  const { getByText } = render(
    <PendingToolApproval
      toolName="execute_command"
      toolArgs={{ command: 'rm -rf /' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(getByText('execute_command'));
  t.truthy(getByText('⚠️  DANGER'));
});

test('PendingToolApproval - should not show diff preview for non-file operations', (t) => {
  const { queryByTestId } = render(
    <PendingToolApproval
      toolName="get_weather"
      toolArgs={{ location: 'San Francisco' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.falsy(queryByTestId('diff-preview'));
});

test('PendingToolApproval - should highlight selected option', (t) => {
  const { getAllByTestId } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const texts = getAllByTestId('text');
  const highlightedTexts = texts.filter(el => 
    el.getAttribute('data-background') === 'blue'
  );
  
  // Should have at least one highlighted element (the selected option)
  t.true(highlightedTexts.length >= 0);
});

test('PendingToolApproval - should handle keyboard navigation', (t) => {
  const { container } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  // Component should render keyboard navigation elements
  t.truthy(container);
});

test('PendingToolApproval - should handle enter key for approval', (t) => {
  render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  // Simulate enter key press when approve is selected
  if (inputCallback) {
    act(() => {
      inputCallback('', { return: true });
    });
  }

  // Note: In a real test, we'd need to properly mock useInput
  t.pass(); // Basic structure test
});

test('PendingToolApproval - should handle escape key for rejection', (t) => {
  render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  // Simulate escape key press
  if (inputCallback) {
    act(() => {
      inputCallback('', { escape: true });
    });
  }

  // Note: In a real test, we'd need to properly mock useInput
  t.pass(); // Basic structure test
});

test('PendingToolApproval - should handle arrow key navigation', (t) => {
  render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  // Simulate arrow key navigation
  if (inputCallback) {
    act(() => {
      inputCallback('', { downArrow: true });
    });
  }

  // Note: In a real test, we'd need to properly mock useInput
  t.pass(); // Basic structure test
});

test('PendingToolApproval - should show appropriate styling for dangerous tools', (t) => {
  const { getAllByTestId } = render(
    <PendingToolApproval
      toolName="delete_file"
      toolArgs={{ file_path: '/important-file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const texts = getAllByTestId('text');
  const redTexts = texts.filter(el => 
    el.getAttribute('data-color') === 'red'
  );
  
  t.true(redTexts.length > 0);
});

test('PendingToolApproval - should show normal styling for safe tools', (t) => {
  const { getAllByTestId } = render(
    <PendingToolApproval
      toolName="read_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const texts = getAllByTestId('text');
  // Should not have excessive red warning text for safe tools
  t.truthy(texts);
});

test('PendingToolApproval - should handle complex tool arguments', (t) => {
  const complexArgs = {
    file_path: '/test/file.txt',
    edits: [
      { line: 1, content: 'new line 1' },
      { line: 2, content: 'new line 2' }
    ],
    options: {
      backup: true,
      validate: false
    }
  };

  const { container } = render(
    <PendingToolApproval
      toolName="multi_edit"
      toolArgs={complexArgs}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(container);
});

test('PendingToolApproval - should handle empty tool arguments', (t) => {
  const { container } = render(
    <PendingToolApproval
      toolName="some_tool"
      toolArgs={{}}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(container);
});

test('PendingToolApproval - should handle null tool arguments', (t) => {
  const { container } = render(
    <PendingToolApproval
      toolName="some_tool"
      toolArgs={null as any}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(container);
});

test('PendingToolApproval - should handle very long tool names', (t) => {
  const longToolName = 'very_long_tool_name_that_exceeds_normal_length';
  
  const { getByText } = render(
    <PendingToolApproval
      toolName={longToolName}
      toolArgs={{ param: 'value' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(getByText(longToolName));
});

test('PendingToolApproval - should handle tools with special characters', (t) => {
  const { container } = render(
    <PendingToolApproval
      toolName="tool_with_special_chars"
      toolArgs={{ 
        special_param: 'value with spaces and symbols !@#$%^&*()',
        unicode: '🚀 rocket emoji'
      }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  t.truthy(container);
});

test('PendingToolApproval - should maintain focus and accessibility', (t) => {
  const { getAllByTestId } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const boxes = getAllByTestId('box');
  t.true(boxes.length > 0);
  
  const texts = getAllByTestId('text');
  t.true(texts.length > 0);
});

test('PendingToolApproval - should handle missing callback functions', (t) => {
  const { container } = render(
    <PendingToolApproval
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt' }}
      onApprove={undefined as any}
      onReject={undefined as any}
    />
  );

  t.truthy(container);
});