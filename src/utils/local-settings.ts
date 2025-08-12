import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Config {
  groqApiKey?: string;
  defaultModel?: string;
  hooks?: any;
}

const CONFIG_DIR = '.groq'; // In home directory and project root
const CONFIG_FILE = 'local-settings.json';

export class ConfigManager {
  private globalConfigPath: string;
  private localConfigPath: string;

  constructor() {
    const homeDir = os.homedir();
    this.globalConfigPath = path.join(homeDir, CONFIG_DIR, CONFIG_FILE);
    const projectRoot = this.getProjectRoot();
    this.localConfigPath = path.join(projectRoot, CONFIG_DIR, CONFIG_FILE);
  }

  private getProjectRoot(): string {
    let dir = process.cwd();
    const root = path.parse(dir).root;

    while (true) {
      if (
        fs.existsSync(path.join(dir, '.git')) ||
        fs.existsSync(path.join(dir, 'package.json')) ||
        fs.existsSync(path.join(dir, CONFIG_DIR))
      ) {
        return dir;
      }
      if (dir === root) {
        break;
      }
      dir = path.dirname(dir);
    }

    return process.cwd();
  }

  private ensureConfigDir(configPath: string): void {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  private ensureGitIgnore(): void {
    // Ensure .groq/local-settings.json is ignored by git (for project-local configs)
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const ignoreEntry = '.groq/local-settings.json';
    
    try {
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      }
      
      // Check if the ignore entry is already present
      if (!gitignoreContent.includes(ignoreEntry)) {
        // Add the ignore entry
        const newContent = gitignoreContent + (gitignoreContent.endsWith('\n') ? '' : '\n') + ignoreEntry + '\n';
        fs.writeFileSync(gitignorePath, newContent);
      }
    } catch (error) {
      // Silently fail if we can't update gitignore (e.g., no write permissions)
      console.warn('Warning: Could not update .gitignore to exclude .groq/local-settings.json');
    }
  }

  private readConfig(configPath: string): Config | null {
    try {
      if (!fs.existsSync(configPath)) {
        return null;
      }
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      return null;
    }
  }

  private writeConfig(configPath: string, config: Config): void {
    this.ensureConfigDir(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
      mode: 0o600 // Read/write for owner only
    });
  }

  private getMergedConfig(): Config {
    const globalConfig = this.readConfig(this.globalConfigPath) || {};
    const localConfig = this.readConfig(this.localConfigPath) || {};
    
    // Local project settings take precedence over global user settings
    const merged: Config = { ...globalConfig, ...localConfig };
    // Ensure hooks follow special merge rules (arrays concatenated, objects overridden)
    if (globalConfig.hooks || localConfig.hooks) {
      merged.hooks = this.mergeHooks(
        globalConfig.hooks || {},
        localConfig.hooks || {}
      );
    }
    return merged;
  }

  public getApiKey(): string | null {
    try {
      const config = this.getMergedConfig();
      return config.groqApiKey || null;
    } catch (error) {
      console.warn('Failed to read config file:', error);
      return null;
    }
  }

  public setApiKey(apiKey: string, isGlobal: boolean = true): void {
    try {
      const configPath = isGlobal ? this.globalConfigPath : this.localConfigPath;
      let config = this.readConfig(configPath) || {};
      config.groqApiKey = apiKey;
      this.writeConfig(configPath, config);
    } catch (error) {
      throw new Error(`Failed to save API key: ${error}`);
    }
  }

  public clearApiKey(isGlobal: boolean = true): void {
    try {
      const configPath = isGlobal ? this.globalConfigPath : this.localConfigPath;
      const config = this.readConfig(configPath);
      if (!config) return;

      delete config.groqApiKey;

      if (Object.keys(config).length === 0) {
        fs.unlinkSync(configPath);
      } else {
        this.writeConfig(configPath, config);
      }
    } catch (error) {
      console.warn('Failed to clear API key:', error);
    }
  }

  public getDefaultModel(): string | null {
    try {
      const config = this.getMergedConfig();
      return config.defaultModel || null;
    } catch (error) {
      console.warn('Failed to read default model:', error);
      return null;
    }
  }

  public setDefaultModel(model: string, isGlobal: boolean = true): void {
    try {
      const configPath = isGlobal ? this.globalConfigPath : this.localConfigPath;
      let config = this.readConfig(configPath) || {};
      config.defaultModel = model;
      this.writeConfig(configPath, config);
    } catch (error) {
      throw new Error(`Failed to save default model: ${error}`);
    }
  }

  public getHooksConfig(): { global: any; local: any; merged: any } {
    try {
      const globalConfig = this.readConfig(this.globalConfigPath);
      const localConfig = this.readConfig(this.localConfigPath);
      
      const globalHooks = globalConfig?.hooks || {};
      const localHooks = localConfig?.hooks || {};
      
      // Honor GROQ_NO_LOCAL_HOOKS: when set to "true", drop all local hooks
      const disableLocal = process.env.GROQ_NO_LOCAL_HOOKS === 'true';
      // Merge hooks - arrays are concatenated (local after global); objects are overridden by local
      const mergedHooks = this.mergeHooks(globalHooks, disableLocal ? {} : localHooks);
      
      return {
        global: globalHooks,
        local: localHooks,
        merged: mergedHooks
      };
    } catch (error) {
      console.warn('Failed to read hooks config:', error);
      return { global: {}, local: {}, merged: {} };
    }
  }

  public mergeHooks(globalHooks: any, localHooks: any): any {
    const merged: any = {};
    
    // Start with global hooks
    for (const [hookType, hookDefs] of Object.entries(globalHooks)) {
      merged[hookType] = hookDefs;
    }
    
    // Override/add local hooks
    for (const [hookType, hookDefs] of Object.entries(localHooks)) {
      if (Array.isArray(hookDefs)) {
        // For array-based hooks, concatenate (local hooks run after global)
        merged[hookType] = [...(merged[hookType] || []), ...hookDefs];
      } else {
        // For object-based hooks, override
        merged[hookType] = hookDefs;
      }
    }
    
    return merged;
  }

  public setHooksConfig(hooks: any, isGlobal: boolean = false): void {
    try {
      const configPath = isGlobal ? this.globalConfigPath : this.localConfigPath;
      let config = this.readConfig(configPath) || {};
      config.hooks = hooks;
      this.writeConfig(configPath, config);
      
      // If setting local config, ensure gitignore is updated
      if (!isGlobal) {
        this.ensureGitIgnore();
      }
    } catch (error) {
      throw new Error(`Failed to save hooks config: ${error}`);
    }
  }

  public hasLocalConfig(): boolean {
    return fs.existsSync(this.localConfigPath);
  }

  public hasGlobalConfig(): boolean {
    return fs.existsSync(this.globalConfigPath);
  }
}