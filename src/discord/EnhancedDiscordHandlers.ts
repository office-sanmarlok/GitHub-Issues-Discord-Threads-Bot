import {
  AnyThreadChannel,
  Client,
  DMChannel,
  ForumChannel,
  Message,
  NonThreadGuildBasedChannel,
  PartialMessage,
  ThreadChannel,
} from "discord.js";
import { ContextProvider } from "../context/ContextProvider";
import { MultiStore } from "../store/MultiStore";
import { GitHubClientFactory } from "../github/GitHubClientFactory";
import { logger } from "../logger";
import { MappingContext } from "../types/contextTypes";
import {
  createIssue,
  createIssueComment,
  deleteComment,
  deleteIssue,
  closeIssue,
  openIssue,
  lockIssue,
  unlockIssue,
} from "./EnhancedGitHubActions";

export class EnhancedDiscordHandlers {
  constructor(
    private multiStore: MultiStore,
    private contextProvider: ContextProvider,
    private githubFactory: GitHubClientFactory
  ) {}

  async handleClientReady(client: Client): Promise<void> {
    logger.info(`Logged in as ${client.user?.tag}!`);

    // Initialize all configured channels
    const mappings = this.multiStore.getAllMappings();
    
    for (const mapping of mappings) {
      if (!mapping.enabled) continue;

      const context = this.contextProvider.fromMapping(mapping);
      if (!context) continue;

      try {
        // Fetch channel to get available tags
        const channel = await client.channels.fetch(mapping.channel_id);
        if (channel && channel.type === 15) { // ForumChannel
          const forumChannel = channel as ForumChannel;
          context.store.availableTags = forumChannel.availableTags;
        }

        // Load existing issues from GitHub
        const issues = await this.githubFactory.getIssues(context);
        
        // Format and store issues
        for (const issue of issues) {
          const discordInfo = this.extractDiscordInfoFromBody(issue.body || '');
          if (discordInfo.threadId) {
            context.store.threads.push({
              id: discordInfo.threadId,
              title: issue.title,
              number: issue.number,
              body: issue.body || '',
              node_id: issue.node_id,
              locked: issue.locked || false,
              archived: issue.state === 'closed',
              appliedTags: [],
              comments: []
            });
          }
        }

        // Load comments
        const comments = await this.githubFactory.getCommentsForRepo(context);
        for (const comment of comments) {
          const discordInfo = this.extractDiscordInfoFromBody(comment.body || '');
          if (discordInfo.threadId && discordInfo.messageId) {
            const thread = context.store.threads.find(t => t.id === discordInfo.threadId);
            if (thread) {
              thread.comments.push({
                id: discordInfo.messageId,
                git_id: comment.id
              });
            }
          }
        }

        context.logger.info(`Loaded ${context.store.threads.length} issues for ${mapping.repository.owner}/${mapping.repository.name}`);
      } catch (error) {
        context.logger.error(`Failed to initialize mapping ${mapping.id}`, error as Error);
      }
    }
  }

  async handleThreadCreate(thread: AnyThreadChannel): Promise<void> {
    const context = this.contextProvider.fromChannelId(thread.parentId || '');
    if (!context) return;

    const { id, name, appliedTags } = thread;

    context.store.threads.push({
      id,
      appliedTags,
      title: name,
      archived: false,
      locked: false,
      comments: [],
    });

    context.logger.info(`Thread created: ${name}`);
  }

  async handleChannelUpdate(channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
    const context = this.contextProvider.fromChannelId(channel.id);
    if (!context) return;

    if (channel.type === 15) { // ForumChannel
      const forumChannel = channel as ForumChannel;
      context.store.availableTags = forumChannel.availableTags;
      context.logger.info('Forum tags updated');
    }
  }

  async handleThreadUpdate(thread: AnyThreadChannel): Promise<void> {
    const context = this.contextProvider.fromChannelId(thread.parentId || '');
    if (!context) return;

    const { id, archived, locked } = thread;
    const storedThread = context.store.threads.find(item => item.id === id);
    if (!storedThread) return;

    // Handle locking
    if (storedThread.locked !== locked && !storedThread.lockLocking) {
      if (storedThread.archived) {
        storedThread.lockArchiving = true;
      }
      storedThread.locked = locked;
      
      if (locked) {
        await lockIssue(context, this.githubFactory, storedThread);
      } else {
        await unlockIssue(context, this.githubFactory, storedThread);
      }
    }

    // Handle archiving
    if (storedThread.archived !== archived) {
      setTimeout(async () => {
        if (storedThread.lockArchiving) {
          if (archived) {
            storedThread.lockArchiving = false;
          }
          storedThread.lockLocking = false;
          return;
        }
        
        storedThread.archived = archived;
        
        if (archived) {
          await closeIssue(context, this.githubFactory, storedThread);
        } else {
          await openIssue(context, this.githubFactory, storedThread);
        }
      }, 500);
    }
  }

  async handleMessageCreate(message: Message): Promise<void> {
    const { channelId, author } = message;

    if (author.bot) return;

    // Try to get context from thread's parent
    const channel = message.channel as ThreadChannel;
    const parentId = channel.parentId;
    
    const context = this.contextProvider.fromChannelId(parentId || '');
    if (!context) return;

    const thread = context.store.threads.find(t => t.id === channelId);
    if (!thread) return;

    if (!thread.body) {
      await createIssue(context, this.githubFactory, thread, message);
    } else {
      await createIssueComment(context, this.githubFactory, thread, message);
    }
  }

  async handleMessageDelete(message: Message | PartialMessage): Promise<void> {
    const { channelId, id } = message;
    
    // Try to get context from thread's parent
    const channel = message.channel as ThreadChannel;
    const parentId = channel.parentId;
    
    const context = this.contextProvider.fromChannelId(parentId || '');
    if (!context) return;

    const thread = context.store.threads.find(t => t.id === channelId);
    if (!thread) return;

    const commentIndex = thread.comments.findIndex(c => c.id === id);
    if (commentIndex === -1) return;

    const comment = thread.comments.splice(commentIndex, 1)[0];
    await deleteComment(context, this.githubFactory, thread, comment.git_id);
  }

  async handleThreadDelete(thread: AnyThreadChannel): Promise<void> {
    const context = this.contextProvider.fromChannelId(thread.parentId || '');
    if (!context) return;

    const storedThread = context.store.threads.find(t => t.id === thread.id);
    if (!storedThread) return;

    await deleteIssue(context, this.githubFactory, storedThread);
    
    // Remove from store
    const index = context.store.threads.indexOf(storedThread);
    if (index > -1) {
      context.store.threads.splice(index, 1);
    }
  }

  private extractDiscordInfoFromBody(body: string): { threadId?: string; messageId?: string } {
    const regex = /https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/;
    const match = body.match(regex);
    
    if (!match) return {};
    
    return {
      threadId: match[1],
      messageId: match[2]
    };
  }
}