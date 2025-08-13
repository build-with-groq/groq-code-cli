import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Config {
  groqApiKey?: string;
  defaultModel?: string;
  temperature?: number;
  systemMessage?: string;
  excludePatterns?: string[];
  includePatterns?: string[];
}

const CONFIG_DIR = '.groq';
const CONFIG_FILE = 'local-settings.json';
const PROJECT_CONFIG_DIR = '.groq';
const PROJECT_CONFIG_FILE = 'local-settings.json';

export class ConfigManager {
  private configPath: string;
  private projectConfigPath: string | null = null;
  private mergedConfig: Config | null = null;

  constructor(startDir?: string, homeDir?: string) {
    const home = homeDir || os.homedir();
    this.configPath = path.join(home, CONFIG_DIR, CONFIG_FILE);
    this.findProjectConfig(startDir);
  }

  private ensureConfigDir(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  private findProjectConfig(startDir?: string): void {
    let currentDir = startDir || process.cwd();
    const root = path.parse(currentDir).root;
    
    while (currentDir !== root) {
      const configPath = path.join(currentDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
      if (fs.existsSync(configPath)) {
        this.projectConfigPath = configPath;
        break;
      }
      currentDir = path.dirname(currentDir);
    }
  }

  private loadGlobalConfig(): Config {
    try {
      if (!fs.existsSync(this.configPath)) {
        return {};
      }
      const configData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Failed to read global config file:', error);
      return {};
    }
  }

  private loadProjectConfig(): Config {
    if (!this.projectConfigPath) {
      return {};
    }
    
    try {
      const configData = fs.readFileSync(this.projectConfigPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Failed to read project config file:', error);
      return {};
    }
  }

  private getMergedConfig(): Config {
    if (!this.mergedConfig) {
      const globalConfig = this.loadGlobalConfig();
      const projectConfig = this.loadProjectConfig();
      // Project config takes precedence over global config
      this.mergedConfig = { ...globalConfig, ...projectConfig };
    }
    return this.mergedConfig;
  }

  public getProjectConfigPath(): string | null {
    return this.projectConfigPath;
  }

  public getApiKey(): string | null {
    const config = this.getMergedConfig();
    return config.groqApiKey || null;
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
      // Invalidate cache after updating config
      this.mergedConfig = null;
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
      // Invalidate cache after updating config
      this.mergedConfig = null;
    } catch (error) {
      console.warn('Failed to clear API key:', error);
    }
  }

  public getDefaultModel(): string | null {
    const config = this.getMergedConfig();
    return config.defaultModel || null;
  }

  public getTemperature(): number | null {
    const config = this.getMergedConfig();
    return config.temperature ?? null;
  }

  public getSystemMessage(): string | null {
    const config = this.getMergedConfig();
    return config.systemMessage || null;
  }

  public getExcludePatterns(): string[] {
    const config = this.getMergedConfig();
    return config.excludePatterns || [];
  }

  public getIncludePatterns(): string[] {
    const config = this.getMergedConfig();
    return config.includePatterns || [];
  }

  public getAllConfig(): Config {
    return this.getMergedConfig();
  }

  public initProjectConfig(targetDir?: string): void {
    const dir = targetDir || process.cwd();
    const projectConfigDir = path.join(dir, PROJECT_CONFIG_DIR);
    const projectConfigPath = path.join(projectConfigDir, PROJECT_CONFIG_FILE);
    
    if (fs.existsSync(projectConfigPath)) {
      throw new Error(`Project config already exists at ${projectConfigPath}`);
    }
    
    // Ensure the .groq directory exists
    if (!fs.existsSync(projectConfigDir)) {
      fs.mkdirSync(projectConfigDir, { recursive: true });
    }
    
    const defaultConfig: Config = {
      defaultModel: 'moonshotai/kimi-k2-instruct',
      temperature: 1,
      excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']
    };
    
    fs.writeFileSync(projectConfigPath, JSON.stringify(defaultConfig, null, 2), {
      mode: 0o600
    });
    
    this.projectConfigPath = projectConfigPath;
    this.mergedConfig = null; // Reset cache
  }

  public setDefaultModel(model: string): void {
    if (this.projectConfigPath) {
      this.setProjectDefaultModel(model);
      return;
    }
    try {
      this.ensureConfigDir();
      const config: Config = fs.existsSync(this.configPath)
        ? JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        : {};
      config.defaultModel = model;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600,
      });
      // Invalidate merged cache to reflect new default model immediately
      this.mergedConfig = null;
    } catch (error) {
      throw new Error(`Failed to save default model: ${error}`);
    }
  }

  private setProjectDefaultModel(model: string): void {
    if (!this.projectConfigPath) {
      throw new Error('No project config path available');
    }
    const projectPath = this.projectConfigPath;
    let config: Config = {};
    if (fs.existsSync(projectPath)) {
      config = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    }
    config.defaultModel = model;
    fs.writeFileSync(projectPath, JSON.stringify(config, null, 2), {
      mode: 0o600,
    });
    this.mergedConfig = null; // clear cache
  }
}