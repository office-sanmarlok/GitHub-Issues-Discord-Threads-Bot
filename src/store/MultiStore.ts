import { RepositoryMapping } from '../types/configTypes';
import { EnhancedStore } from './EnhancedStore';
import { Thread } from '../interfaces';
import { logger } from '../logger';

export class MultiStore {
  private stores: Map<string, EnhancedStore> = new Map();
  private mappings: Map<string, RepositoryMapping> = new Map();
  private channelToMapping: Map<string, string> = new Map();
  private repoToMapping: Map<string, string> = new Map();

  /**
   * Initialize the multi-store with repository mappings
   */
  async initialize(mappings: RepositoryMapping[]): Promise<void> {
    logger.info(`Initializing MultiStore with ${mappings.length} mapping(s)`);

    // Clear existing stores and mappings
    this.clear();

    // Create stores for each enabled mapping
    for (const mapping of mappings) {
      if (!mapping.enabled) {
        logger.debug(`Skipping disabled mapping: ${mapping.id}`);
        continue;
      }

      // Create new store for this mapping
      const store = new EnhancedStore();
      this.stores.set(mapping.id, store);
      this.mappings.set(mapping.id, mapping);

      // Build lookup indexes
      this.channelToMapping.set(mapping.channel_id, mapping.id);
      const repoKey = this.getRepoKey(mapping.repository.owner, mapping.repository.name);
      this.repoToMapping.set(repoKey, mapping.id);

      logger.info(
        `Initialized store for mapping ${mapping.id}: ` +
        `Channel ${mapping.channel_id} <-> ${mapping.repository.owner}/${mapping.repository.name}`
      );
    }

    logger.info(`MultiStore initialization complete. Active mappings: ${this.stores.size}`);
  }

  /**
   * Get store by mapping ID
   */
  getStore(mappingId: string): EnhancedStore | undefined {
    return this.stores.get(mappingId);
  }

  /**
   * Get store by mapping ID (alias for getStore)
   */
  getStoreByMappingId(mappingId: string): EnhancedStore | undefined {
    return this.getStore(mappingId);
  }

  /**
   * Get store by Discord channel ID
   */
  getStoreByChannel(channelId: string): EnhancedStore | undefined {
    const mappingId = this.channelToMapping.get(channelId);
    if (!mappingId) return undefined;
    return this.stores.get(mappingId);
  }

  /**
   * Get store by GitHub repository
   */
  getStoreByRepo(owner: string, repo: string): EnhancedStore | undefined {
    const repoKey = this.getRepoKey(owner, repo);
    const mappingId = this.repoToMapping.get(repoKey);
    if (!mappingId) return undefined;
    return this.stores.get(mappingId);
  }

  /**
   * Get all stores
   */
  getAllStores(): Map<string, EnhancedStore> {
    return new Map(this.stores);
  }

  /**
   * Get mapping by channel ID
   */
  getMappingByChannel(channelId: string): RepositoryMapping | undefined {
    const mappingId = this.channelToMapping.get(channelId);
    if (!mappingId) return undefined;
    return this.mappings.get(mappingId);
  }

  /**
   * Get mapping by repository
   */
  getMappingByRepo(owner: string, repo: string): RepositoryMapping | undefined {
    const repoKey = this.getRepoKey(owner, repo);
    const mappingId = this.repoToMapping.get(repoKey);
    if (!mappingId) return undefined;
    return this.mappings.get(mappingId);
  }

  /**
   * Get mapping by ID
   */
  getMappingById(mappingId: string): RepositoryMapping | undefined {
    return this.mappings.get(mappingId);
  }

  /**
   * Get all mappings
   */
  getAllMappings(): RepositoryMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Get mapping (alias for getMappingById)
   */
  getMapping(mappingId: string): RepositoryMapping | undefined {
    return this.getMappingById(mappingId);
  }

  /**
   * Add thread to the appropriate store
   */
  addThread(mappingId: string, thread: Thread): void {
    const store = this.getStore(mappingId);
    if (!store) {
      logger.error(`Cannot add thread: Store not found for mapping ${mappingId}`);
      return;
    }

    // Ensure thread has the mapping ID
    thread.mappingId = mappingId;
    store.addThread(thread);
    
    logger.debug(`Added thread ${thread.id} to store ${mappingId}`);
  }

  /**
   * Remove thread from the appropriate store
   */
  removeThread(mappingId: string, threadId: string): void {
    const store = this.getStore(mappingId);
    if (!store) {
      logger.error(`Cannot remove thread: Store not found for mapping ${mappingId}`);
      return;
    }

    store.deleteThread(threadId);
    logger.debug(`Removed thread ${threadId} from store ${mappingId}`);
  }

