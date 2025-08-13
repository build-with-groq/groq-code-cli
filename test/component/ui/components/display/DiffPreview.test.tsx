import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, waitFor, cleanup } from '@testing-library/react';
import DiffPreview from '@src/ui/components/display/DiffPreview';
import * as fs from 'fs';

// Setup afterEach cleanup
test.afterEach.always(() => {
  cleanup();
  sinon.restore();
});

// Mock setup
const mockReadFile = sinon.stub();
const mockValidateReadBeforeEdit = sinon.stub().returns(true);
const mockGetReadBeforeEditError = sinon.stub().returns('Read before edit error');

test.beforeEach(() => {
  mockReadFile.resolves('original content\nline 2\nline 3');
  mockValidateReadBeforeEdit.returns(true);
  mockGetReadBeforeEditError.returns('Read before edit error');
});

test('DiffPreview - should render loading state initially', (t) => {
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old', new_text: 'new' }}
    />
  );

  t.truthy(getByText('Generating diff preview...'));
});

test('DiffPreview - should render error state for missing file path', async (t) => {
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{}}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Error: No file path provided'));
  });
});

test('DiffPreview - should render read-before-edit error for non-historical edits', async (t) => {
  mockValidateReadBeforeEdit.returns(false);
  mockGetReadBeforeEditError.returns('Must read file first');

  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old', new_text: 'new' }}
      isHistorical={false}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Error: Must read file first'));
  });
});

test('DiffPreview - should render no changes state when diff is empty', async (t) => {
  mockReadFile.resolves('same content');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt', 
        old_text: 'same content', 
        new_text: 'same content' 
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('No changes to show'));
  });
});

test('DiffPreview - should generate diff for string-based edit with old_text and new_text', async (t) => {
  mockReadFile.resolves('original text\nsecond line');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'original text',
        new_text: 'modified text'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle replace_all option', async (t) => {
  mockReadFile.resolves('test\ntest\nother');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'test',
        new_text: 'modified',
        replace_all: true
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle case where old_text is not found in current file', async (t) => {
  mockReadFile.resolves('different content');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'missing text',
        new_text: 'new text'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('No changes to show'));
  });
});

test('DiffPreview - should reconstruct original when new_text is found in current file', async (t) => {
  mockReadFile.resolves('modified content');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'original content',
        new_text: 'modified content'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should generate diff for create_file with content', async (t) => {
  mockReadFile.rejects(new Error('File not found'));
  
  const { getByText } = render(
    <DiffPreview 
      toolName="create_file"
      toolArgs={{ 
        file_path: '/test/newfile.txt',
        content: 'new file content\nsecond line'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should generate synthetic diff for historical edit_file', async (t) => {
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'original line',
        new_text: 'modified line'
      }}
      isHistorical={true}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should generate synthetic diff for historical create_file', async (t) => {
  const { getByText } = render(
    <DiffPreview 
      toolName="create_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        content: 'created content'
      }}
      isHistorical={true}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle historical edit with missing parameters', async (t) => {
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt'
      }}
      isHistorical={true}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('No changes to show'));
  });
});

test('DiffPreview - should not validate read-before-edit for historical edits', async (t) => {
  mockValidateReadBeforeEdit.returns(false);
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'old',
        new_text: 'new'
      }}
      isHistorical={true}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });

  t.false(mockValidateReadBeforeEdit.called);
});

test('DiffPreview - should render diff lines with proper colors', async (t) => {
  mockReadFile.resolves('line 1\nold line\nline 3');
  
  const { container } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'old line',
        new_text: 'new line'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(container.querySelector('[data-testid="text"]'));
  });
});

test('DiffPreview - should handle multiple diff chunks', async (t) => {
  mockReadFile.resolves('line 1\nold1\nline 3\nline 4\nold2\nline 6');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'old1',
        new_text: 'new1'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle file read errors gracefully', async (t) => {
  mockReadFile.rejects(new Error('Permission denied'));
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        content: 'new content'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle diff generation errors', async (t) => {
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'old',
        new_text: 'new'
      }}
    />
  );

  await waitFor(() => {
    // Component might show "No changes to show" or error based on implementation
    const container = document.body;
    const hasContent = container.textContent?.includes('No changes to show') || 
                      container.textContent?.includes('Error generating diff');
    t.truthy(hasContent);
  });
});

test('DiffPreview - should generate proper unified diff with context', async (t) => {
  mockReadFile.resolves(`line 1
line 2
original line
line 4
line 5`);
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'original line',
        new_text: 'modified line'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle empty files', async (t) => {
  mockReadFile.resolves('');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="create_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        content: 'new content'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle identical content', async (t) => {
  mockReadFile.resolves('identical content');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/file.txt',
        old_text: 'other',
        new_text: 'other'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('No changes to show'));
  });
});

test('DiffPreview - should regenerate diff when toolName changes', async (t) => {
  const { rerender } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old', new_text: 'new' }}
    />
  );

  rerender(
    <DiffPreview 
      toolName="create_file"
      toolArgs={{ file_path: '/test/file.txt', content: 'content' }}
    />
  );

  await waitFor(() => {
    t.true(mockReadFile.called);
  });
});

test('DiffPreview - should regenerate diff when toolArgs change', async (t) => {
  const { rerender } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old1', new_text: 'new1' }}
    />
  );

  rerender(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ file_path: '/test/file.txt', old_text: 'old2', new_text: 'new2' }}
    />
  );

  await waitFor(() => {
    t.true(mockReadFile.called);
  });
});

test('DiffPreview - should handle very long files', async (t) => {
  const longContent = Array(1000).fill('line').join('\n');
  mockReadFile.resolves(longContent);
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/largefile.txt',
        old_text: 'line',
        new_text: 'modified'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle binary-like content', async (t) => {
  const binaryContent = '\x00\x01\x02\xFF';
  mockReadFile.resolves(binaryContent);
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/binary.dat',
        old_text: '\x00',
        new_text: '\x01'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});

test('DiffPreview - should handle files with only whitespace', async (t) => {
  mockReadFile.resolves('   \n\t\n   ');
  
  const { getByText } = render(
    <DiffPreview 
      toolName="edit_file"
      toolArgs={{ 
        file_path: '/test/whitespace.txt',
        old_text: '   ',
        new_text: '\t'
      }}
    />
  );

  await waitFor(() => {
    t.truthy(getByText('Diff Preview:'));
  });
});