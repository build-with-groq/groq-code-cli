import React from 'react';
import { render } from 'ink';
import { EventEmitter } from 'events';
import stripAnsiDefault from 'strip-ansi';

interface RenderOptions {
  columns?: number;
  stripAnsi?: boolean;
}

/**
 * Renders an Ink component to a string for testing purposes.
 * Based on Ink's own testing approach.
 */
export function renderToString(
  element: React.ReactElement,
  options: RenderOptions = {}
): string {
  const { columns = 100, stripAnsi: shouldStripAnsi = true } = options;
  
  let lastOutput = '';
  
  // Create a mock stdout that captures output
  const stdout = Object.assign(new EventEmitter(), {
    columns,
    rows: 40,
    write: (chunk: string) => {
      lastOutput = chunk;
      return true;
    },
    isTTY: true
  });

  // Create a mock stdin for components that use useInput
  const stdin = Object.assign(new EventEmitter(), {
    setRawMode: () => {},
    isTTY: true,
    resume: () => {},
    pause: () => {},
    ref: () => {},
    unref: () => {}
  });
  
  // Render the component with mock stdout
  const { unmount } = render(element, { 
    stdout: stdout as any,
    stdin: stdin as any,
    debug: true 
  });
  
  // Immediately unmount to get final output
  unmount();
  
  // Strip ANSI codes if requested (useful for testing text content)
  return shouldStripAnsi ? stripAnsiDefault(lastOutput) : lastOutput;
}

/**
 * Creates a test harness for interactive components that use useInput.
 * Returns stdin emitter and a function to get current output.
 */
export function createInteractiveTest(element: React.ReactElement, options: RenderOptions = {}) {
  const { columns = 100 } = options;
  
  let lastOutput = '';
  
  // Create a mock stdout that captures output
  const stdout = Object.assign(new EventEmitter(), {
    columns,
    rows: 40,
    write: (chunk: string) => {
      lastOutput = chunk;
      return true;
    },
    isTTY: true
  });

  // Create a mock stdin that we can control
  const stdin = new EventEmitter() as any;
  stdin.setRawMode = () => {};
  stdin.isTTY = true;
  stdin.resume = () => {};
  stdin.pause = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};
  
  // Render the component
  const instance = render(element, { 
    stdout: stdout as any,
    stdin: stdin as any,
    debug: true 
  });
  
  return {
    stdin,
    stdout,
    getOutput: (stripAnsiFlag = true) => {
      return stripAnsiFlag ? stripAnsiDefault(lastOutput) : lastOutput;
    },
    unmount: instance.unmount,
    rerender: instance.rerender,
    // Simulate key press
    pressKey: (key: string, modifiers: any = {}) => {
      // Emit data event for regular characters
      if (key.length === 1 && !modifiers.ctrl && !modifiers.meta) {
        stdin.emit('data', key);
      }
      
      // Emit keypress event for special keys
      stdin.emit('keypress', key, {
        name: key,
        ctrl: modifiers.ctrl || false,
        meta: modifiers.meta || false,
        shift: modifiers.shift || false,
        escape: modifiers.escape || false,
        return: modifiers.return || false,
        backspace: modifiers.backspace || false,
        delete: modifiers.delete || false,
        ...modifiers
      });
    }
  };
}