import test from 'ava';
import sinon from 'sinon';
import {
  ToolSchema,
  READ_FILE_SCHEMA,
  CREATE_FILE_SCHEMA,
  EDIT_FILE_SCHEMA,
  DELETE_FILE_SCHEMA,
  EXECUTE_COMMAND_SCHEMA,
  SEARCH_FILES_SCHEMA,
  LIST_FILES_SCHEMA,
  CREATE_TASKS_SCHEMA,
  UPDATE_TASKS_SCHEMA,
  ALL_TOOL_SCHEMAS,
  SAFE_TOOLS,
  APPROVAL_REQUIRED_TOOLS,
  DANGEROUS_TOOLS
} from '@src/tools/tool-schemas.js';

test.afterEach.always(t => {
  sinon.restore();
});

test('ToolSchema Interface - should define correct structure', t => {
  const schema: ToolSchema = {
    type: 'function',
    function: {
      name: 'test_function',
      description: 'Test function',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string' }
        },
        required: ['param1']
      }
    }
  };

  t.is(schema.type, 'function');
  t.is(schema.function.name, 'test_function');
  t.is(schema.function.description, 'Test function');
  t.is(schema.function.parameters.type, 'object');
});

test('READ_FILE_SCHEMA - should have correct structure and properties', t => {
  t.is(READ_FILE_SCHEMA.type, 'function');
  t.is(READ_FILE_SCHEMA.function.name, 'read_file');
  t.true(READ_FILE_SCHEMA.function.description.includes('Read file contents'));
  t.is(READ_FILE_SCHEMA.function.parameters.type, 'object');
  t.deepEqual(READ_FILE_SCHEMA.function.parameters.required, ['file_path']);
});

test('READ_FILE_SCHEMA - should have correct parameter definitions', t => {
  const props = READ_FILE_SCHEMA.function.parameters.properties;
  t.is(props.file_path.type, 'string');
  t.true(props.file_path.description.includes('Path to file'));
  t.is(props.start_line.type, 'integer');
  t.true(props.start_line.description.includes('Starting line number'));
  t.is(props.start_line.minimum, 1);
  t.is(props.end_line.type, 'integer');
  t.true(props.end_line.description.includes('Ending line number'));
  t.is(props.end_line.minimum, 1);
});

test('READ_FILE_SCHEMA - should include usage guidelines', t => {
  t.true(READ_FILE_SCHEMA.function.description.includes('REQUIRED before edit_file'));
  t.true(READ_FILE_SCHEMA.function.description.includes('Example:'));
});

test('CREATE_FILE_SCHEMA - should have correct structure and properties', t => {
  t.is(CREATE_FILE_SCHEMA.type, 'function');
  t.is(CREATE_FILE_SCHEMA.function.name, 'create_file');
  t.true(CREATE_FILE_SCHEMA.function.description.includes('Create NEW files'));
  t.deepEqual(CREATE_FILE_SCHEMA.function.parameters.required, ['file_path', 'content']);
});

test('CREATE_FILE_SCHEMA - should have file type enumeration', t => {
  const props = CREATE_FILE_SCHEMA.function.parameters.properties;
  t.deepEqual(props.file_type.enum, ['file', 'directory']);
  t.is(props.file_type.default, 'file');
});

test('CREATE_FILE_SCHEMA - should have overwrite option', t => {
  const props = CREATE_FILE_SCHEMA.function.parameters.properties;
  t.is(props.overwrite.type, 'boolean');
  t.is(props.overwrite.default, false);
});

test('CREATE_FILE_SCHEMA - should include safety warnings', t => {
  t.true(CREATE_FILE_SCHEMA.function.description.includes('CRITICAL'));
  t.true(CREATE_FILE_SCHEMA.function.description.includes('check if file exists first'));
});

test('EDIT_FILE_SCHEMA - should have correct structure and properties', t => {
  t.is(EDIT_FILE_SCHEMA.type, 'function');
  t.is(EDIT_FILE_SCHEMA.function.name, 'edit_file');
  t.true(EDIT_FILE_SCHEMA.function.description.includes('Modify EXISTING files'));
  t.deepEqual(EDIT_FILE_SCHEMA.function.parameters.required, ['file_path', 'old_text', 'new_text']);
});

