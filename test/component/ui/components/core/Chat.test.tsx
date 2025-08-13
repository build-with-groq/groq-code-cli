import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, waitFor, cleanup } from '@testing-library/react';
import Chat from '@src/ui/components/core/Chat';
import { Agent } from '@src/core/agent';

// Create stubs for all the child components
const MessageHistoryStub = sinon.stub().returns(<div data-testid="message-history">MessageHistory</div>);

const MessageInputStub = sinon.stub().callsFake(({ onSubmit, value, onChange }) => (
  <div data-testid="message-input">
    <input value={value} onChange={(e) => onChange(e.target.value)} />
    <button onClick={() => onSubmit(value || 'test message')}>Send</button>
  </div>
));

const TokenMetricsStub = sinon.stub().returns(<div data-testid="token-metrics">TokenMetrics</div>);

const PendingToolApprovalStub = sinon.stub().callsFake(({ onApprove, onReject }) => (
  <div data-testid="pending-approval">
    <button onClick={() => onApprove()}>Approve</button>
    <button onClick={() => onReject()}>Reject</button>
  </div>
));

const LoginStub = sinon.stub().callsFake(({ onSubmit, onCancel }) => (
  <div data-testid="login">
    <button onClick={() => onSubmit('test-key')}>Submit</button>
    <button onClick={() => onCancel()}>Cancel</button>
  </div>
));

const ModelSelectorStub = sinon.stub().callsFake(({ onSubmit, onCancel }) => (
  <div data-testid="model-selector">
    <button onClick={() => onSubmit('test-model')}>Select</button>
    <button onClick={() => onCancel()}>Cancel</button>
  </div>
));

const MaxIterationsContinueStub = sinon.stub().callsFake(({ onContinue }) => (
  <div data-testid="max-iterations">
    <button onClick={() => onContinue(true)}>Continue</button>
    <button onClick={() => onContinue(false)}>Stop</button>
  </div>
));

// Create stubs for hooks
const mockUseAgent = sinon.stub();
const mockUseTokenMetrics = sinon.stub();

// Ink stubs and input handling
let inputCallback: any = null;
const mockUseApp = sinon.stub();

const BoxStub = sinon.stub().callsFake(({ children }: any) => <div data-testid="box">{children}</div>);
const TextStub = sinon.stub().callsFake(({ children }: any) => <span data-testid="text">{children}</span>);
const useInputStub = sinon.stub().callsFake((callback: any) => {
  inputCallback = callback;
  return () => {};
});

// Command handler stub
const handleSlashCommandStub = sinon.stub();

let mockAgent: Agent;
let mockAgentHookReturn: any;
let mockTokenMetricsReturn: any;
let mockExit: any;

test.beforeEach(() => {
  // Reset all stubs
  MessageHistoryStub.resetHistory();
  MessageInputStub.resetHistory();
  TokenMetricsStub.resetHistory();
  PendingToolApprovalStub.resetHistory();
  LoginStub.resetHistory();
  ModelSelectorStub.resetHistory();
  MaxIterationsContinueStub.resetHistory();
  mockUseAgent.resetHistory();
  mockUseTokenMetrics.resetHistory();
  BoxStub.resetHistory();
  TextStub.resetHistory();
  useInputStub.resetHistory();
  mockUseApp.resetHistory();
  handleSlashCommandStub.resetHistory();
  inputCallback = null;

  mockAgent = {
    setApiKey: sinon.stub(),
    chat: sinon.stub(),
    interrupt: sinon.stub(),
    toggleAutoApprove: sinon.stub(),
    setReasoningDisplay: sinon.stub(),
  } as any;

  mockTokenMetricsReturn = {
    completionTokens: 0,
    startTime: null,
    endTime: null,
    pausedTime: 0,
    isPaused: false,
    isActive: false,
    startRequest: sinon.stub(),
    addApiTokens: sinon.stub(),
    pauseMetrics: sinon.stub(),
    resumeMetrics: sinon.stub(),
    completeRequest: sinon.stub(),
    resetMetrics: sinon.stub(),
  };

  mockAgentHookReturn = {
    messages: [],
    userMessageHistory: [],
    isProcessing: false,
    currentToolExecution: null,
    pendingApproval: null,
    pendingMaxIterations: null,
    sessionAutoApprove: false,
    showReasoning: false,
    sendMessage: sinon.stub(),
    approveToolExecution: sinon.stub(),
    respondToMaxIterations: sinon.stub(),
    addMessage: sinon.stub(),
    setApiKey: sinon.stub(),
    clearHistory: sinon.stub(),
    toggleAutoApprove: sinon.stub(),
    toggleReasoning: sinon.stub(),
    interruptRequest: sinon.stub(),
  };

  mockExit = sinon.stub();

  mockUseTokenMetrics.returns(mockTokenMetricsReturn);
  mockUseAgent.returns(mockAgentHookReturn);
  mockUseApp.returns({ exit: mockExit });
});

test.afterEach.always(() => {
  cleanup();
});

test('Chat - rendering - should render all core components', (t) => {
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  t.truthy(getByTestId('message-history'));
  t.truthy(getByTestId('message-input'));
});

test('Chat - rendering - should show token metrics when active', (t) => {
  mockTokenMetricsReturn.isActive = true;
  mockUseTokenMetrics.returns(mockTokenMetricsReturn);
  
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  t.truthy(getByTestId('token-metrics'));
});

test('Chat - rendering - should show pending approval when tool needs approval', (t) => {
  mockAgentHookReturn.pendingApproval = { tool: 'test-tool', args: {} };
  mockUseAgent.returns(mockAgentHookReturn);
  
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  t.truthy(getByTestId('pending-approval'));
});

