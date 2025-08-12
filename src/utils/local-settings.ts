import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CustomCommandConfig {
  command: string;
  description?: string;
  customPrompt?: string; // preferred key
  prompt?: string;       // alias for customPrompt
  appendArgs?: boolean;
  role?: 'user' | 'system';
}

interface Config {
  groqApiKey?: string;
  defaultModel?: string;
  customCommands?: CustomCommandConfig[];
}

const CONFIG_DIR = '.groq'; // In home directory
const CONFIG_FILE = 'local-settings.json';

export class ConfigManager {
  private configPath: string;
  private projectConfigPath: string;

  constructor() {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, CONFIG_DIR, CONFIG_FILE);
    // Project-level settings: ./.groq/local-settings.json
    this.projectConfigPath = path.join(process.cwd(), CONFIG_DIR, CONFIG_FILE);
  }

  private ensureConfigDir(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  public getApiKey(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      return config.groqApiKey || null;
    } catch (error) {
      console.warn('Failed to read config file:', error);
      return null;
    }
  }

  public setApiKey(apiKey: string): void {
    try {
      this.ensureConfigDir();

      let config: Config = {};
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        config = JSON.parse(configData);
      }

      config.groqApiKey = apiKey;

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600 // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save API key: ${error}`);
    }
  }

  public clearApiKey(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      delete config.groqApiKey;

      if (Object.keys(config).length === 0) {
        fs.unlinkSync(this.configPath);
      } else {
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
          mode: 0o600
        });
      }
    } catch (error) {
      console.warn('Failed to clear API key:', error);
    }
  }

  public getDefaultModel(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      return config.defaultModel || null;
    } catch (error) {
      console.warn('Failed to read default model:', error);
      return null;
    }
  }

  public setDefaultModel(model: string): void {
    try {
      this.ensureConfigDir();

      let config: Config = {};
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        config = JSON.parse(configData);
      }

      config.defaultModel = model;

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600 // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save default model: ${error}`);
    }
  }

  // --- Custom commands ---
  public getCustomCommands(): CustomCommandConfig[] {
    try {
      const project = this.readConfigIfExists(this.projectConfigPath);
      const global = this.readConfigIfExists(this.configPath);
      const projectCommands = Array.isArray(project.customCommands) ? project.customCommands : [];
      const globalCommands = Array.isArray(global.customCommands) ? global.customCommands : [];

      // Merge with project commands taking precedence by command name
      const map = new Map<string, CustomCommandConfig>();
      for (const c of globalCommands) {
        if (c && typeof c.command === 'string') map.set(c.command, c);
      }
      for (const c of projectCommands) {
        if (c && typeof c.command === 'string') map.set(c.command, c);
      }
      return Array.from(map.values());
    } catch (error) {
      return [];
    }
  }

  private readConfigIfExists(filePath: string): Config {
    try {
      if (!fs.existsSync(filePath)) return {};
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as Config;
    } catch {
      return {};
    }
  }
}