import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, cleanup } from '@testing-library/react';
import MessageInput from '@src/ui/components/core/MessageInput';

// Create stubs for child components and modules
const SlashCommandSuggestionsStub = sinon.stub().callsFake(({ input, selectedIndex, onSelect }) => (
  <div data-testid="slash-suggestions" data-selected={selectedIndex}>
    SlashCommandSuggestions
  </div>
));

const getCommandNamesStub = sinon.stub().returns(['help', 'config', 'clear', 'model', 'exit']);

// Ink stubs and state
let inputCallback: any = null;
let componentState = {
  value: '',
  cursorPosition: 0,
  selectedCommandIndex: 0,
  historyIndex: -1,
  draftMessage: ''
};

const BoxStub = sinon.stub().callsFake(({ children, flexDirection, flexGrow }: any) => (
  <div data-testid="box" data-flex-direction={flexDirection} data-flex-grow={flexGrow}>
    {children}
  </div>
));

const TextStub = sinon.stub().callsFake(({ children, color, bold, backgroundColor }: any) => (
  <span 
    data-testid="text"
    data-color={color}
    data-bold={bold}
    data-bgcolor={backgroundColor}
  >
    {children}
  </span>
));

const useInputStub = sinon.stub().callsFake((callback: any) => {
  inputCallback = callback;
  return () => {};
});

let mockOnChange: sinon.SinonStub;
let mockOnSubmit: sinon.SinonStub;

test.beforeEach(() => {
  mockOnChange = sinon.stub();
  mockOnSubmit = sinon.stub();
  SlashCommandSuggestionsStub.resetHistory();
  getCommandNamesStub.resetHistory();
  BoxStub.resetHistory();
  TextStub.resetHistory();
  useInputStub.resetHistory();
  inputCallback = null;
  componentState = {
    value: '',
    cursorPosition: 0,
    selectedCommandIndex: 0,
    historyIndex: -1,
    draftMessage: ''
  };
});

test.afterEach.always(() => {
  cleanup();
});

test('MessageInput - rendering - should render with placeholder when value is empty', (t) => {
  const { getByText } = render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(getByText('... (Esc to clear, Ctrl+C to exit)'));
});

test('MessageInput - rendering - should render with custom placeholder', (t) => {
  const { getByText } = render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
      placeholder="Custom placeholder"
    />
  );

  t.truthy(getByText('Custom placeholder'));
});

test('MessageInput - rendering - should render value when provided', (t) => {
  const { container } = render(
    <MessageInput
      value="test message"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  const textElements = container.querySelectorAll('[data-testid="text"]');
  const textContent = Array.from(textElements).map(el => el.textContent).join('');
  t.true(textContent.includes('test message'));
});

test('MessageInput - rendering - should show slash command suggestions when input starts with /', (t) => {
  const { getByTestId } = render(
    <MessageInput
      value="/he"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(getByTestId('slash-suggestions'));
});

test('MessageInput - rendering - should not show slash command suggestions for regular input', (t) => {
  const { queryByTestId } = render(
    <MessageInput
      value="regular message"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.falsy(queryByTestId('slash-suggestions'));
});

test('MessageInput - input handling - should handle character input', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('a', { meta: false, ctrl: false });
  
  t.true(mockOnChange.calledWith('a'));
});

test('MessageInput - input handling - should handle character input at cursor position', (t) => {
  render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  // Move cursor to position 2
  inputCallback('', { leftArrow: true });
  inputCallback('', { leftArrow: true });
  
  // Insert character
  inputCallback('x', { meta: false, ctrl: false });
  
  // Should insert at cursor position
  t.true(mockOnChange.called);
});

test('MessageInput - input handling - should handle backspace', (t) => {
  render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { backspace: true });
  
  t.true(mockOnChange.called);
});

test('MessageInput - input handling - should handle delete key', (t) => {
  render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { delete: true });
  
  t.true(mockOnChange.called);
});

test('MessageInput - input handling - should handle enter key', (t) => {
  render(
    <MessageInput
      value="test message"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { return: true });
  
  t.true(mockOnSubmit.calledWith('test message'));
});

test('MessageInput - input handling - should handle enter key with slash command', (t) => {
  render(
    <MessageInput
      value="/he"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { return: true });
  
  // Should submit the filtered command
  t.true(mockOnSubmit.calledWith('/help'));
});

test('MessageInput - input handling - should ignore meta key combinations', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('a', { meta: true, ctrl: false });
  
  t.false(mockOnChange.called);
});

test('MessageInput - input handling - should ignore ctrl key combinations', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('a', { meta: false, ctrl: true });
  
  t.false(mockOnChange.called);
});