test('EDIT_FILE_SCHEMA - should have replace_all option', t => {
  const props = EDIT_FILE_SCHEMA.function.parameters.properties;
  t.is(props.replace_all.type, 'boolean');
  t.is(props.replace_all.default, false);
});

test('EDIT_FILE_SCHEMA - should include mandatory requirements', t => {
  t.true(EDIT_FILE_SCHEMA.function.description.includes('MANDATORY: Always read_file first'));
  t.true(EDIT_FILE_SCHEMA.function.description.includes('exact text replacement'));
});

test('DELETE_FILE_SCHEMA - should have correct structure and properties', t => {
  t.is(DELETE_FILE_SCHEMA.type, 'function');
  t.is(DELETE_FILE_SCHEMA.function.name, 'delete_file');
  t.true(DELETE_FILE_SCHEMA.function.description.includes('Remove files or directories'));
  t.deepEqual(DELETE_FILE_SCHEMA.function.parameters.required, ['file_path']);
});

test('DELETE_FILE_SCHEMA - should have recursive option', t => {
  const props = DELETE_FILE_SCHEMA.function.parameters.properties;
  t.is(props.recursive.type, 'boolean');
  t.is(props.recursive.default, false);
});

test('DELETE_FILE_SCHEMA - should include caution warning', t => {
  t.true(DELETE_FILE_SCHEMA.function.description.includes('Use with caution'));
});

test('EXECUTE_COMMAND_SCHEMA - should have correct structure and properties', t => {
  t.is(EXECUTE_COMMAND_SCHEMA.type, 'function');
  t.is(EXECUTE_COMMAND_SCHEMA.function.name, 'execute_command');
  t.true(EXECUTE_COMMAND_SCHEMA.function.description.includes('Run shell commands'));
  t.deepEqual(EXECUTE_COMMAND_SCHEMA.function.parameters.required, ['command', 'command_type']);
});

test('EXECUTE_COMMAND_SCHEMA - should have command type enumeration', t => {
  const props = EXECUTE_COMMAND_SCHEMA.function.parameters.properties;
  t.deepEqual(props.command_type.enum, ['bash', 'python', 'setup', 'run']);
});

test('EXECUTE_COMMAND_SCHEMA - should have timeout constraints', t => {
  const props = EXECUTE_COMMAND_SCHEMA.function.parameters.properties;
  t.is(props.timeout.minimum, 1);
  t.is(props.timeout.maximum, 300);
});

test('EXECUTE_COMMAND_SCHEMA - should include safety warnings', t => {
  t.true(EXECUTE_COMMAND_SCHEMA.function.description.includes('SAFETY WARNING'));
  t.true(EXECUTE_COMMAND_SCHEMA.function.description.includes('NEVER use for commands that run indefinitely'));
});

test('SEARCH_FILES_SCHEMA - should have correct structure and properties', t => {
  t.is(SEARCH_FILES_SCHEMA.type, 'function');
  t.is(SEARCH_FILES_SCHEMA.function.name, 'search_files');
  t.true(SEARCH_FILES_SCHEMA.function.description.includes('Find text patterns'));
  t.deepEqual(SEARCH_FILES_SCHEMA.function.parameters.required, ['pattern']);
});

test('SEARCH_FILES_SCHEMA - should have pattern type enumeration', t => {
  const props = SEARCH_FILES_SCHEMA.function.parameters.properties;
  t.deepEqual(props.pattern_type.enum, ['substring', 'regex', 'exact', 'fuzzy']);
  t.is(props.pattern_type.default, 'substring');
});

test('SEARCH_FILES_SCHEMA - should have result limits', t => {
  const props = SEARCH_FILES_SCHEMA.function.parameters.properties;
  t.is(props.max_results.minimum, 1);
  t.is(props.max_results.maximum, 1000);
  t.is(props.max_results.default, 100);
});

