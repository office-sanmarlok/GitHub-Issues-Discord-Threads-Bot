import { 
  ContextProvider as IContextProvider, 
  MappingContext, 
  WebhookPayload,
  ContextualLogger 
} from '../types/contextTypes';
import { MultiStore } from '../store/MultiStore';
import { logger } from '../logger';
import { RepoCredentials } from '../types/configTypes';

/**
 * Implementation of contextual logger that includes mapping information
 */
class MappingContextualLogger implements ContextualLogger {
  constructor(private mappingId: string, private channelId: string, private repository: string) {}

  info(message: string, ...args: any[]): void {
    logger.info(`[${this.mappingId}] ${this.repository} | ${message}`, ...args);
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (error) {
      logger.error(`[${this.mappingId}] ${this.repository} | ${message}: ${error.message}`, ...args);
    } else {
      logger.error(`[${this.mappingId}] ${this.repository} | ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    logger.warn(`[${this.mappingId}] ${this.repository} | ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    logger.debug(`[${this.mappingId}] ${this.repository} | ${message}`, ...args);
  }
}

export class ContextProvider implements IContextProvider {
  constructor(private multiStore: MultiStore) {}

  /**
   * Create context from mapping
   */
  fromMapping(mapping: any): MappingContext | undefined {
    const store = this.multiStore.getStore(mapping.id);
    if (!store) {
      logger.error(`Store not found for mapping ${mapping.id}`);
      return undefined;
    }

    const repoCredentials: RepoCredentials = {
      owner: mapping.repository.owner,
      repo: mapping.repository.name
    };

    const contextLogger = new MappingContextualLogger(
      mapping.id,
      mapping.channel_id,
      `${mapping.repository.owner}/${mapping.repository.name}`
    );

    return {
      mapping,
      store,
      repoCredentials,
      logger: contextLogger
    };
  }

  /**
   * Create context from Discord channel ID (alias for fromChannel)
   */
  fromChannelId(channelId: string): MappingContext | undefined {
    return this.fromChannel(channelId);
  }

  /**
   * Create context from Discord channel ID
   */
  fromChannel(channelId: string): MappingContext | undefined {
    const mapping = this.multiStore.getMappingByChannel(channelId);
    if (!mapping) {
      logger.debug(`No mapping found for channel ${channelId}`);
      return undefined;
    }

    const store = this.multiStore.getStore(mapping.id);
    if (!store) {
      logger.error(`Store not found for mapping ${mapping.id}`);
      return undefined;
    }

    const repoCredentials: RepoCredentials = {
      owner: mapping.repository.owner,
      repo: mapping.repository.name
    };

    const contextLogger = new MappingContextualLogger(
      mapping.id,
      mapping.channel_id,
      `${mapping.repository.owner}/${mapping.repository.name}`
    );

    return {
      mapping,
      store,
      repoCredentials,
      logger: contextLogger
    };
  }

  /**
   * Create context from GitHub repository information
   */
  fromRepository(owner: string, repo: string): MappingContext | undefined {
    const mapping = this.multiStore.getMappingByRepo(owner, repo);
    if (!mapping) {
      logger.debug(`No mapping found for repository ${owner}/${repo}`);
      return undefined;
    }

    const store = this.multiStore.getStore(mapping.id);
    if (!store) {
      logger.error(`Store not found for mapping ${mapping.id}`);
      return undefined;
    }

    const repoCredentials: RepoCredentials = {
      owner: mapping.repository.owner,
      repo: mapping.repository.name
    };

    const contextLogger = new MappingContextualLogger(
      mapping.id,
      mapping.channel_id,
      `${mapping.repository.owner}/${mapping.repository.name}`
    );

    return {
      mapping,
      store,
      repoCredentials,
      logger: contextLogger
    };
  }

  /**
   * Create context from GitHub webhook payload
   */
  fromWebhook(payload: WebhookPayload): MappingContext | undefined {
    if (!payload.repository) {
      logger.error('Webhook payload missing repository information');
      return undefined;
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    return this.fromRepository(owner, repo);
  }

  /**
   * Check if a channel is managed
   */
  isChannelManaged(channelId: string): boolean {
    return this.multiStore.isChannelManaged(channelId);
  }

  /**
   * Check if a repository is managed
   */
  isRepositoryManaged(owner: string, repo: string): boolean {
    return this.multiStore.isRepoManaged(owner, repo);
  }

  /**
   * Check if a webhook should be processed
   */
  shouldProcessWebhook(payload: WebhookPayload): boolean {
    if (!payload.repository) {
      return false;
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    
    return this.isRepositoryManaged(owner, repo);
  }

  /**
   * Get all active contexts
   */
  getAllContexts(): MappingContext[] {
    const contexts: MappingContext[] = [];
    const stores = this.multiStore.getAllStores();

    for (const [mappingId, store] of stores) {
      const mapping = this.multiStore.getMappingById(mappingId);
      if (!mapping) continue;

      const repoCredentials: RepoCredentials = {
        owner: mapping.repository.owner,
        repo: mapping.repository.name
      };

      const contextLogger = new MappingContextualLogger(
        mapping.id,
        mapping.channel_id,
        `${mapping.repository.owner}/${mapping.repository.name}`
      );

      contexts.push({
        mapping,
        store,
        repoCredentials,
        logger: contextLogger
      });
    }

    return contexts;
  }
}