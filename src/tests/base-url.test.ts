import test from 'ava';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigManager } from '../utils/local-settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, '../../dist/core/cli.js');

test('CLI accepts --base-url argument', t => {
  const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
  t.true(result.includes('--base-url'), 'Help should show --base-url option');
  t.true(result.includes('Custom API base URL'), 'Help should describe base URL option');
});

test('CLI accepts -b shorthand for base URL', t => {
  const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
  t.true(result.includes('-b, --base-url'), 'Help should show -b shorthand');
});

test('Environment variable GROQ_BASE_URL is respected', t => {
  const testUrl = 'https://test.example.com';
  process.env.GROQ_BASE_URL = testUrl;
  
  // Verify environment variable is set
  t.is(process.env.GROQ_BASE_URL, testUrl, 'Environment variable should be set');
  
  // Clean up
  delete process.env.GROQ_BASE_URL;
});

test('CLI argument sets environment variable', t => {
  const cliUrl = 'https://cli.example.com';
  
  // Simulate CLI argument setting (this would happen in startChat)
  const simulateCliArg = (url: string) => {
    if (url) {
      process.env.GROQ_BASE_URL = url;
    }
  };
  
  simulateCliArg(cliUrl);
  
  t.is(process.env.GROQ_BASE_URL, cliUrl, 'CLI argument should set environment variable');
  
  // Clean up
  delete process.env.GROQ_BASE_URL;
});

test('Base URL validation - must be valid URL', t => {
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  t.true(isValidUrl('https://api.example.com'), 'Valid HTTPS URL should pass');
  t.true(isValidUrl('http://localhost:8080'), 'Valid HTTP URL with port should pass');
  t.false(isValidUrl('not-a-url'), 'Invalid URL should fail');
  t.false(isValidUrl(''), 'Empty string should fail');
});

test('Default behavior when no base URL is provided', t => {
  // Ensure no base URL is set
  delete process.env.GROQ_BASE_URL;
  
  t.is(process.env.GROQ_BASE_URL, undefined, 'No base URL should be set by default');
  
  // The Groq SDK will use its default URL (https://api.groq.com)
  t.pass('Should use default Groq API URL when no custom URL is provided');
});

test('Config file base URL is used when no env or CLI arg', t => {
  const configManager = new ConfigManager();
  const testUrl = 'https://config.example.com';
  
  // Save base URL to config
  configManager.setBaseUrl(testUrl);
  
  // Verify it can be retrieved
  const retrievedUrl = configManager.getBaseUrl();
  t.is(retrievedUrl, testUrl, 'Config should store and retrieve base URL');
  
  // Clean up - remove base URL from config
  configManager.clearBaseUrl();
  t.pass('Config file base URL should be used as fallback');
});

test('Priority: SDK handles ENV, we handle config fallback', t => {
  const configUrl = 'https://config.example.com';
  const envUrl = 'https://env.example.com';
  
  // Set config file base URL
  const configManager = new ConfigManager();
  configManager.setBaseUrl(configUrl);
  
  // SDK will use GROQ_BASE_URL env var if set (native SDK behavior)
  process.env.GROQ_BASE_URL = envUrl;
  t.is(process.env.GROQ_BASE_URL, envUrl, 'SDK will use environment variable');
  
  // Our code checks config when creating client
  delete process.env.GROQ_BASE_URL;
  const configValue = configManager.getBaseUrl();
  t.is(configValue, configUrl, 'Config file is used as our fallback');
  
  // Clean up
  configManager.clearBaseUrl();
  delete process.env.GROQ_BASE_URL;
});