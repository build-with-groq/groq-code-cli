import test from 'ava';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../src/utils/local-settings.js';

// Helper to create a temporary directory
let tempDirCounter = 0;
const createTempDir = () => {
  const tempDir = path.join(os.tmpdir(), `groq-test-${Date.now()}-${tempDirCounter++}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

// Helper to clean up temp directories
const cleanupTempDir = (dir: string) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('ConfigManager finds project config in current directory', t => {
  const tempDir = createTempDir();
  
  try {
    // Create a project config
    const projectConfig = {
      defaultModel: 'test-model',
      temperature: 0.5
    };
    const projectConfigDir = path.join(tempDir, '.groq');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'local-settings.json'),
      JSON.stringify(projectConfig)
    );
    
    // Create manager with specific start directory
    const manager = new ConfigManager(tempDir);
    t.is(manager.getDefaultModel(), 'test-model');
    t.is(manager.getTemperature(), 0.5);
    t.truthy(manager.getProjectConfigPath());
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('ConfigManager finds project config in parent directory', t => {
  const tempDir = createTempDir();
  const subDir = path.join(tempDir, 'subdir');
  fs.mkdirSync(subDir);
  
  try {
    // Create a project config in parent
    const projectConfig = {
      defaultModel: 'parent-model',
      systemMessage: 'test message'
    };
    const projectConfigDir = path.join(tempDir, '.groq');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'local-settings.json'),
      JSON.stringify(projectConfig)
    );
    
    // Create manager starting from subdirectory
    const manager = new ConfigManager(subDir);
    t.is(manager.getDefaultModel(), 'parent-model');
    t.is(manager.getSystemMessage(), 'test message');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('ConfigManager merges project and global configs correctly', t => {
  const homeDir = createTempDir();
  const projectDir = createTempDir();
  
  try {
    // Set up fake home directory with global config
    const globalGroqDir = path.join(homeDir, '.groq');
    fs.mkdirSync(globalGroqDir);
    
    // Create global config
    const globalConfig = {
      groqApiKey: 'global-key',
      defaultModel: 'global-model',
      temperature: 1.0
    };
    fs.writeFileSync(
      path.join(globalGroqDir, 'local-settings.json'),
      JSON.stringify(globalConfig)
    );
    
    // Create project config in a different directory (should override some global settings)
    // Note: intentionally not including groqApiKey to test that it's inherited from global
    const projectConfig = {
      defaultModel: 'project-model',
      temperature: 0.7,
      systemMessage: 'project message'
    };
    const projectConfigDir = path.join(projectDir, '.groq');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'local-settings.json'),
      JSON.stringify(projectConfig)
    );
    
    // Pass projectDir as start directory and homeDir as home directory
    const manager = new ConfigManager(projectDir, homeDir);
    
    // Project config should override global
    t.is(manager.getDefaultModel(), 'project-model');
    t.is(manager.getTemperature(), 0.7);
    
    // Global config should still be used for non-overridden values
    t.is(manager.getApiKey(), 'global-key');
    
    // Project-only values should work
    t.is(manager.getSystemMessage(), 'project message');
  } finally {
    cleanupTempDir(homeDir);
    cleanupTempDir(projectDir);
  }
});

test('ConfigManager returns null/empty when no configs exist', t => {
  const tempDir = createTempDir();
  
  try {
    // Pass tempDir as both start directory and home directory
    const manager = new ConfigManager(tempDir, tempDir);
    
    t.is(manager.getApiKey(), null);
    t.is(manager.getDefaultModel(), null);
    t.is(manager.getTemperature(), null);
    t.is(manager.getSystemMessage(), null);
    t.deepEqual(manager.getExcludePatterns(), []);
    t.deepEqual(manager.getIncludePatterns(), []);
    t.is(manager.getProjectConfigPath(), null);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('ConfigManager.initProjectConfig creates correct default config', t => {
  const tempDir = createTempDir();
  
  try {
    const manager = new ConfigManager(tempDir);
    manager.initProjectConfig(tempDir);
    
    const configPath = path.join(tempDir, '.groq', 'local-settings.json');
    t.true(fs.existsSync(configPath));
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    t.is(config.defaultModel, 'moonshotai/kimi-k2-instruct');
    t.is(config.temperature, 1);
    t.truthy(config.excludePatterns);
    t.truthy(config.includePatterns);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('ConfigManager.initProjectConfig throws if config already exists', t => {
  const tempDir = createTempDir();
  
  try {
    // Create existing config
    const projectConfigDir = path.join(tempDir, '.groq');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'local-settings.json'),
      JSON.stringify({ existing: true })
    );
    
    const manager = new ConfigManager(tempDir);
    t.throws(() => manager.initProjectConfig(tempDir), {
      message: /already exists/
    });
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('ConfigManager handles malformed JSON gracefully', t => {
  const tempDir = createTempDir();
  
  try {
    // Create malformed config
    const projectConfigDir = path.join(tempDir, '.groq');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'local-settings.json'),
      '{ invalid json }'
    );
    
    const manager = new ConfigManager(tempDir);
    
    // Should return defaults when config is malformed
    t.is(manager.getDefaultModel(), null);
    t.is(manager.getTemperature(), null);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('ConfigManager.getAllConfig returns merged configuration', t => {
  const tempDir = createTempDir();
  
  try {
    const config = {
      defaultModel: 'test-model',
      temperature: 0.8,
      excludePatterns: ['*.log'],
      includePatterns: ['*.ts']
    };
    
    const projectConfigDir = path.join(tempDir, '.groq');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'local-settings.json'),
      JSON.stringify(config)
    );
    
    const manager = new ConfigManager(tempDir);
    const allConfig = manager.getAllConfig();
    
    t.is(allConfig.defaultModel, 'test-model');
    t.is(allConfig.temperature, 0.8);
    t.deepEqual(allConfig.excludePatterns, ['*.log']);
    t.deepEqual(allConfig.includePatterns, ['*.ts']);
  } finally {
    cleanupTempDir(tempDir);
  }
});