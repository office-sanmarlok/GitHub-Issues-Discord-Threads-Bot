import { ConfigManager } from '../config/ConfigManager';
import { MultiStore } from '../store/MultiStore';
import { ContextProvider } from '../context/ContextProvider';
import { WebhookRouter } from '../webhook/WebhookRouter';
import { GitHubClientFactory } from '../github/GitHubClientFactory';
import { IsolatedErrorHandler } from '../error/IsolatedErrorHandler';
import { HealthMonitor } from '../monitoring/HealthMonitor';
import { BotConfig, RepositoryMapping } from '../types/configTypes';
import * as fs from 'fs';
import * as path from 'path';

// Mock modules
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('fs');
jest.mock('@octokit/rest');
jest.mock('@octokit/graphql');

describe('Multi-Repository Integration Tests', () => {
  let configManager: ConfigManager;
  let multiStore: MultiStore;
  let contextProvider: ContextProvider;
  let webhookRouter: WebhookRouter;
  let githubFactory: GitHubClientFactory;
  let errorHandler: IsolatedErrorHandler;
  let healthMonitor: HealthMonitor;

  const testConfig: BotConfig = {
    discord_token: 'test_discord_token',
    github_access_token: 'test_github_token',
    webhook_port: 5000,
    webhook_path: '/webhook',
    log_level: 'info',
    health_check_interval: 60000,
    mappings: [
      {
        id: 'mapping1',
        channel_id: 'channel1',
        repository: {
          owner: 'owner1',
          name: 'repo1'
        },
        webhook_secret: 'secret1',
        enabled: true
      },
      {
        id: 'mapping2',
        channel_id: 'channel2',
        repository: {
          owner: 'owner2',
          name: 'repo2'
        },
        enabled: true
      },
      {
        id: 'mapping3',
        channel_id: 'channel3',
        repository: {
          owner: 'owner3',
          name: 'repo3'
        },
        enabled: false
      }
    ]
  };

  beforeEach(async () => {
    // Setup mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(testConfig));

    // Initialize components
    configManager = new ConfigManager();
    multiStore = new MultiStore();
    contextProvider = new ContextProvider(multiStore);
    webhookRouter = new WebhookRouter(multiStore, contextProvider);
    githubFactory = new GitHubClientFactory('test_token');
    errorHandler = new IsolatedErrorHandler();
    healthMonitor = new HealthMonitor(multiStore, errorHandler, testConfig);

    // Initialize stores
    await multiStore.initialize(testConfig.mappings);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should load configuration successfully', async () => {
      const config = await configManager.loadConfig();
      expect(config).toEqual(testConfig);
      expect(config.mappings).toHaveLength(3);
    });

    it('should initialize stores for enabled mappings only', () => {
      const stores = multiStore.getAllStores();
      expect(stores.size).toBe(2); // Only 2 enabled mappings
      expect(multiStore.getStoreByMappingId('mapping1')).toBeDefined();
      expect(multiStore.getStoreByMappingId('mapping2')).toBeDefined();
      expect(multiStore.getStoreByMappingId('mapping3')).toBeUndefined();
    });

    it('should create context from channel ID', () => {
      const context = contextProvider.fromChannelId('channel1');
      expect(context).toBeDefined();
      expect(context?.mapping.id).toBe('mapping1');
      expect(context?.repoCredentials.owner).toBe('owner1');
      expect(context?.repoCredentials.repo).toBe('repo1');
    });

    it('should create context from repository', () => {
      const context = contextProvider.fromRepository('owner2', 'repo2');
      expect(context).toBeDefined();
      expect(context?.mapping.id).toBe('mapping2');
      expect(context?.mapping.channel_id).toBe('channel2');
    });
  });

  describe('Data Isolation', () => {
    it('should maintain separate stores for each mapping', () => {
      const store1 = multiStore.getStoreByChannelId('channel1');
      const store2 = multiStore.getStoreByChannelId('channel2');

      expect(store1).not.toBe(store2);
      
      // Add thread to store1
      store1!.threads.push({
        id: 'thread1',
        title: 'Test Thread 1',
        appliedTags: [],
        archived: false,
        locked: false,
        comments: []
      });

      // Verify isolation
      expect(store1!.threads).toHaveLength(1);
      expect(store2!.threads).toHaveLength(0);
    });

    it('should handle errors in isolation', async () => {
      const context1 = contextProvider.fromChannelId('channel1');
      const context2 = contextProvider.fromChannelId('channel2');

      // Simulate error in mapping1
      errorHandler.handleError(context1!, new Error('Test error'), 'test-operation');

      // Check metrics isolation
      const metrics1 = errorHandler.getMetrics('mapping1');
      const metrics2 = errorHandler.getMetrics('mapping2');

      expect(metrics1?.totalErrors).toBe(1);
      expect(metrics2?.totalErrors).toBeUndefined();
    });
  });

  describe('Webhook Routing', () => {
    it('should route webhook to correct mapping', () => {
      const payload = {
        action: 'opened',
        repository: {
          owner: { login: 'owner1' },
          name: 'repo1',
          full_name: 'owner1/repo1'
        }
      };

      const { owner, repo } = webhookRouter.extractRepository(payload);
      expect(owner).toBe('owner1');
      expect(repo).toBe('repo1');

      const context = contextProvider.fromRepository(owner, repo);
      expect(context?.mapping.id).toBe('mapping1');
    });

    it('should validate webhook signature when configured', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'secret1';
      
      // Generate valid signature
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;

      const isValid = webhookRouter.validateSignature(payload, signature, secret);
      expect(isValid).toBe(true);

      // Test invalid signature
      const isInvalid = webhookRouter.validateSignature(payload, 'sha256=invalid', secret);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    it('should report health status for each mapping', async () => {
      const health1 = await healthMonitor.getMappingHealth('mapping1');
      const health2 = await healthMonitor.getMappingHealth('mapping2');

      expect(health1?.status).toBe('healthy');
      expect(health1?.mappingId).toBe('mapping1');
      expect(health1?.metrics.threadCount).toBe(0);

      expect(health2?.status).toBe('healthy');
      expect(health2?.mappingId).toBe('mapping2');
    });

    it('should report system-wide health', async () => {
      const systemHealth = await healthMonitor.getSystemHealth();

      expect(systemHealth.status).toBe('healthy');
      expect(systemHealth.systemMetrics.totalMappings).toBe(3);
      expect(systemHealth.systemMetrics.activeMappings).toBe(2);
      expect(systemHealth.systemMetrics.healthyMappings).toBe(2);
    });

    it('should detect unhealthy mappings', async () => {
      const context = contextProvider.fromChannelId('channel1');
      
      // Simulate multiple errors
      for (let i = 0; i < 11; i++) {
        errorHandler.handleError(context!, new Error(`Error ${i}`), 'test-op');
      }

      const health = await healthMonitor.getMappingHealth('mapping1');
      expect(health?.status).toBe('unhealthy');
      expect(health?.metrics.consecutiveErrors).toBe(11);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const { MappingCircuitBreaker } = require('../error/IsolatedErrorHandler');
      const circuitBreaker = new MappingCircuitBreaker(3, 1000, 5000);

      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('mapping1', failingOperation);
        } catch (e) {
          // Expected
        }
      }

      // Circuit should be open
      expect(circuitBreaker.isOpen('mapping1')).toBe(true);

      // Further calls should fail immediately
      await expect(
        circuitBreaker.execute('mapping1', failingOperation)
      ).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Error Recovery', () => {
    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const context = contextProvider.fromChannelId('channel1')!;
      const result = await errorHandler.executeWithRetry(
        context,
        'test-operation',
        operation,
        { maxRetries: 3, initialDelay: 10 }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent events across mappings', async () => {
      const store1 = multiStore.getStoreByChannelId('channel1');
      const store2 = multiStore.getStoreByChannelId('channel2');

      // Simulate concurrent thread creation
      const promises = [
        Promise.resolve(store1!.threads.push({
          id: 'thread1',
          title: 'Thread 1',
          appliedTags: [],
          archived: false,
          locked: false,
          comments: []
        })),
        Promise.resolve(store2!.threads.push({
          id: 'thread2',
          title: 'Thread 2',
          appliedTags: [],
          archived: false,
          locked: false,
          comments: []
        }))
      ];

      await Promise.all(promises);

      // Verify isolation maintained
      expect(store1!.threads).toHaveLength(1);
      expect(store2!.threads).toHaveLength(1);
      expect(store1!.threads[0].id).toBe('thread1');
      expect(store2!.threads[0].id).toBe('thread2');
    });
  });

  describe('Performance', () => {
    it('should handle 10 mappings efficiently', async () => {
      const largeMappings: RepositoryMapping[] = [];
      for (let i = 0; i < 10; i++) {
        largeMappings.push({
          id: `mapping${i}`,
          channel_id: `channel${i}`,
          repository: {
            owner: `owner${i}`,
            name: `repo${i}`
          },
          enabled: true
        });
      }

      const largeStore = new MultiStore();
      const startTime = Date.now();
      
      await largeStore.initialize(largeMappings);
      
      const initTime = Date.now() - startTime;
      expect(initTime).toBeLessThan(1000); // Should initialize in under 1 second

      // Verify all stores created
      expect(largeStore.getAllStores().size).toBe(10);
    });

    it('should maintain sub-2 second response times', async () => {
      const context = contextProvider.fromChannelId('channel1')!;
      
      const startTime = Date.now();
      
      // Simulate typical operations
      const operations = [
        githubFactory.getClient(context),
        errorHandler.getMetrics('mapping1'),
        healthMonitor.getMappingHealth('mapping1')
      ];

      await Promise.all(operations);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000);
    });
  });
});