import test from 'ava';
import sinon from 'sinon';
import { getAvailableCommands, getCommandNames, handleSlashCommand, CommandContext } from '@src/commands/index';

test('getAvailableCommands - should return an array of command definitions', (t) => {
  const commands = getAvailableCommands();
  
  t.true(Array.isArray(commands));
  t.true(commands.length > 0);
  
  // Verify all commands have required properties
  commands.forEach(command => {
    t.truthy(command.command);
    t.truthy(command.description);
    t.truthy(command.handler);
    t.is(typeof command.command, 'string');
    t.is(typeof command.description, 'string');
    t.is(typeof command.handler, 'function');
  });
});

test('getAvailableCommands - should return a copy of commands array (not mutate original)', (t) => {
  const commands1 = getAvailableCommands();
  const commands2 = getAvailableCommands();
  
  t.not(commands1, commands2); // Different array instances
  t.deepEqual(commands1, commands2); // Same content
  
  // Modify one array
  commands1.pop();
  
  // Original should be unchanged
  t.not(commands1.length, commands2.length);
});

test('getAvailableCommands - should include expected command types', (t) => {
  const commands = getAvailableCommands();
  const commandNames = commands.map(cmd => cmd.command);
  
  t.true(commandNames.includes('help'));
  t.true(commandNames.includes('login'));
  t.true(commandNames.includes('model'));
  t.true(commandNames.includes('clear'));
  t.true(commandNames.includes('reasoning'));
});

test('getCommandNames - should return array of command names', (t) => {
  const commandNames = getCommandNames();
  
  t.true(Array.isArray(commandNames));
  t.true(commandNames.length > 0);
  
  commandNames.forEach(name => {
    t.is(typeof name, 'string');
    t.true(name.length > 0);
  });
});

test('getCommandNames - should return lowercase command names', (t) => {
  const commandNames = getCommandNames();
  
  commandNames.forEach(name => {
    t.is(name, name.toLowerCase());
  });
});

test('getCommandNames - should match command names from getAvailableCommands', (t) => {
  const commands = getAvailableCommands();
  const commandNames = getCommandNames();
  const expectedNames = commands.map(cmd => cmd.command);
  
  t.deepEqual(commandNames, expectedNames);
});

test('handleSlashCommand - should add user message for any command', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/help', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/help',
  }));
});

test('handleSlashCommand - should execute valid command handler', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/clear', mockContext);
  
  t.is(mockContext.addMessage.callCount, 2); // User message + system message
  t.true(mockContext.clearHistory.called);
});

test('handleSlashCommand - should handle command with case insensitivity', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/HELP', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/HELP',
  }));
  // Should still execute the help command
  t.is(mockContext.addMessage.callCount, 2);
});

test('handleSlashCommand - should handle command with mixed case', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/Help', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/Help',
  }));
  // Should still execute the help command
  t.is(mockContext.addMessage.callCount, 2);
});

test('handleSlashCommand - should handle command with arguments (space separated)', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/help some arguments here', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/help some arguments here',
  }));
  // Should still execute the help command (ignoring arguments)
  t.is(mockContext.addMessage.callCount, 2);
});

test('handleSlashCommand - should handle unknown command gracefully', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/unknown', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/unknown',
  }));
  // Should only have the user message (no handler executed)
  t.is(mockContext.addMessage.callCount, 1);
});

test('handleSlashCommand - should extract command name correctly from complex input', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/login with additional text', mockContext);
  
  t.true(mockContext.setShowLogin.calledWith(true));
});

test('handleSlashCommand - should handle command without space at the end', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/model', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/model',
  }));
  t.true(mockContext.setShowModelSelector.calledWith(true));
});

test('handleSlashCommand - should handle empty command gracefully', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/', mockContext);
  
  t.true(mockContext.addMessage.calledWith({
    role: 'user',
    content: '/',
  }));
  // Should only have the user message
  t.is(mockContext.addMessage.callCount, 1);
});

test('handleSlashCommand - should handle reasoning command toggle', (t) => {
  const mockContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    setShowModelSelector: sinon.stub(),
    toggleReasoning: sinon.stub(),
    showReasoning: false,
  };

  handleSlashCommand('/reasoning', mockContext);
  
  t.true(mockContext.toggleReasoning.called);
  t.is(mockContext.addMessage.callCount, 2);
});

test('handleSlashCommand - should handle commands with different function availability', (t) => {
  // Test with minimal context (some functions undefined)
  const minimalContext: CommandContext = {
    addMessage: sinon.stub(),
    clearHistory: sinon.stub(),
    setShowLogin: sinon.stub(),
    // Missing optional functions
  };

  handleSlashCommand('/model', minimalContext);
  
  t.true(minimalContext.addMessage.calledWith({
    role: 'user',
    content: '/model',
  }));
  // Model command should handle missing setShowModelSelector gracefully
  t.is(minimalContext.addMessage.callCount, 1);
});

test('handleSlashCommand - should handle all available commands', (t) => {
  const commands = getAvailableCommands();
  
  commands.forEach(cmd => {
    const freshContext: CommandContext = {
      addMessage: sinon.stub(),
      clearHistory: sinon.stub(),
      setShowLogin: sinon.stub(),
      setShowModelSelector: sinon.stub(),
      toggleReasoning: sinon.stub(),
      showReasoning: false,
    };

    t.notThrows(() => {
      handleSlashCommand(`/${cmd.command}`, freshContext);
    });

    t.true(freshContext.addMessage.calledWith({
      role: 'user',
      content: `/${cmd.command}`,
    }));
  });
});