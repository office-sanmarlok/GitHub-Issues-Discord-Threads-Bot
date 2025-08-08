import { 
  Guild, 
  ForumChannel, 
  ChannelType,
  Client
} from 'discord.js';
import { 
  RepositoryMapping, 
  MappingResult, 
  SyncResult,
  CommandError,
  CommandErrorType
} from '../types/commandTypes';
import { MultiStore } from '../store/MultiStore';
import { ConfigManager } from '../config/ConfigManager';
import { GitHubClientFactory } from '../github/GitHubClientFactory';
import { logger } from '../logger';
import { formatIssue } from '../utils/githubUtils';

export class DynamicMappingManager {
  constructor(
    private multiStore: MultiStore,
    private configManager: ConfigManager,
    private githubFactory: GitHubClientFactory,
    private discordClient: Client
  ) {}
  
  /**
   * Add a new repository mapping
   */
  async addMapping(
    owner: string,
    repo: string,
    categoryId: string,
    userId: string
  ): Promise<MappingResult> {
    try {
      // Validate repository exists
      const isValid = await this.validateRepository(owner, repo);
      if (!isValid) {
        throw new CommandError(
          CommandErrorType.REPO_NOT_FOUND,
          `Repository ${owner}/${repo} not found or inaccessible`
        );
      }
      
      // Check if already watching
      const existing = this.configManager.getMappingByRepo(owner, repo);
      if (existing) {
        throw new CommandError(
          CommandErrorType.ALREADY_WATCHING,
          `Already watching ${owner}/${repo}`
        );
      }
      
      // Get guild from any available source
      const guild = this.discordClient.guilds.cache.first();
      if (!guild) {
        throw new Error('No guild available');
      }
      
      // Create forum channel
      const forumChannel = await this.createForumChannel(guild, categoryId, owner, repo);
      
      // Create mapping
      const mapping: RepositoryMapping = {
        id: `${owner}-${repo}-${Date.now()}`,
        channel_id: forumChannel.id,
        repository: { owner, name: repo },
        enabled: true,
        created_at: new Date().toISOString(),
        created_by: userId,
        auto_synced: false
      };
      
      // Add to config
      await this.configManager.addMapping(mapping);
      
      // Add to MultiStore
      await this.multiStore.addMapping(mapping);
      
      // Perform initial sync if enabled
      let syncResult: SyncResult | undefined;
      const config = this.configManager.getConfig();
      if (config?.command_settings?.enable_auto_sync !== false) {
        syncResult = await this.syncExistingIssues(mapping, forumChannel);
        
        // Mark as synced
        mapping.auto_synced = true;
        await this.configManager.addMapping(mapping);
      }
      
      logger.info('Successfully added mapping', {
        id: mapping.id,
        repo: `${owner}/${repo}`,
        channel: forumChannel.id,
        synced: syncResult?.synced || 0
      });
      
      return {
        mapping,
        channelId: forumChannel.id,
        syncResult
      };
    } catch (error) {
      logger.error('Failed to add mapping', error as Error);
      throw error;
    }
  }
  
  /**
   * Remove a repository mapping
   */
  async removeMapping(
    owner: string,
    repo: string,
    deleteChannel: boolean = false
  ): Promise<void> {
    try {
      // Find mapping
      const mapping = this.configManager.getMappingByRepo(owner, repo);
      if (!mapping) {
        throw new CommandError(
          CommandErrorType.NOT_WATCHING,
          `Not watching ${owner}/${repo}`
        );
      }
      
      // Delete channel if requested
      if (deleteChannel) {
        try {
          const channel = await this.discordClient.channels.fetch(mapping.channel_id);
          if (channel && channel.type === ChannelType.GuildForum) {
            await channel.delete();
            logger.info(`Deleted forum channel: ${mapping.channel_id}`);
          }
        } catch (error) {
          logger.error('Failed to delete channel', error as Error);
          // Continue with mapping removal even if channel deletion fails
        }
      }
      
      // Remove from MultiStore
      await this.multiStore.removeMapping(mapping.id);
      
      // Remove from config
      await this.configManager.removeMapping(mapping.id);
      
      logger.info('Successfully removed mapping', {
        id: mapping.id,
        repo: `${owner}/${repo}`,
        channelDeleted: deleteChannel
      });
    } catch (error) {
      logger.error('Failed to remove mapping', error as Error);
      throw error;
    }
  }
  
