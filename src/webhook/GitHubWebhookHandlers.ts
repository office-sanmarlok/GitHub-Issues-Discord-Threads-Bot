import { Client } from "discord.js";
import { MappingContext, WebhookPayload } from "../types/contextTypes";
import { EnhancedDiscordActions } from "../discord/EnhancedDiscordActions";

export class GitHubWebhookHandlers {
  private discordActions: EnhancedDiscordActions;

  constructor(client: Client) {
    this.discordActions = new EnhancedDiscordActions(client);
  }

  /**
   * Handle issue opened event
   */
  async handleIssueOpened(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue opened #${issue.number}`);

    // Check if thread already exists
    const existingThread = context.store.threads.find(t => t.number === issue.number);
    if (existingThread) {
      context.logger.warn(`Thread already exists for issue #${issue.number}`);
      return;
    }

    // Map GitHub labels to Discord tags
    const labels = issue.labels || [];
    const appliedTags = labels
      .map((label: any) => {
        const tag = context.store.availableTags.find(t => t.name === label.name);
        return tag?.id;
      })
      .filter((id): id is string => id !== undefined);

    await this.discordActions.createThread(context, {
      body: issue.body || '',
      login: issue.user?.login || 'unknown',
      title: issue.title,
      appliedTags,
      node_id: issue.node_id,
      number: issue.number
    });
  }

  /**
   * Handle issue closed event
   */
  async handleIssueClosed(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue closed #${issue.number}`);
    await this.discordActions.archiveThread(context, issue.node_id);
  }

  /**
   * Handle issue reopened event
   */
  async handleIssueReopened(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue reopened #${issue.number}`);
    await this.discordActions.unarchiveThread(context, issue.node_id);
  }

  /**
   * Handle issue locked event
   */
  async handleIssueLocked(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue locked #${issue.number}`);
    await this.discordActions.lockThread(context, issue.node_id);
  }

  /**
   * Handle issue unlocked event
   */
  async handleIssueUnlocked(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue unlocked #${issue.number}`);
    await this.discordActions.unlockThread(context, issue.node_id);
  }

  /**
   * Handle issue deleted event
   */
  async handleIssueDeleted(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue deleted #${issue.number}`);
    await this.discordActions.deleteThread(context, issue.node_id);
  }

  /**
   * Handle issue edited event
   */
  async handleIssueEdited(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    const changes = payload.changes;
    if (!issue) return;

    context.logger.info(`GitHub webhook: Issue edited #${issue.number}`);

    // Handle title change
    if (changes?.title) {
      await this.discordActions.updateThreadTitle(context, issue.node_id, issue.title);
    }

    // Handle state changes
    if (changes?.state) {
      if (issue.state === 'closed') {
        await this.discordActions.archiveThread(context, issue.node_id);
      } else if (issue.state === 'open') {
        await this.discordActions.unarchiveThread(context, issue.node_id);
      }
    }
  }

  /**
   * Handle issue comment created event
   */
  async handleIssueCommentCreated(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    const comment = payload.comment;
    if (!issue || !comment) return;

    context.logger.info(`GitHub webhook: Comment created on issue #${issue.number}`);

    // Check if comment is from the bot itself (avoid loops)
    if (comment.body?.includes('`BOT`')) {
      context.logger.debug('Skipping bot-generated comment');
      return;
    }

    await this.discordActions.createComment(context, {
      git_id: comment.id,
      body: comment.body || '',
      login: comment.user?.login || 'unknown',
      avatar_url: comment.user?.avatar_url || '',
      node_id: issue.node_id
    });
  }

  /**
   * Handle issue comment edited event
   */
  async handleIssueCommentEdited(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    const comment = payload.comment;
    if (!issue || !comment) return;

    context.logger.info(`GitHub webhook: Comment edited on issue #${issue.number}`);
    
    // For now, we'll log this but not sync edits to Discord
    // This could be enhanced to edit Discord messages in the future
    context.logger.debug('Comment edit synchronization not implemented');
  }

  /**
   * Handle issue comment deleted event
   */
  async handleIssueCommentDeleted(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    const comment = payload.comment;
    if (!issue || !comment) return;

    context.logger.info(`GitHub webhook: Comment deleted on issue #${issue.number}`);

    // Find the thread and comment mapping
    const thread = context.store.threads.find(t => t.node_id === issue.node_id);
    if (!thread) {
      context.logger.warn(`Thread not found for issue #${issue.number}`);
      return;
    }

    const commentMapping = thread.comments.find(c => c.git_id === comment.id);
    if (!commentMapping) {
      context.logger.warn(`Comment mapping not found for GitHub comment ${comment.id}`);
      return;
    }

    // For now, we'll log this but not delete Discord messages
    // Discord message deletion is typically handled from Discord side
    context.logger.debug('Comment deletion from GitHub not synced to Discord');
  }

  /**
   * Handle issue labeled event
   */
  async handleIssueLabeled(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    const label = payload.label;
    if (!issue || !label) return;

    context.logger.info(`GitHub webhook: Label '${label.name}' added to issue #${issue.number}`);

    // Find the corresponding Discord tag
    const tag = context.store.availableTags.find(t => t.name === label.name);
    if (!tag) {
      context.logger.debug(`No Discord tag found for label '${label.name}'`);
      return;
    }

    // Update thread tags
    const thread = context.store.threads.find(t => t.number === issue.number);
    if (thread && !thread.appliedTags.includes(tag.id)) {
      thread.appliedTags.push(tag.id);
      // Note: Updating Discord thread tags would require additional Discord API calls
      context.logger.debug('Label sync to Discord tags not fully implemented');
    }
  }

  /**
   * Handle issue unlabeled event
   */
  async handleIssueUnlabeled(context: MappingContext, payload: WebhookPayload): Promise<void> {
    const issue = payload.issue;
    const label = payload.label;
    if (!issue || !label) return;

    context.logger.info(`GitHub webhook: Label '${label.name}' removed from issue #${issue.number}`);

    // Find the corresponding Discord tag
    const tag = context.store.availableTags.find(t => t.name === label.name);
    if (!tag) return;

    // Update thread tags
    const thread = context.store.threads.find(t => t.number === issue.number);
    if (thread) {
      const tagIndex = thread.appliedTags.indexOf(tag.id);
      if (tagIndex > -1) {
        thread.appliedTags.splice(tagIndex, 1);
        // Note: Updating Discord thread tags would require additional Discord API calls
        context.logger.debug('Label sync to Discord tags not fully implemented');
      }
    }
  }

  /**
   * Handle ping event (webhook test)
   */
  async handlePing(context: MappingContext, payload: WebhookPayload): Promise<void> {
    context.logger.info('GitHub webhook: Ping received');
    context.logger.debug(`Webhook ID: ${payload.hook_id}, Repository: ${payload.repository?.full_name}`);
  }
}