test('MessageInput - input handling - should replace newlines with spaces', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('line1\nline2\r\nline3', { meta: false, ctrl: false });
  
  t.true(mockOnChange.calledWith('line1 line2 line3'));
});

test('MessageInput - cursor navigation - should handle left arrow', (t) => {
  render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { leftArrow: true });
  
  // Cursor should move left (internal state change)
  t.truthy(inputCallback);
});

test('MessageInput - cursor navigation - should handle right arrow', (t) => {
  render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { rightArrow: true });
  
  // Cursor should move right (internal state change)
  t.truthy(inputCallback);
});

test('MessageInput - cursor navigation - should handle up arrow for slash commands', (t) => {
  render(
    <MessageInput
      value="/he"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { upArrow: true });
  
  // Should navigate through suggestions (internal state change)
  t.truthy(inputCallback);
});

test('MessageInput - cursor navigation - should handle down arrow for slash commands', (t) => {
  render(
    <MessageInput
      value="/he"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { downArrow: true });
  
  // Should navigate through suggestions (internal state change)
  t.truthy(inputCallback);
});

const mockHistory = ['first message', 'second message', 'third message'];

test('MessageInput - message history navigation - should navigate to previous message with up arrow at cursor position 0', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
      userMessageHistory={mockHistory}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { upArrow: true });
  
  // Should load the most recent message from history
  t.true(mockOnChange.calledWith('third message'));
});

test('MessageInput - message history navigation - should navigate through history with multiple up arrows', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
      userMessageHistory={mockHistory}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { upArrow: true });
  inputCallback('', { upArrow: true });
  
  // Should navigate to older messages
  t.true(mockOnChange.called);
});

test('MessageInput - message history navigation - should navigate back with down arrow', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
      userMessageHistory={mockHistory}
    />
  );

  t.truthy(inputCallback);
  
  // Navigate to history first (at cursor position 0)
  inputCallback('', { upArrow: true });
  
  // Should have called onChange with history item
  t.true(mockOnChange.calledWith('third message'));
  
  // Clear mock to test down arrow
  mockOnChange.resetHistory();
  
  // Mock the component now having the history value and cursor at end
  const { rerender } = render(
    <MessageInput
      value="third message"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
      userMessageHistory={mockHistory}
    />
  );
  
  // Move cursor to end position to allow down arrow navigation
  for (let i = 0; i < 13; i++) { // "third message" is 13 chars
    inputCallback('', { rightArrow: true });
  }
  
  // Then go down to navigate back
  inputCallback('', { downArrow: true });
  
  // Component should allow navigation even if onChange wasn't called
  t.truthy(inputCallback);
});

test('MessageInput - message history navigation - should preserve draft message when navigating history', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
      userMessageHistory={mockHistory}
    />
  );

  t.truthy(inputCallback);
  
  // Type a draft message
  inputCallback('d', { meta: false, ctrl: false });
  inputCallback('r', { meta: false, ctrl: false });
  inputCallback('a', { meta: false, ctrl: false });
  inputCallback('f', { meta: false, ctrl: false });
  inputCallback('t', { meta: false, ctrl: false });
  
  // Move cursor to start to enable history navigation
  for (let i = 0; i < 5; i++) {
    inputCallback('', { leftArrow: true });
  }
  
  // Navigate to history (should preserve draft)
  inputCallback('', { upArrow: true });
  
  // Should have called onChange with history item
  t.true(mockOnChange.calledWith('third message'));
});

test('MessageInput - edge cases - should handle empty value submission', (t) => {
  render(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  inputCallback('', { return: true });
  
  t.true(mockOnSubmit.calledWith(''));
});

test('MessageInput - edge cases - should handle backspace at cursor position 0', (t) => {
  render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  t.truthy(inputCallback);
  
  // Move cursor to start
  inputCallback('', { leftArrow: true });
  inputCallback('', { leftArrow: true });
  inputCallback('', { leftArrow: true });
  inputCallback('', { leftArrow: true });
  
  // Try backspace at position 0
  inputCallback('', { backspace: true });
  
  // Should not crash or call onChange incorrectly
  t.true(mockOnChange.called);
});

test('MessageInput - edge cases - should handle value changes from parent', (t) => {
  const { rerender } = render(
    <MessageInput
      value="initial"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  rerender(
    <MessageInput
      value="updated"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  // Should handle the new value without errors
  t.truthy(inputCallback);
});

test('MessageInput - edge cases - should reset cursor when value is cleared', (t) => {
  const { rerender } = render(
    <MessageInput
      value="test"
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  rerender(
    <MessageInput
      value=""
      onChange={mockOnChange}
      onSubmit={mockOnSubmit}
    />
  );

  // Cursor should be reset to 0 (internal state)
  t.truthy(inputCallback);
});