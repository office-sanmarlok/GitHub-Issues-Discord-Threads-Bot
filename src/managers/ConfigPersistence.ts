import { promises as fs } from 'fs';
import * as path from 'path';
import { BotConfig } from '../types/configTypes';
import { RepositoryMapping } from '../types/commandTypes';
import { logger } from '../logger';

export class FileLock {
  private static locks = new Map<string, Promise<void>>();
  
  static async withLock<T>(
    filePath: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const currentLock = this.locks.get(filePath);
    if (currentLock) {
      await currentLock;
    }
    
    let resolve: () => void;
    const newLock = new Promise<void>(r => resolve = r);
    this.locks.set(filePath, newLock);
    
    try {
      return await operation();
    } finally {
      resolve!();
      this.locks.delete(filePath);
    }
  }
}

export class ConfigPersistence {
  private configPath: string;
  private backupDir: string;
  
  constructor(configPath: string = 'config.json') {
    this.configPath = path.resolve(configPath);
    this.backupDir = path.join(path.dirname(this.configPath), '.config-backups');
  }
  
  async loadConfig(): Promise<BotConfig> {
    return FileLock.withLock(this.configPath, async () => {
      try {
        const data = await fs.readFile(this.configPath, 'utf-8');
        const config = JSON.parse(data) as BotConfig;
        
        // Ensure required fields exist
        if (!config.mappings) {
          config.mappings = [];
        }
        
        return config;
      } catch (error) {
        logger.error('Failed to load config', error as Error);
        throw error;
      }
    });
  }
  
  async saveConfig(config: BotConfig): Promise<void> {
    return FileLock.withLock(this.configPath, async () => {
      try {
        // Create backup before saving
        await this.createBackup();
        
        // Write config with pretty formatting
        const data = JSON.stringify(config, null, 2);
        await fs.writeFile(this.configPath, data, 'utf-8');
        
        logger.info('Config saved successfully');
      } catch (error) {
        logger.error('Failed to save config', error as Error);
        throw error;
      }
    });
  }
  
  async addMapping(mapping: RepositoryMapping): Promise<void> {
    return FileLock.withLock(this.configPath, async () => {
      try {
        const config = await this.loadConfigInternal();
        
        // Check for duplicates
        const existing = config.mappings.find(
          m => m.repository.owner === mapping.repository.owner &&
               m.repository.name === mapping.repository.name
        );
        
        if (existing) {
          throw new Error(`Mapping already exists for ${mapping.repository.owner}/${mapping.repository.name}`);
        }
        
        // Add new mapping
        config.mappings.push(mapping);
        
        // Save config
        await this.saveConfigInternal(config);
        
        logger.info('Added mapping', {
          id: mapping.id,
          repo: `${mapping.repository.owner}/${mapping.repository.name}`
        });
      } catch (error) {
        logger.error('Failed to add mapping', error as Error);
        throw error;
      }
    });
  }
  
  async removeMapping(mappingId: string): Promise<void> {
    return FileLock.withLock(this.configPath, async () => {
      try {
        const config = await this.loadConfigInternal();
        
        // Find mapping index
        const index = config.mappings.findIndex(m => m.id === mappingId);
        
        if (index === -1) {
          throw new Error(`Mapping not found: ${mappingId}`);
        }
        
        // Remove mapping
        const removed = config.mappings.splice(index, 1)[0];
        
        // Save config
        await this.saveConfigInternal(config);
        
        logger.info('Removed mapping', {
          id: mappingId,
          repo: `${removed.repository.owner}/${removed.repository.name}`
        });
      } catch (error) {
        logger.error('Failed to remove mapping', error as Error);
        throw error;
      }
    });
  }
  
  async updateMapping(mappingId: string, updates: Partial<RepositoryMapping>): Promise<void> {
    return FileLock.withLock(this.configPath, async () => {
      try {
        const config = await this.loadConfigInternal();
        
        // Find mapping
        const mapping = config.mappings.find(m => m.id === mappingId);
        
        if (!mapping) {
          throw new Error(`Mapping not found: ${mappingId}`);
        }
        
        // Apply updates
        Object.assign(mapping, updates);
        
        // Save config
        await this.saveConfigInternal(config);
        
        logger.info('Updated mapping', {
          id: mappingId,
          updates: Object.keys(updates)
        });
      } catch (error) {
        logger.error('Failed to update mapping', error as Error);
        throw error;
      }
    });
  }
  
  async createBackup(): Promise<string> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `config-${timestamp}.json`);
      
      // Copy current config to backup
      const data = await fs.readFile(this.configPath, 'utf-8');
      await fs.writeFile(backupFile, data, 'utf-8');
      
      // Clean old backups (keep last 10)
      await this.cleanOldBackups();
      
      logger.info(`Created backup: ${backupFile}`);
      return backupFile;
    } catch (error) {
      logger.error('Failed to create backup', error as Error);
      // Don't throw - backup failure shouldn't prevent config update
      return '';
    }
  }
  
  async rollback(backupPath: string): Promise<void> {
    return FileLock.withLock(this.configPath, async () => {
      try {
        // Verify backup file exists
        await fs.access(backupPath);
        
        // Read backup
        const data = await fs.readFile(backupPath, 'utf-8');
        
        // Validate it's valid JSON
        JSON.parse(data);
        
        // Restore backup
        await fs.writeFile(this.configPath, data, 'utf-8');
        
        logger.info(`Rolled back to: ${backupPath}`);
      } catch (error) {
        logger.error('Failed to rollback', error as Error);
        throw error;
      }
    });
  }
  
  private async loadConfigInternal(): Promise<BotConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data) as BotConfig;
    } catch (error) {
      logger.error('Failed to load config internally', error as Error);
      throw error;
    }
  }
  
  private async saveConfigInternal(config: BotConfig): Promise<void> {
    try {
      const data = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configPath, data, 'utf-8');
    } catch (error) {
      logger.error('Failed to save config internally', error as Error);
      throw error;
    }
  }
  
  private async cleanOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('config-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      // Keep only the 10 most recent backups
      const toDelete = backupFiles.slice(10);
      
      for (const file of toDelete) {
        await fs.unlink(path.join(this.backupDir, file));
        logger.debug(`Deleted old backup: ${file}`);
      }
    } catch (error) {
      logger.error('Failed to clean old backups', error as Error);
    }
  }
}