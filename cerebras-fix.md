# Fix for Cerebras qwen3-coder "Max Iterations Reached" Issue

## Problem
When using the Cerebras provider with the qwen3-coder model, the agent gets stuck in an infinite loop of tool calls, reaching the maximum iteration limit (50) without providing a final response.

## Root Causes
1. **Model Behavior**: The qwen3-coder model might have different tool-calling patterns compared to other models
2. **Response Format**: The model may not be properly signaling when it's done with tool calls
3. **Context Window**: The model might be losing context after multiple tool calls

## Solutions

### Solution 1: Increase Iteration Limit (Temporary Workaround)
Edit `src/core/agent.ts` line 245 to increase the max iterations:
```typescript
const maxIterations = 100; // Increased from 50
```

### Solution 2: Add Model-Specific Handling
Create a model-specific configuration that handles qwen3-coder differently:

```typescript
// In src/core/agent.ts, add after line 245:
const isQwenModel = this.model.includes('qwen');
const maxIterations = isQwenModel ? 30 : 50; // Lower limit for qwen models
```

### Solution 3: Force Final Response After Tool Execution
Add logic to force a final response when using qwen models:

```typescript
// In src/core/agent.ts, after line 374:
if (isQwenModel && iteration > 10) {
  // Force a final response for qwen models after 10 iterations
  this.messages.push({
    role: 'system',
    content: 'Please provide a final response to the user now without calling any more tools.'
  });
}
```

### Solution 4: Debug the Issue
Run the CLI with debug mode to understand what's happening:

```bash
groq --debug
```

Then check the `debug-agent.log` file in your current directory to see:
- What tools are being called repeatedly
- What the model's responses look like
- Whether there are any errors in tool execution

### Solution 5: Use Alternative Models
As a workaround, you can use other Cerebras models that don't have this issue:
- `llama3.1-70b` 
- `llama3.3-70b`
- `llama3.1-8b`

To switch models, use the `/model` command in the CLI.

## Recommended Fix Implementation

Here's a comprehensive fix that combines multiple approaches:

```typescript
// File: src/core/agent.ts
// Replace lines 245-246 with:

const isQwenModel = this.model.includes('qwen');
const maxIterations = isQwenModel ? 25 : 50; // Lower limit for qwen
let iteration = 0;
let consecutiveToolCalls = 0; // Track consecutive tool calls

// Then, after line 374 (after iteration++), add:
consecutiveToolCalls++;

// Check if we're stuck in a tool loop
if (isQwenModel && consecutiveToolCalls > 8) {
  debugLog('Qwen model stuck in tool loop, forcing final response');
  
  // Add a system message to force completion
  this.messages.push({
    role: 'system',
    content: 'You have executed multiple tools. Now provide a final summary response to the user without calling any more tools.'
  });
  
  // Reset counter and continue to get final response
  consecutiveToolCalls = 0;
  iteration++;
  continue;
}

// After line 378 (when no tool calls are made), add:
consecutiveToolCalls = 0; // Reset counter when we get a non-tool response
```

## Testing the Fix

1. Apply one of the solutions above
2. Run with debug enabled: `groq --debug`
3. Test with a simple command like "create a hello world python script"
4. Check if it completes without hitting max iterations

## Alternative: Use a Different Model

If the issue persists, you can configure a different default model:

```bash
# In the CLI, use:
/model
# Then select Cerebras > LLaMA3.1-70B
```

Or set it as default in your config:
```typescript
// src/core/cli.ts line 36
let defaultModel = 'llama3.1-70b'; // Changed from qwen model
```
