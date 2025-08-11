import * as fs from 'fs';
import * as path from 'path';
import { 
  BotConfig, 
  RepositoryMapping, 
  ValidationResult, 
  ValidationError 
} from '../types/configTypes';
import { logger } from '../logger';

import { ConfigPersistence } from '../managers/ConfigPersistence';

export class ConfigManager {
  private config: BotConfig | null = null;
  private configPath: string;
  private mappingsById: Map<string, RepositoryMapping> = new Map();
  private mappingsByChannel: Map<string, RepositoryMapping> = new Map();
  private mappingsByRepo: Map<string, RepositoryMapping> = new Map();

  constructor(configPath: string = 'config.json') {
    this.configPath = path.resolve(process.cwd(), configPath);
  }

  /**
   * Load configuration from JSON file
   */
  async loadConfig(): Promise<BotConfig> {
    try {
      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found at ${this.configPath}`);
      }

      // Read and parse config file
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configContent) as BotConfig;

      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        throw new Error(`Invalid configuration: ${errorMessages}`);
      }

      // Store config and build indexes
      this.config = config;
      this.buildMappingIndexes();

      // Log warnings if any
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          logger.warn(`Configuration warning: ${warning}`);
        });
      }

      logger.info(`Configuration loaded successfully with ${config.mappings.length} mapping(s)`);
      return config;

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate configuration structure and values
   */
  validateConfig(config: BotConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Check required top-level fields
    if (!config.discord_token) {
      errors.push({ field: 'discord_token', message: 'Discord token is required' });
    }

    if (!config.github_access_token) {
      errors.push({ field: 'github_access_token', message: 'GitHub access token is required' });
    }

    if (!config.mappings || !Array.isArray(config.mappings)) {
      errors.push({ field: 'mappings', message: 'Mappings array is required' });
    } else if (config.mappings.length === 0) {
      // Changed from error to warning - allow empty mappings
      warnings.push('No repository mappings configured. Use !watch command to add mappings dynamically.');
    } else {
      // Validate each mapping
      const mappingIds = new Set<string>();
      const channelIds = new Set<string>();
      const repoKeys = new Set<string>();

      config.mappings.forEach((mapping, index) => {
        const fieldPrefix = `mappings[${index}]`;

        // Check required mapping fields
        if (!mapping.id) {
          errors.push({ 
            field: `${fieldPrefix}.id`, 
            message: 'Mapping ID is required' 
          });
        } else if (mappingIds.has(mapping.id)) {
          errors.push({ 
            field: `${fieldPrefix}.id`, 
            message: `Duplicate mapping ID: ${mapping.id}` 
          });
        } else {
          mappingIds.add(mapping.id);
        }

        if (!mapping.channel_id) {
          errors.push({ 
            field: `${fieldPrefix}.channel_id`, 
            message: 'Channel ID is required' 
          });
        } else if (channelIds.has(mapping.channel_id)) {
          warnings.push(`Channel ${mapping.channel_id} is mapped multiple times`);
        } else {
          channelIds.add(mapping.channel_id);
        }

        if (!mapping.repository) {
          errors.push({ 
            field: `${fieldPrefix}.repository`, 
            message: 'Repository configuration is required' 
          });
        } else {
          if (!mapping.repository.owner) {
            errors.push({ 
              field: `${fieldPrefix}.repository.owner`, 
              message: 'Repository owner is required' 
            });
          }

          if (!mapping.repository.name) {
            errors.push({ 
              field: `${fieldPrefix}.repository.name`, 
              message: 'Repository name is required' 
            });
          }

          if (mapping.repository.owner && mapping.repository.name) {
            const repoKey = `${mapping.repository.owner}/${mapping.repository.name}`;
            if (repoKeys.has(repoKey)) {
              warnings.push(`Repository ${repoKey} is mapped multiple times`);
            } else {
              repoKeys.add(repoKey);
            }
          }
        }

        // Validate enabled field
        if (typeof mapping.enabled !== 'boolean') {
          errors.push({ 
            field: `${fieldPrefix}.enabled`, 
            message: 'Enabled field must be a boolean' 
          });
        }

        // Validate webhook secret if provided
        if (mapping.webhook_secret !== undefined && typeof mapping.webhook_secret !== 'string') {
          errors.push({ 
            field: `${fieldPrefix}.webhook_secret`, 
            message: 'Webhook secret must be a string' 
          });
        }
      });
    }

    // Validate webhook port
    if (config.webhook_port !== undefined) {
      if (typeof config.webhook_port !== 'number' || 
          config.webhook_port < 1 || 
          config.webhook_port > 65535) {
        errors.push({ 
          field: 'webhook_port', 
          message: 'Webhook port must be a number between 1 and 65535' 
        });
      }
    }

    // Validate log level
    if (config.log_level !== undefined) {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(config.log_level)) {
        errors.push({ 
          field: 'log_level', 
          message: `Log level must be one of: ${validLevels.join(', ')}` 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Build mapping indexes for fast lookup
   */
  private buildMappingIndexes(): void {
    if (!this.config) return;

    this.mappingsById.clear();
    this.mappingsByChannel.clear();
    this.mappingsByRepo.clear();

    for (const mapping of this.config.mappings) {
      if (!mapping.enabled) continue;

      this.mappingsById.set(mapping.id, mapping);
      this.mappingsByChannel.set(mapping.channel_id, mapping);
      
      const repoKey = `${mapping.repository.owner}/${mapping.repository.name}`;
      this.mappingsByRepo.set(repoKey, mapping);
    }
  }

  /**
   * Get all configured mappings
   */
  getMappings(): RepositoryMapping[] {
    if (!this.config) return [];
    return this.config.mappings.filter(m => m.enabled);
  }

  /**
   * Get mapping by channel ID
   */
  getMapping(channelId: string): RepositoryMapping | undefined {
    return this.mappingsByChannel.get(channelId);
  }

  /**
   * Get mapping by repository owner and name
   */
  getMappingByRepo(owner: string, repo: string): RepositoryMapping | undefined {
    const repoKey = `${owner}/${repo}`;
    return this.mappingsByRepo.get(repoKey);
  }

  /**
   * Get mapping by ID
   */
  getMappingById(id: string): RepositoryMapping | undefined {
    return this.mappingsById.get(id);
  }

  /**
   * Get the full configuration
   */
  getConfig(): BotConfig | null {
    return this.config;
  }

  /**
   * Reload configuration from file
   */
  async reloadConfig(): Promise<BotConfig> {
    this.config = null;
    this.mappingsById.clear();
    this.mappingsByChannel.clear();
    this.mappingsByRepo.clear();
    
    return this.loadConfig();
  }

  async addMapping(mapping: RepositoryMapping): Promise<void> {
    try {
      // Add to config
      this.config!.mappings.push(mapping);
      
      // Rebuild indexes
      this.buildMappingIndexes();
      
      // Save to disk using ConfigPersistence
      const persistence = new ConfigPersistence(this.configPath);
      await persistence.saveConfig(this.config!);
      
      logger.info('Added mapping to config', {
        id: mapping.id,
        repo: `${mapping.repository.owner}/${mapping.repository.name}`
      });
    } catch (error) {
      logger.error('Failed to add mapping to config', error as Error);
      throw error;
    }
  }
  
  async removeMapping(mappingId: string): Promise<void> {
    try {
      // Find and remove from config
      const index = this.config!.mappings.findIndex(m => m.id === mappingId);
      if (index === -1) {
        throw new Error(`Mapping not found: ${mappingId}`);
      }
      
      this.config!.mappings.splice(index, 1);
      
      // Rebuild indexes
      this.buildMappingIndexes();
      
      // Save to disk using ConfigPersistence
      const persistence = new ConfigPersistence(this.configPath);
      await persistence.saveConfig(this.config!);
      
      logger.info('Removed mapping from config', { id: mappingId });
    } catch (error) {
      logger.error('Failed to remove mapping from config', error as Error);
      throw error;
    }
  }
}