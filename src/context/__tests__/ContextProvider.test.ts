import { ContextProvider } from '../ContextProvider';
import { MultiStore } from '../../store/MultiStore';
import { RepositoryMapping } from '../../types/configTypes';
import { WebhookPayload } from '../../types/contextTypes';

jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ContextProvider', () => {
  let contextProvider: ContextProvider;
  let multiStore: MultiStore;

  const testMappings: RepositoryMapping[] = [
    {
      id: 'mapping1',
      channel_id: 'channel123',
      repository: {
        owner: 'owner1',
        name: 'repo1'
      },
      enabled: true
    },
    {
      id: 'mapping2',
      channel_id: 'channel456',
      repository: {
        owner: 'owner2',
        name: 'repo2'
      },
      enabled: true,
      webhook_secret: 'secret'
    }
  ];

  beforeEach(async () => {
    multiStore = new MultiStore();
    await multiStore.initialize(testMappings);
    contextProvider = new ContextProvider(multiStore);
  });

  describe('fromChannel', () => {
    it('should create context from valid channel ID', () => {
      const context = contextProvider.fromChannel('channel123');

      expect(context).toBeDefined();
      expect(context?.mapping.id).toBe('mapping1');
      expect(context?.repoCredentials.owner).toBe('owner1');
      expect(context?.repoCredentials.repo).toBe('repo1');
      expect(context?.store).toBeDefined();
      expect(context?.logger).toBeDefined();
    });

    it('should return undefined for unknown channel', () => {
      const context = contextProvider.fromChannel('unknown');

      expect(context).toBeUndefined();
    });

    it('should create contextual logger with correct format', () => {
      const context = contextProvider.fromChannel('channel123');
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      context?.logger.info('Test message');

      // Logger should include mapping ID and repository in the message
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mapping1]'),
        expect.stringContaining('owner1/repo1')
      );

      logSpy.mockRestore();
    });
  });

  describe('fromRepository', () => {
    it('should create context from valid repository', () => {
      const context = contextProvider.fromRepository('owner2', 'repo2');

      expect(context).toBeDefined();
      expect(context?.mapping.id).toBe('mapping2');
      expect(context?.mapping.webhook_secret).toBe('secret');
      expect(context?.repoCredentials.owner).toBe('owner2');
      expect(context?.repoCredentials.repo).toBe('repo2');
    });

    it('should return undefined for unknown repository', () => {
      const context = contextProvider.fromRepository('unknown', 'unknown');

      expect(context).toBeUndefined();
    });
  });

  describe('fromWebhook', () => {
    it('should create context from valid webhook payload', () => {
      const payload: WebhookPayload = {
        action: 'opened',
        repository: {
          owner: { login: 'owner1' },
          name: 'repo1',
          full_name: 'owner1/repo1'
        },
        sender: {
          login: 'user',
          id: 123,
          avatar_url: 'https://example.com',
          type: 'User'
        }
      };

      const context = contextProvider.fromWebhook(payload);

      expect(context).toBeDefined();
      expect(context?.mapping.id).toBe('mapping1');
      expect(context?.repoCredentials.owner).toBe('owner1');
      expect(context?.repoCredentials.repo).toBe('repo1');
    });

    it('should return undefined for webhook with unknown repository', () => {
      const payload: WebhookPayload = {
        action: 'opened',
        repository: {
          owner: { login: 'unknown' },
          name: 'unknown',
          full_name: 'unknown/unknown'
        },
        sender: {
          login: 'user',
          id: 123,
          avatar_url: 'https://example.com',
          type: 'User'
        }
      };

      const context = contextProvider.fromWebhook(payload);

      expect(context).toBeUndefined();
    });

    it('should handle webhook payload without repository', () => {
      const payload = {
        action: 'ping'
      } as WebhookPayload;

      const context = contextProvider.fromWebhook(payload);

      expect(context).toBeUndefined();
    });
  });

  describe('management checks', () => {
    it('should check if channel is managed', () => {
      expect(contextProvider.isChannelManaged('channel123')).toBe(true);
      expect(contextProvider.isChannelManaged('channel456')).toBe(true);
      expect(contextProvider.isChannelManaged('unknown')).toBe(false);
    });

    it('should check if repository is managed', () => {
      expect(contextProvider.isRepositoryManaged('owner1', 'repo1')).toBe(true);
      expect(contextProvider.isRepositoryManaged('owner2', 'repo2')).toBe(true);
      expect(contextProvider.isRepositoryManaged('unknown', 'unknown')).toBe(false);
    });
  });

  describe('shouldProcessWebhook', () => {
    it('should return true for managed repository', () => {
      const payload: WebhookPayload = {
        action: 'opened',
        repository: {
          owner: { login: 'owner1' },
          name: 'repo1',
          full_name: 'owner1/repo1'
        },
        sender: {
          login: 'user',
          id: 123,
          avatar_url: 'https://example.com',
          type: 'User'
        }
      };

      expect(contextProvider.shouldProcessWebhook(payload)).toBe(true);
    });

    it('should return false for unmanaged repository', () => {
      const payload: WebhookPayload = {
        action: 'opened',
        repository: {
          owner: { login: 'unknown' },
          name: 'unknown',
          full_name: 'unknown/unknown'
        },
        sender: {
          login: 'user',
          id: 123,
          avatar_url: 'https://example.com',
          type: 'User'
        }
      };

      expect(contextProvider.shouldProcessWebhook(payload)).toBe(false);
    });

    it('should return false for payload without repository', () => {
      const payload = {
        action: 'ping'
      } as WebhookPayload;

      expect(contextProvider.shouldProcessWebhook(payload)).toBe(false);
    });
  });

  describe('getAllContexts', () => {
    it('should return contexts for all active mappings', () => {
      const contexts = contextProvider.getAllContexts();

      expect(contexts).toHaveLength(2);
      expect(contexts[0].mapping.id).toBe('mapping1');
      expect(contexts[1].mapping.id).toBe('mapping2');

      contexts.forEach(context => {
        expect(context.store).toBeDefined();
        expect(context.repoCredentials).toBeDefined();
        expect(context.logger).toBeDefined();
      });
    });

    it('should return empty array when no mappings exist', async () => {
      const emptyMultiStore = new MultiStore();
      await emptyMultiStore.initialize([]);
      const emptyProvider = new ContextProvider(emptyMultiStore);

      const contexts = emptyProvider.getAllContexts();

      expect(contexts).toHaveLength(0);
    });
  });
});