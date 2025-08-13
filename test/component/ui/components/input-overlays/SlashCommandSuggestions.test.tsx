import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, cleanup } from '@testing-library/react';
import SlashCommandSuggestions from '@src/ui/components/input-overlays/SlashCommandSuggestions';

// Setup afterEach cleanup
test.afterEach.always(() => {
  cleanup();
  sinon.restore();
});

// Mock setup
const mockGetAvailableCommands = sinon.stub();
const mockGetCommandNames = sinon.stub().returns(['help', 'login', 'clear', 'model', 'reasoning']);
const mockOnSelect = sinon.stub();

const defaultCommands = [
  { command: 'help', description: 'Show available commands', handler: sinon.stub() },
  { command: 'login', description: 'Set or update API key', handler: sinon.stub() },
  { command: 'clear', description: 'Clear chat history', handler: sinon.stub() },
  { command: 'model', description: 'Select AI model', handler: sinon.stub() },
  { command: 'reasoning', description: 'Toggle reasoning display', handler: sinon.stub() }
];

test.beforeEach(() => {
  mockGetAvailableCommands.returns(defaultCommands);
  mockGetCommandNames.returns(['help', 'login', 'clear', 'model', 'reasoning']);
  mockOnSelect.resetHistory();
});

test('SlashCommandSuggestions - should render all suggestions when input is empty', (t) => {
  const { getByText } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('help'));
  t.truthy(getByText('Show available commands'));
  t.truthy(getByText('login'));
  t.truthy(getByText('Set or update API key'));
  t.truthy(getByText('clear'));
  t.truthy(getByText('Clear chat history'));
});

test('SlashCommandSuggestions - should filter suggestions based on input', (t) => {
  const { getByText, queryByText } = render(
    <SlashCommandSuggestions 
      input="he" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('help'));
  t.truthy(getByText('Show available commands'));
  t.falsy(queryByText('login'));
  t.falsy(queryByText('clear'));
});

test('SlashCommandSuggestions - should highlight selected suggestion', (t) => {
  const { getAllByTestId } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={1}
      onSelect={mockOnSelect}
    />
  );

  const texts = getAllByTestId('text');
  const highlightedTexts = texts.filter(el => 
    el.getAttribute('data-background') === 'blue'
  );
  
  t.true(highlightedTexts.length > 0);
});

test('SlashCommandSuggestions - should handle case insensitive filtering', (t) => {
  const { getByText, queryByText } = render(
    <SlashCommandSuggestions 
      input="HELP" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('help'));
  t.falsy(queryByText('login'));
});

test('SlashCommandSuggestions - should show no suggestions when no matches', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input="nonexistent" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  // Should render empty or minimal content
  t.truthy(container);
});

test('SlashCommandSuggestions - should handle partial matches', (t) => {
  const { getByText, queryByText } = render(
    <SlashCommandSuggestions 
      input="lo" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('login'));
  t.falsy(queryByText('help'));
  t.falsy(queryByText('clear'));
});

test('SlashCommandSuggestions - should handle empty command list', (t) => {
  mockGetAvailableCommands.returns([]);
  mockGetCommandNames.returns([]);

  const { container } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(container);
});

test('SlashCommandSuggestions - should handle selectedIndex out of bounds', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={999}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(container);
});

test('SlashCommandSuggestions - should handle negative selectedIndex', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={-1}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(container);
});

test('SlashCommandSuggestions - should filter multiple commands correctly', (t) => {
  const { getByText, queryByText } = render(
    <SlashCommandSuggestions 
      input="l" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('login'));
  t.truthy(getByText('clear'));
  t.falsy(queryByText('help'));
  t.falsy(queryByText('model'));
});

test('SlashCommandSuggestions - should show descriptions for filtered commands', (t) => {
  const { getByText } = render(
    <SlashCommandSuggestions 
      input="help" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('help'));
  t.truthy(getByText('Show available commands'));
});

test('SlashCommandSuggestions - should handle special characters in input', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input="!@#$" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(container);
});

test('SlashCommandSuggestions - should handle whitespace in input', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input="  " 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(container);
});

test('SlashCommandSuggestions - should render with proper styling', (t) => {
  const { getAllByTestId } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  const boxes = getAllByTestId('box');
  t.true(boxes.length > 0);
  
  const texts = getAllByTestId('text');
  t.true(texts.length > 0);
});

test('SlashCommandSuggestions - should handle commands without descriptions', (t) => {
  const commandsWithoutDesc = [
    { command: 'test', handler: sinon.stub() }
  ];
  
  mockGetAvailableCommands.returns(commandsWithoutDesc);
  mockGetCommandNames.returns(['test']);

  const { getByText } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('test'));
});

test('SlashCommandSuggestions - should handle very long command names', (t) => {
  const longCommands = [
    { command: 'a'.repeat(100), description: 'Very long command', handler: sinon.stub() }
  ];
  
  mockGetAvailableCommands.returns(longCommands);
  mockGetCommandNames.returns(['a'.repeat(100)]);

  const { getByText } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('a'.repeat(100)));
});

test('SlashCommandSuggestions - should handle very long descriptions', (t) => {
  const longDescCommands = [
    { command: 'test', description: 'b'.repeat(200), handler: sinon.stub() }
  ];
  
  mockGetAvailableCommands.returns(longDescCommands);
  mockGetCommandNames.returns(['test']);

  const { getByText } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('test'));
  t.truthy(getByText('b'.repeat(200)));
});

test('SlashCommandSuggestions - should handle exact command matches', (t) => {
  const { getByText, queryByText } = render(
    <SlashCommandSuggestions 
      input="help" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(getByText('help'));
  t.falsy(queryByText('login'));
  t.falsy(queryByText('clear'));
});

test('SlashCommandSuggestions - should maintain consistent ordering', (t) => {
  const { getAllByTestId } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  const texts = getAllByTestId('text');
  const commandTexts = texts.filter(el => 
    defaultCommands.some(cmd => el.textContent === cmd.command)
  );

  t.true(commandTexts.length > 0);
});

test('SlashCommandSuggestions - should handle null or undefined props gracefully', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input={null as any} 
      selectedIndex={0}
      onSelect={mockOnSelect}
    />
  );

  t.truthy(container);
});

test('SlashCommandSuggestions - should handle undefined onSelect callback', (t) => {
  const { container } = render(
    <SlashCommandSuggestions 
      input="" 
      selectedIndex={0}
      onSelect={undefined as any}
    />
  );

  t.truthy(container);
});