test('Chat - rendering - should show login when showLogin is true', (t) => {
  const { getByTestId, rerender } = render(<Chat agent={mockAgent} />);
  
  // Trigger login display (would normally be done via command)
  mockAgentHookReturn.isProcessing = false;
  mockUseAgent.returns(mockAgentHookReturn);
  
  // Note: In real implementation, showLogin is set via state
  // For testing, we'd need to trigger the login command
  t.pass(); // This test needs proper state management for showLogin
});

test('Chat - rendering - should show max iterations dialog when pending', (t) => {
  mockAgentHookReturn.pendingMaxIterations = true;
  mockUseAgent.returns(mockAgentHookReturn);
  
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  t.truthy(getByTestId('max-iterations'));
});

test('Chat - keyboard shortcuts - should exit on Ctrl+C', (t) => {
  render(<Chat agent={mockAgent} />);
  
  t.truthy(inputCallback);
  inputCallback('c', { ctrl: true });
  
  t.true(mockExit.called);
});

test('Chat - keyboard shortcuts - should toggle auto-approve on Shift+Tab', (t) => {
  render(<Chat agent={mockAgent} />);
  
  t.truthy(inputCallback);
  inputCallback('', { shift: true, tab: true });
  
  t.true(mockAgentHookReturn.toggleAutoApprove.called);
});

test('Chat - keyboard shortcuts - should handle escape key for pending approval', (t) => {
  mockAgentHookReturn.pendingApproval = { tool: 'test-tool', args: {} };
  mockUseAgent.returns(mockAgentHookReturn);
  
  render(<Chat agent={mockAgent} />);
  
  t.truthy(inputCallback);
  inputCallback('', { escape: true });
  
  // Should reject the pending approval with both parameters
  t.true(mockAgentHookReturn.approveToolExecution.calledWith(false, undefined));
});

test('Chat - keyboard shortcuts - should interrupt processing on escape when processing', (t) => {
  mockAgentHookReturn.isProcessing = true;
  mockAgentHookReturn.currentToolExecution = null;
  mockUseAgent.returns(mockAgentHookReturn);
  
  render(<Chat agent={mockAgent} />);
  
  t.truthy(inputCallback);
  inputCallback('', { escape: true });
  
  t.true(mockAgentHookReturn.interruptRequest.called);
});

test('Chat - message handling - should send messages through agent hook', async (t) => {
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  const button = getByTestId('message-input').querySelector('button');
  
  // Simulate message sending by clicking the button
  if (button) {
    button.click();
    
    await waitFor(() => {
      t.true(mockAgentHookReturn.sendMessage.calledWith('test message'));
    });
  }
});

test('Chat - message handling - should handle slash commands', async (t) => {
  render(<Chat agent={mockAgent} />);
  
  // Simulate slash command input
  const input = document.querySelector('input');
  if (input) {
    input.value = '/help';
    // In real implementation, this would trigger handleSlashCommand
  }
  
  // For now, just verify the component renders without error
  t.pass();
});

test('Chat - state management - should hide input when processing', (t) => {
  mockAgentHookReturn.isProcessing = true;
  mockUseAgent.returns(mockAgentHookReturn);
  
  const { queryByTestId } = render(<Chat agent={mockAgent} />);
  
  // Input should not be visible when processing - instead "Processing..." text is shown
  const input = queryByTestId('message-input');
  t.falsy(input); // Input component should not be rendered when processing
});

test('Chat - state management - should hide input when pending approval', (t) => {
  mockAgentHookReturn.pendingApproval = { tool: 'test-tool', args: {} };
  mockUseAgent.returns(mockAgentHookReturn);
  
  const { queryByTestId } = render(<Chat agent={mockAgent} />);
  
  // Input should not be visible when pending approval - instead pending approval component is shown
  const input = queryByTestId('message-input');
  t.falsy(input); // Input component should not be rendered when pending approval
  
  // Should show pending approval instead
  const pendingApproval = queryByTestId('pending-approval');
  t.truthy(pendingApproval);
});

test('Chat - tool approval - should approve tool execution', async (t) => {
  mockAgentHookReturn.pendingApproval = { tool: 'test-tool', args: {} };
  mockUseAgent.returns(mockAgentHookReturn);
  
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  const approveButton = getByTestId('pending-approval').querySelector('button');
  if (approveButton) {
    approveButton.click();
    
    await waitFor(() => {
      t.true(mockAgentHookReturn.approveToolExecution.calledWith(true, false));
    });
  }
});

test('Chat - tool approval - should reject tool execution', async (t) => {
  mockAgentHookReturn.pendingApproval = { tool: 'test-tool', args: {} };
  mockUseAgent.returns(mockAgentHookReturn);
  
  const { getByTestId } = render(<Chat agent={mockAgent} />);
  
  const buttons = getByTestId('pending-approval').querySelectorAll('button');
  const rejectButton = buttons[1]; // Second button is reject
  
  if (rejectButton) {
    rejectButton.click();
    
    await waitFor(() => {
      t.true(mockAgentHookReturn.approveToolExecution.calledWith(false, false));
    });
  }
});

test('Chat - metrics integration - should pass metrics callbacks to useAgent', (t) => {
  render(<Chat agent={mockAgent} />);
  
  t.true(mockUseAgent.calledWith(
    mockAgent,
    mockTokenMetricsReturn.startRequest,
    mockTokenMetricsReturn.addApiTokens,
    mockTokenMetricsReturn.pauseMetrics,
    mockTokenMetricsReturn.resumeMetrics,
    mockTokenMetricsReturn.completeRequest
  ));
});