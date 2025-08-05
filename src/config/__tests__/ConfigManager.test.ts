import { ConfigManager } from '../ConfigManager';
import * as fs from 'fs';
import * as path from 'path';
import { BotConfig } from '../../types/configTypes';

jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ConfigManager', () => {
  const testConfigPath = path.join(__dirname, 'test-config.json');
  let configManager: ConfigManager;

  const validConfig: BotConfig = {
    discord_token: 'test_discord_token',
    github_access_token: 'test_github_token',
    webhook_port: 5000,
    mappings: [
      {
        id: 'mapping1',
        channel_id: 'channel123',
        repository: {
          owner: 'testowner',
          name: 'testrepo'
        },
        enabled: true
      },
      {
        id: 'mapping2',
        channel_id: 'channel456',
        repository: {
          owner: 'testowner2',
          name: 'testrepo2'
        },
        webhook_secret: 'secret123',
        enabled: true
      }
    ]
  };

  beforeEach(() => {
    configManager = new ConfigManager(testConfigPath);
  });

  afterEach(() => {
    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('loadConfig', () => {
    it('should load valid JSON configuration', async () => {
      fs.writeFileSync(testConfigPath, JSON.stringify(validConfig));
      
      const config = await configManager.loadConfig();
      
      expect(config).toEqual(validConfig);
      expect(config.mappings).toHaveLength(2);
    });

    it('should throw error when config file does not exist', async () => {
      await expect(configManager.loadConfig()).rejects.toThrow('Configuration file not found');
    });

    it('should throw error for invalid JSON', async () => {
      fs.writeFileSync(testConfigPath, 'invalid json {');
      
      await expect(configManager.loadConfig()).rejects.toThrow('Invalid JSON');
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = { ...validConfig, discord_token: '' };
      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig));
      
      await expect(configManager.loadConfig()).rejects.toThrow('Invalid configuration');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const result = configManager.validateConfig(validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration without discord_token', () => {
      const invalidConfig = { ...validConfig, discord_token: '' };
      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'discord_token',
        message: 'Discord token is required'
      });
    });

    it('should reject configuration without github_access_token', () => {
      const invalidConfig = { ...validConfig, github_access_token: '' };
      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'github_access_token',
        message: 'GitHub access token is required'
      });
    });

    it('should reject empty mappings array', () => {
      const invalidConfig = { ...validConfig, mappings: [] };
      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'mappings',
        message: 'At least one mapping is required'
      });
    });

    it('should reject duplicate mapping IDs', () => {
      const invalidConfig = {
        ...validConfig,
        mappings: [
          ...validConfig.mappings,
          { ...validConfig.mappings[0] } // Duplicate ID
        ]
      };
      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'mappings[2].id',
        message: 'Duplicate mapping ID: mapping1'
      });
    });

    it('should warn about duplicate channel mappings', () => {
      const configWithDuplicateChannel = {
        ...validConfig,
        mappings: [
          validConfig.mappings[0],
          {
            ...validConfig.mappings[1],
            id: 'mapping3',
            channel_id: validConfig.mappings[0].channel_id // Same channel
          }
        ]
      };
      const result = configManager.validateConfig(configWithDuplicateChannel);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(`Channel ${validConfig.mappings[0].channel_id} is mapped multiple times`);
    });

    it('should warn about duplicate repository mappings', () => {
      const configWithDuplicateRepo = {
        ...validConfig,
        mappings: [
          validConfig.mappings[0],
          {
            ...validConfig.mappings[1],
            id: 'mapping3',
            repository: validConfig.mappings[0].repository // Same repo
          }
        ]
      };
      const result = configManager.validateConfig(configWithDuplicateRepo);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        `Repository ${validConfig.mappings[0].repository.owner}/${validConfig.mappings[0].repository.name} is mapped multiple times`
      );
    });

    it('should reject invalid webhook port', () => {
      const invalidConfig = { ...validConfig, webhook_port: 70000 };
      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'webhook_port',
        message: 'Webhook port must be a number between 1 and 65535'
      });
    });

    it('should reject invalid log level', () => {
      const invalidConfig = { ...validConfig, log_level: 'invalid' as any };
      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'log_level',
        message: 'Log level must be one of: debug, info, warn, error'
      });
    });
  });

  describe('mapping lookups', () => {
    beforeEach(async () => {
      fs.writeFileSync(testConfigPath, JSON.stringify(validConfig));
      await configManager.loadConfig();
    });

    it('should get mapping by channel ID', () => {
      const mapping = configManager.getMapping('channel123');
      
      expect(mapping).toBeDefined();
      expect(mapping?.id).toBe('mapping1');
      expect(mapping?.channel_id).toBe('channel123');
    });

    it('should return undefined for unknown channel ID', () => {
      const mapping = configManager.getMapping('unknown');
      
      expect(mapping).toBeUndefined();
    });

    it('should get mapping by repository', () => {
      const mapping = configManager.getMappingByRepo('testowner', 'testrepo');
      
      expect(mapping).toBeDefined();
      expect(mapping?.id).toBe('mapping1');
      expect(mapping?.repository.owner).toBe('testowner');
      expect(mapping?.repository.name).toBe('testrepo');
    });

    it('should return undefined for unknown repository', () => {
      const mapping = configManager.getMappingByRepo('unknown', 'unknown');
      
      expect(mapping).toBeUndefined();
    });

    it('should get mapping by ID', () => {
      const mapping = configManager.getMappingById('mapping2');
      
      expect(mapping).toBeDefined();
      expect(mapping?.id).toBe('mapping2');
    });

    it('should get all enabled mappings', () => {
      const mappings = configManager.getMappings();
      
      expect(mappings).toHaveLength(2);
      expect(mappings[0].id).toBe('mapping1');
      expect(mappings[1].id).toBe('mapping2');
    });

    it('should exclude disabled mappings', async () => {
      const configWithDisabled = {
        ...validConfig,
        mappings: [
          ...validConfig.mappings,
          {
            id: 'mapping3',
            channel_id: 'channel789',
            repository: { owner: 'owner3', name: 'repo3' },
            enabled: false
          }
        ]
      };
      
      fs.writeFileSync(testConfigPath, JSON.stringify(configWithDisabled));
      await configManager.reloadConfig();
      
      const mappings = configManager.getMappings();
      expect(mappings).toHaveLength(2);
      expect(mappings.find(m => m.id === 'mapping3')).toBeUndefined();
    });
  });

  describe('reloadConfig', () => {
    it('should reload configuration from file', async () => {
      fs.writeFileSync(testConfigPath, JSON.stringify(validConfig));
      await configManager.loadConfig();
      
      const modifiedConfig = {
        ...validConfig,
        mappings: [validConfig.mappings[0]] // Remove second mapping
      };
      
      fs.writeFileSync(testConfigPath, JSON.stringify(modifiedConfig));
      const reloadedConfig = await configManager.reloadConfig();
      
      expect(reloadedConfig.mappings).toHaveLength(1);
      expect(configManager.getMappings()).toHaveLength(1);
    });
  });
});