test('SEARCH_FILES_SCHEMA - should have context line constraints', t => {
  const props = SEARCH_FILES_SCHEMA.function.parameters.properties;
  t.is(props.context_lines.minimum, 0);
  t.is(props.context_lines.maximum, 10);
  t.is(props.context_lines.default, 0);
});

test('LIST_FILES_SCHEMA - should have correct structure and properties', t => {
  t.is(LIST_FILES_SCHEMA.type, 'function');
  t.is(LIST_FILES_SCHEMA.function.name, 'list_files');
  t.true(LIST_FILES_SCHEMA.function.description.includes('Browse directory contents'));
  t.deepEqual(LIST_FILES_SCHEMA.function.parameters.required, []);
});

test('LIST_FILES_SCHEMA - should have default values', t => {
  const props = LIST_FILES_SCHEMA.function.parameters.properties;
  t.is(props.directory.default, '.');
  t.is(props.pattern.default, '*');
  t.is(props.recursive.default, false);
  t.is(props.show_hidden.default, false);
});

test('LIST_FILES_SCHEMA - should include file existence check guidance', t => {
  t.true(LIST_FILES_SCHEMA.function.description.includes('CHECK IF FILES EXIST'));
  t.true(LIST_FILES_SCHEMA.function.description.includes('create_file vs edit_file'));
});

test('CREATE_TASKS_SCHEMA - should have correct structure and properties', t => {
  t.is(CREATE_TASKS_SCHEMA.type, 'function');
  t.is(CREATE_TASKS_SCHEMA.function.name, 'create_tasks');
  t.true(CREATE_TASKS_SCHEMA.function.description.includes('Break down complex requests'));
  t.deepEqual(CREATE_TASKS_SCHEMA.function.parameters.required, ['user_query', 'tasks']);
});

test('CREATE_TASKS_SCHEMA - should have task structure definition', t => {
  const props = CREATE_TASKS_SCHEMA.function.parameters.properties;
  const taskItems = props.tasks.items;
  t.is(taskItems.properties.id.type, 'string');
  t.true(taskItems.properties.id.description.includes('Unique task identifier'));
  t.deepEqual(taskItems.properties.status.enum, ['pending', 'in_progress', 'completed']);
  t.deepEqual(taskItems.required, ['id', 'description']);
});

test('UPDATE_TASKS_SCHEMA - should have correct structure and properties', t => {
  t.is(UPDATE_TASKS_SCHEMA.type, 'function');
  t.is(UPDATE_TASKS_SCHEMA.function.name, 'update_tasks');
  t.true(UPDATE_TASKS_SCHEMA.function.description.includes('Update task progress'));
  t.deepEqual(UPDATE_TASKS_SCHEMA.function.parameters.required, ['task_updates']);
});

test('UPDATE_TASKS_SCHEMA - should have update structure definition', t => {
  const props = UPDATE_TASKS_SCHEMA.function.parameters.properties;
  const updateItems = props.task_updates.items;
  t.deepEqual(updateItems.properties.status.enum, ['pending', 'in_progress', 'completed']);
  t.deepEqual(updateItems.required, ['id', 'status']);
});

test('ALL_TOOL_SCHEMAS - should contain all defined schemas', t => {
  const expectedSchemas = [
    READ_FILE_SCHEMA,
    CREATE_FILE_SCHEMA,
    EDIT_FILE_SCHEMA,
    DELETE_FILE_SCHEMA,
    SEARCH_FILES_SCHEMA,
    LIST_FILES_SCHEMA,
    CREATE_TASKS_SCHEMA,
    UPDATE_TASKS_SCHEMA,
    EXECUTE_COMMAND_SCHEMA
  ];
  
  t.is(ALL_TOOL_SCHEMAS.length, expectedSchemas.length);
  t.true(expectedSchemas.every(schema => ALL_TOOL_SCHEMAS.includes(schema)));
});

test('ALL_TOOL_SCHEMAS - should have unique tool names', t => {
  const toolNames = ALL_TOOL_SCHEMAS.map(schema => schema.function.name);
  const uniqueNames = [...new Set(toolNames)];
  t.is(toolNames.length, uniqueNames.length);
});