  /**
   * Get thread from the appropriate store
   */
  getThread(mappingId: string, threadId: string): Thread | undefined {
    const store = this.getStore(mappingId);
    if (!store) {
      logger.error(`Cannot get thread: Store not found for mapping ${mappingId}`);
      return undefined;
    }

    return store.getThread(threadId);
  }

  /**
   * Get thread by channel (searches the channel's store)
   */
  getThreadByChannel(channelId: string, threadId: string): Thread | undefined {
    const store = this.getStoreByChannel(channelId);
    if (!store) {
      return undefined;
    }

    return store.getThread(threadId);
  }

  /**
   * Update thread in the appropriate store
   */
  updateThread(mappingId: string, threadId: string, updates: Partial<Thread>): Thread | undefined {
    const store = this.getStore(mappingId);
    if (!store) {
      logger.error(`Cannot update thread: Store not found for mapping ${mappingId}`);
      return undefined;
    }

    return store.updateThread(threadId, updates);
  }

  /**
   * Check if a channel is managed
   */
  isChannelManaged(channelId: string): boolean {
    return this.channelToMapping.has(channelId);
  }

  /**
   * Check if a repository is managed
   */
  isRepoManaged(owner: string, repo: string): boolean {
    const repoKey = this.getRepoKey(owner, repo);
    return this.repoToMapping.has(repoKey);
  }

  /**
   * Get statistics for all stores
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalMappings: this.stores.size,
      totalThreads: 0,
      totalIssues: 0,
      mappings: []
    };

    for (const [mappingId, store] of this.stores) {
      const mapping = this.mappings.get(mappingId);
      const metrics = store.getMetrics();
      
      stats.totalThreads += metrics.threadCount;
      stats.totalIssues += metrics.issueCount;
      
      stats.mappings.push({
        id: mappingId,
        channel: mapping?.channel_id,
        repository: mapping ? `${mapping.repository.owner}/${mapping.repository.name}` : 'unknown',
        metrics
      });
    }

    return stats;
  }

  /**
   * Clear all stores and mappings
   */
  clear(): void {
    for (const store of this.stores.values()) {
      store.clear();
    }
    
    this.stores.clear();
    this.mappings.clear();
    this.channelToMapping.clear();
    this.repoToMapping.clear();
    
    logger.info('MultiStore cleared');
  }

  
  /**
   * Dynamically add a new mapping and initialize its store
   */
  async addMapping(mapping: RepositoryMapping): Promise<void> {
    try {
      // Check if mapping already exists
      if (this.mappings.has(mapping.id)) {
        throw new Error(`Mapping already exists: ${mapping.id}`);
      }
      
      // Create new store
      const store = new EnhancedStore();
      
      // Add to collections
      this.stores.set(mapping.id, store);
      this.mappings.set(mapping.id, mapping);
      this.channelToMapping.set(mapping.channel_id, mapping.id);
      
      const repoKey = this.getRepoKey(mapping.repository.owner, mapping.repository.name);
      this.repoToMapping.set(repoKey, mapping.id);
      
      logger.info('Added mapping to MultiStore', {
        id: mapping.id,
        repo: `${mapping.repository.owner}/${mapping.repository.name}`,
        channel: mapping.channel_id
      });
    } catch (error) {
      logger.error('Failed to add mapping to MultiStore', error as Error);
      throw error;
    }
  }
  
  /**
   * Dynamically remove a mapping and its store
   */
  async removeMapping(mappingId: string): Promise<void> {
    try {
      // Get mapping
      const mapping = this.mappings.get(mappingId);
      if (!mapping) {
        throw new Error(`Mapping not found: ${mappingId}`);
      }
      
      // Clear and remove store
      const store = this.stores.get(mappingId);
      if (store) {
        store.clear();
        this.stores.delete(mappingId);
      }
      
      // Remove from collections
      this.mappings.delete(mappingId);
      this.channelToMapping.delete(mapping.channel_id);
      
      const repoKey = this.getRepoKey(mapping.repository.owner, mapping.repository.name);
      this.repoToMapping.delete(repoKey);
      
      logger.info('Removed mapping from MultiStore', {
        id: mappingId,
        repo: `${mapping.repository.owner}/${mapping.repository.name}`
      });
    } catch (error) {
      logger.error('Failed to remove mapping from MultiStore', error as Error);
      throw error;
    }
  }

  /**
   * Create repository key for lookups
   */
  private getRepoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }
}