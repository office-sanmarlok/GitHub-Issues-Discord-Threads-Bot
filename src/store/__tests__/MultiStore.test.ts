import { MultiStore } from '../MultiStore';
import { RepositoryMapping } from '../../types/configTypes';
import { Thread } from '../../interfaces';

jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MultiStore', () => {
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
    },
    {
      id: 'mapping3',
      channel_id: 'channel789',
      repository: {
        owner: 'owner3',
        name: 'repo3'
      },
      enabled: false // Disabled mapping
    }
  ];

  const mockThread1: Thread = {
    id: 'thread1',
    title: 'Test Thread 1',
    appliedTags: [],
    archived: false,
    locked: false,
    comments: []
  };

  const mockThread2: Thread = {
    id: 'thread2',
    title: 'Test Thread 2',
    appliedTags: [],
    archived: false,
    locked: false,
    comments: [],
    number: 42,
    node_id: 'node123'
  };

  beforeEach(async () => {
    multiStore = new MultiStore();
    await multiStore.initialize(testMappings);
  });

  describe('initialization', () => {
    it('should initialize stores for enabled mappings only', () => {
      const stores = multiStore.getAllStores();
      expect(stores.size).toBe(2); // Only 2 enabled mappings

      expect(multiStore.getStore('mapping1')).toBeDefined();
      expect(multiStore.getStore('mapping2')).toBeDefined();
      expect(multiStore.getStore('mapping3')).toBeUndefined(); // Disabled
    });

    it('should build channel lookup index', () => {
      expect(multiStore.getStoreByChannel('channel123')).toBeDefined();
      expect(multiStore.getStoreByChannel('channel456')).toBeDefined();
      expect(multiStore.getStoreByChannel('channel789')).toBeUndefined(); // Disabled
      expect(multiStore.getStoreByChannel('unknown')).toBeUndefined();
    });

    it('should build repository lookup index', () => {
      expect(multiStore.getStoreByRepo('owner1', 'repo1')).toBeDefined();
      expect(multiStore.getStoreByRepo('owner2', 'repo2')).toBeDefined();
      expect(multiStore.getStoreByRepo('owner3', 'repo3')).toBeUndefined(); // Disabled
      expect(multiStore.getStoreByRepo('unknown', 'unknown')).toBeUndefined();
    });
  });

  describe('store isolation', () => {
    it('should maintain isolated stores per mapping', () => {
      const store1 = multiStore.getStore('mapping1');
      const store2 = multiStore.getStore('mapping2');

      expect(store1).not.toBe(store2);

      // Add thread to store1
      multiStore.addThread('mapping1', mockThread1);
      
      expect(store1?.threads).toHaveLength(1);
      expect(store2?.threads).toHaveLength(0);
    });

    it('should not allow cross-contamination between stores', () => {
      multiStore.addThread('mapping1', mockThread1);
      multiStore.addThread('mapping2', mockThread2);

      const thread1InMapping1 = multiStore.getThread('mapping1', 'thread1');
      const thread2InMapping1 = multiStore.getThread('mapping1', 'thread2');
      const thread1InMapping2 = multiStore.getThread('mapping2', 'thread1');
      const thread2InMapping2 = multiStore.getThread('mapping2', 'thread2');

      expect(thread1InMapping1).toBeDefined();
      expect(thread2InMapping1).toBeUndefined();
      expect(thread1InMapping2).toBeUndefined();
      expect(thread2InMapping2).toBeDefined();
    });
  });

  describe('thread operations', () => {
    it('should add thread with mapping ID', () => {
      multiStore.addThread('mapping1', mockThread1);
      
      const thread = multiStore.getThread('mapping1', 'thread1');
      expect(thread).toBeDefined();
      expect(thread?.mappingId).toBe('mapping1');
    });

    it('should remove thread from correct store', () => {
      multiStore.addThread('mapping1', mockThread1);
      multiStore.addThread('mapping2', mockThread2);

      multiStore.removeThread('mapping1', 'thread1');

      expect(multiStore.getThread('mapping1', 'thread1')).toBeUndefined();
      expect(multiStore.getThread('mapping2', 'thread2')).toBeDefined();
    });

    it('should update thread in correct store', () => {
      multiStore.addThread('mapping1', mockThread1);

      const updated = multiStore.updateThread('mapping1', 'thread1', {
        title: 'Updated Title',
        number: 100
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.number).toBe(100);
    });

    it('should get thread by channel', () => {
      multiStore.addThread('mapping1', mockThread1);

      const thread = multiStore.getThreadByChannel('channel123', 'thread1');
      expect(thread).toBeDefined();
      expect(thread?.id).toBe('thread1');

      const notFound = multiStore.getThreadByChannel('channel456', 'thread1');
      expect(notFound).toBeUndefined();
    });
  });

  describe('mapping lookups', () => {
    it('should get mapping by channel', () => {
      const mapping = multiStore.getMappingByChannel('channel123');
      expect(mapping).toBeDefined();
      expect(mapping?.id).toBe('mapping1');
    });

    it('should get mapping by repository', () => {
      const mapping = multiStore.getMappingByRepo('owner2', 'repo2');
      expect(mapping).toBeDefined();
      expect(mapping?.id).toBe('mapping2');
    });

    it('should get mapping by ID', () => {
      const mapping = multiStore.getMappingById('mapping1');
      expect(mapping).toBeDefined();
      expect(mapping?.channel_id).toBe('channel123');
    });
  });

  describe('management checks', () => {
    it('should check if channel is managed', () => {
      expect(multiStore.isChannelManaged('channel123')).toBe(true);
      expect(multiStore.isChannelManaged('channel456')).toBe(true);
      expect(multiStore.isChannelManaged('channel789')).toBe(false); // Disabled
      expect(multiStore.isChannelManaged('unknown')).toBe(false);
    });

    it('should check if repository is managed', () => {
      expect(multiStore.isRepoManaged('owner1', 'repo1')).toBe(true);
      expect(multiStore.isRepoManaged('owner2', 'repo2')).toBe(true);
      expect(multiStore.isRepoManaged('owner3', 'repo3')).toBe(false); // Disabled
      expect(multiStore.isRepoManaged('unknown', 'unknown')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should aggregate statistics across all stores', () => {
      multiStore.addThread('mapping1', mockThread1);
      multiStore.addThread('mapping2', mockThread2);

      const stats = multiStore.getStatistics();

      expect(stats.totalMappings).toBe(2);
      expect(stats.totalThreads).toBe(2);
      expect(stats.totalIssues).toBe(1); // Only thread2 has an issue number
      expect(stats.mappings).toHaveLength(2);
    });

    it('should include metrics per mapping', () => {
      multiStore.addThread('mapping1', mockThread1);

      const stats = multiStore.getStatistics();
      const mapping1Stats = stats.mappings.find((m: any) => m.id === 'mapping1');

      expect(mapping1Stats).toBeDefined();
      expect(mapping1Stats.metrics.threadCount).toBe(1);
      expect(mapping1Stats.metrics.operations.created).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle operations on non-existent mapping', () => {
      expect(() => {
        multiStore.addThread('nonexistent', mockThread1);
      }).not.toThrow();

      expect(() => {
        multiStore.removeThread('nonexistent', 'thread1');
      }).not.toThrow();

      const thread = multiStore.getThread('nonexistent', 'thread1');
      expect(thread).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all stores and mappings', () => {
      multiStore.addThread('mapping1', mockThread1);
      multiStore.addThread('mapping2', mockThread2);

      multiStore.clear();

      expect(multiStore.getAllStores().size).toBe(0);
      expect(multiStore.getStoreByChannel('channel123')).toBeUndefined();
      expect(multiStore.getStoreByRepo('owner1', 'repo1')).toBeUndefined();
    });
  });
});