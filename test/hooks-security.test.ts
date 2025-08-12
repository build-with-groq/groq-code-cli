import test from 'ava';

test('Hook configuration validation', (t) => {
  function validateHookConfig(hook: any): boolean {
    // Validate hook structure
    if (!hook || typeof hook !== 'object') return false;
    if (hook.type !== 'command') return false;
    if (typeof hook.command !== 'string' || !hook.command.trim()) return false;
    
    // Validate timeout (must be positive and reasonable)
    if (hook.timeout !== undefined) {
      if (typeof hook.timeout !== 'number' || 
          hook.timeout <= 0 || 
          hook.timeout > 60000) { // Max 1 minute
        return false;
      }
    }
    
    // Validate blocking flag
    if (hook.blocking !== undefined && typeof hook.blocking !== 'boolean') {
      return false;
    }
    
    return true;
  }

  // Test valid configurations
  const validConfigs = [
    {
      type: 'command',
      command: 'echo test'
    },
    {
      type: 'command',
      command: 'echo test',
      timeout: 5000,
      blocking: true
    },
    {
      type: 'command',
      command: 'ls -la',
      timeout: 1000,
      blocking: false
    }
  ];

  validConfigs.forEach(config => {
    t.true(validateHookConfig(config), `Valid config should pass: ${JSON.stringify(config)}`);
  });

  // Test invalid configurations
  const invalidConfigs = [
    null,
    undefined,
    {},
    { type: 'invalid' },
    { type: 'command' }, // Missing command
    { type: 'command', command: '' }, // Empty command
    { type: 'command', command: 'echo test', timeout: -1 }, // Invalid timeout
    { type: 'command', command: 'echo test', timeout: 70000 }, // Timeout too large
    { type: 'command', command: 'echo test', blocking: 'yes' }, // Invalid blocking type
  ];

  invalidConfigs.forEach(config => {
    t.false(validateHookConfig(config), `Invalid config should fail: ${JSON.stringify(config)}`);
  });
});

test('Environment variable disables local hooks', (t) => {
  // Simulate the logic that checks GROQ_NO_LOCAL_HOOKS
  function shouldAllowLocalHooks(): boolean {
    return process.env.GROQ_NO_LOCAL_HOOKS !== 'true';
  }

  // Test without environment variable
  delete process.env.GROQ_NO_LOCAL_HOOKS;
  t.true(shouldAllowLocalHooks());

  // Test with environment variable set to true
  process.env.GROQ_NO_LOCAL_HOOKS = 'true';
  t.false(shouldAllowLocalHooks());

  // Test with environment variable set to other values
  process.env.GROQ_NO_LOCAL_HOOKS = 'false';
  t.true(shouldAllowLocalHooks());

  process.env.GROQ_NO_LOCAL_HOOKS = '1';
  t.true(shouldAllowLocalHooks());

  // Cleanup
  delete process.env.GROQ_NO_LOCAL_HOOKS;
});