  /**
   * Get all repository mappings
   */
  getAllMappings(): RepositoryMapping[] {
    return this.configManager.getMappings();
  }
  
  /**
   * Validate that a GitHub repository exists and is accessible
   */
  async validateRepository(owner: string, repo: string): Promise<boolean> {
    try {
      // Create a temporary context for validation
      const tempMapping: any = {
        id: 'temp-validation',
        repository: { owner, name: repo }
      };
      const context = {
        mapping: tempMapping,
        store: {} as any,  // Not needed for validation
        repoCredentials: {
          owner,
          name: repo
        },
        logger: logger
      };
      
      const github = this.githubFactory.getClient(context);
      const { data } = await github.repos.get({
        owner,
        repo
      });
      
      return data !== null;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      // For other errors, log but return false
      logger.error('Error validating repository', error);
      return false;
    }
  }
  
  /**
   * Create a forum channel for the repository
   */
  async createForumChannel(
    guild: Guild,
    categoryId: string,
    owner: string,
    repo: string
  ): Promise<ForumChannel> {
    try {
      // Create channel name (Discord has 100 char limit)
      const channelName = `${owner}-${repo}`.substring(0, 100);
      
      // Create forum channel
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildForum,
        parent: categoryId,
        topic: `GitHub Issues for ${owner}/${repo}`,
        defaultAutoArchiveDuration: 10080, // 7 days
        reason: `Auto-created for GitHub repository ${owner}/${repo}`
      });
      
      logger.info('Created forum channel', {
        id: channel.id,
        name: channel.name,
        repo: `${owner}/${repo}`
      });
      
      return channel;
    } catch (error) {
      logger.error('Failed to create forum channel', error as Error);
      throw new CommandError(
        CommandErrorType.CHANNEL_CREATE_FAILED,
        'Failed to create forum channel'
      );
    }
  }
  
  /**
   * Sync existing GitHub issues to Discord
   */
  async syncExistingIssues(
    mapping: RepositoryMapping,
    forumChannel: ForumChannel
  ): Promise<SyncResult> {
    const result: SyncResult = {
      total: 0,
      synced: 0,
      errors: 0,
      skipped: 0
    };
    
    try {
      const store = this.multiStore.getStore(mapping.id);
      const context = {
        mapping: mapping,
        store: store || {} as any,
        repoCredentials: {
          owner: mapping.repository.owner,
          name: mapping.repository.name
        },
        logger: logger
      };
      const github = this.githubFactory.getClient(context);
      
      // Get all open issues
      const { data: issues } = await github.issues.listForRepo({
        owner: mapping.repository.owner,
        repo: mapping.repository.name,
        state: 'open',
        per_page: 100 // GitHub API max
      });
      
      result.total = issues.length;
      logger.info(`Found ${issues.length} open issues to sync`);
      
      // Get store for this mapping
      const store = this.multiStore.getStore(mapping.id);
      if (!store) {
        throw new Error(`Store not found for mapping: ${mapping.id}`);
      }
      
      // Sync each issue
      for (const issue of issues) {
        try {
          // Skip pull requests
          if (issue.pull_request) {
            result.skipped++;
            continue;
          }
          
          // Check if already exists
          const existingThread = store.getThreadByIssueNumber(issue.number);
          if (existingThread) {
            result.skipped++;
            continue;
          }
          
          // Format issue for Discord
          const formatted = formatIssue(issue);
          
          // Create thread in forum
          const thread = await forumChannel.threads.create({
            name: formatted.title.substring(0, 100),
            message: {
              content: formatted.body
            },
            reason: `Syncing issue #${issue.number}`
          });
          
          // Add to store
          store.addThread({
            id: thread.id,
            title: formatted.title,
            appliedTags: [],
            number: issue.number,
            body: issue.body || '',
            node_id: issue.node_id,
            comments: [],
            archived: thread.archived || false,
            locked: thread.locked || false
          });
          
          result.synced++;
          
          // Log progress every 10 issues
          if (result.synced % 10 === 0) {
            logger.info(`Sync progress: ${result.synced}/${result.total}`);
          }
        } catch (error) {
          logger.error(`Failed to sync issue #${issue.number}`, error as Error);
          result.errors++;
        }
      }
      
      logger.info('Initial sync completed', result);
      return result;
    } catch (error) {
      logger.error('Failed to sync existing issues', error as Error);
      result.errors++;
      return result;
    }
  }
}