test('ALL_TOOL_SCHEMAS - should all be function type', t => {
  ALL_TOOL_SCHEMAS.forEach(schema => {
    t.is(schema.type, 'function');
  });
});

test('ALL_TOOL_SCHEMAS - should all have descriptions and parameters', t => {
  ALL_TOOL_SCHEMAS.forEach(schema => {
    t.truthy(schema.function.name);
    t.truthy(schema.function.description);
    t.truthy(schema.function.parameters);
    t.is(schema.function.parameters.type, 'object');
  });
});

test('Tool Categories - SAFE_TOOLS should contain read-only and task management tools', t => {
  t.deepEqual(SAFE_TOOLS, [
    'read_file',
    'list_files',
    'search_files',
    'create_tasks',
    'update_tasks'
  ]);
});

test('Tool Categories - SAFE_TOOLS should be a subset of all tools', t => {
  const allToolNames = ALL_TOOL_SCHEMAS.map(schema => schema.function.name);
  SAFE_TOOLS.forEach(toolName => {
    t.true(allToolNames.includes(toolName));
  });
});

test('Tool Categories - APPROVAL_REQUIRED_TOOLS should contain file modification tools', t => {
  t.deepEqual(APPROVAL_REQUIRED_TOOLS, [
    'create_file',
    'edit_file'
  ]);
});

test('Tool Categories - APPROVAL_REQUIRED_TOOLS should be a subset of all tools', t => {
  const allToolNames = ALL_TOOL_SCHEMAS.map(schema => schema.function.name);
  APPROVAL_REQUIRED_TOOLS.forEach(toolName => {
    t.true(allToolNames.includes(toolName));
  });
});

test('Tool Categories - DANGEROUS_TOOLS should contain destructive and execution tools', t => {
  t.deepEqual(DANGEROUS_TOOLS, [
    'delete_file',
    'execute_command'
  ]);
});

test('Tool Categories - DANGEROUS_TOOLS should be a subset of all tools', t => {
  const allToolNames = ALL_TOOL_SCHEMAS.map(schema => schema.function.name);
  DANGEROUS_TOOLS.forEach(toolName => {
    t.true(allToolNames.includes(toolName));
  });
});

test('Tool Categories - should have no overlap between categories', t => {
  const allCategorized = [...SAFE_TOOLS, ...APPROVAL_REQUIRED_TOOLS, ...DANGEROUS_TOOLS];
  const uniqueCategorized = [...new Set(allCategorized)];
  t.is(allCategorized.length, uniqueCategorized.length);
});

test('Tool Categories - should categorize all tools', t => {
  const allToolNames = ALL_TOOL_SCHEMAS.map(schema => schema.function.name);
  const allCategorized = [...SAFE_TOOLS, ...APPROVAL_REQUIRED_TOOLS, ...DANGEROUS_TOOLS];
  
  allToolNames.forEach(toolName => {
    t.true(allCategorized.includes(toolName));
  });
});

test('Schema Validation - should have consistent parameter descriptions', t => {
  ALL_TOOL_SCHEMAS.forEach(schema => {
    Object.values(schema.function.parameters.properties).forEach((param: any) => {
      if (param.type === 'string' && param.description) {
        t.notRegex(param.description, /^\s*$/); // Not just whitespace
        t.true(param.description.length > 5);
      }
    });
  });
});

test('Schema Validation - should have path parameters with consistent guidance', t => {
  const pathTools = [READ_FILE_SCHEMA, CREATE_FILE_SCHEMA, EDIT_FILE_SCHEMA, DELETE_FILE_SCHEMA];
  pathTools.forEach(schema => {
    const pathParam = schema.function.parameters.properties.file_path;
    t.true(pathParam.description.includes('DO NOT use absolute paths'));
    t.true(pathParam.description.includes('leading slash'));
  });
});

test('Schema Validation - should have directory parameters with consistent guidance', t => {
  const dirTools = [SEARCH_FILES_SCHEMA, LIST_FILES_SCHEMA];
  dirTools.forEach(schema => {
    const dirParam = schema.function.parameters.properties.directory;
    if (dirParam) {
      t.true(dirParam.description.includes('DO NOT include leading slash'));
    }
  });
});