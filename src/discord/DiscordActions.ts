import { Client, ForumChannel, MessagePayload, ThreadChannel } from "discord.js";
import { MappingContext } from "../types/contextTypes";
import { Thread } from "../interfaces";

export class DiscordActions {
  constructor(private client: Client) {}

  async createThread(
    context: MappingContext,
    data: {
      body: string;
      login: string;
      title: string;
      appliedTags: string[];
      node_id: string;
      number: number;
    }
  ): Promise<void> {
    try {
      const forum = await this.client.channels.fetch(context.mapping.channel_id) as ForumChannel;
      
      if (!forum || forum.type !== 15) {
        context.logger.error(`Channel ${context.mapping.channel_id} is not a forum channel`);
        return;
      }

      const thread = await forum.threads.create({
        message: {
          content: `${data.body}\n\n_Created by: ${data.login}_`
        },
        name: data.title,
        appliedTags: data.appliedTags
      });

      // Store thread in context store
      const threadData: Thread = {
        id: thread.id,
        title: data.title,
        body: data.body,
        node_id: data.node_id,
        number: data.number,
        appliedTags: data.appliedTags,
        locked: false,
        archived: false,
        comments: []
      };

      context.store.threads.push(threadData);
      context.logger.info(`Created Discord thread: ${data.title}`);
    } catch (error) {
      context.logger.error(`Failed to create Discord thread: ${(error as Error).message}`);
    }
  }

  async createComment(
    context: MappingContext,
    data: {
      git_id: number;
      body: string;
      login: string;
      avatar_url: string;
      node_id: string;
    }
  ): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === data.node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${data.node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      // Create webhook for user impersonation
      const parentChannel = channel.parent;
      if (!parentChannel) {
        context.logger.error(`Parent channel not found for thread ${thread.id}`);
        return;
      }

      const webhook = await parentChannel.createWebhook({
        name: data.login,
        avatar: data.avatar_url
      });

      const messagePayload = MessagePayload.create(webhook, {
        content: data.body,
        threadId: thread.id
      });

      const message = await webhook.send(messagePayload.resolveBody());
      
      // Store comment mapping
      thread.comments.push({
        id: message.id,
        git_id: data.git_id
      });

      // Clean up webhook
      await webhook.delete("Cleanup after comment");

      context.logger.info(`Created Discord comment in thread ${thread.id}`);
    } catch (error) {
      context.logger.error(`Failed to create Discord comment: ${(error as Error).message}`);
    }
  }

  async archiveThread(context: MappingContext, node_id: string): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      if (channel.archived) {
        context.logger.debug(`Thread ${thread.id} is already archived`);
        return;
      }

      await channel.setArchived(true);
      thread.archived = true;

      context.logger.info(`Archived Discord thread ${thread.id}`);
    } catch (error) {
      context.logger.error(`Failed to archive thread: ${(error as Error).message}`);
    }
  }

  async unarchiveThread(context: MappingContext, node_id: string): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      if (!channel.archived) {
        context.logger.debug(`Thread ${thread.id} is not archived`);
        return;
      }

      await channel.setArchived(false);
      thread.archived = false;

      context.logger.info(`Unarchived Discord thread ${thread.id}`);
    } catch (error) {
      context.logger.error(`Failed to unarchive thread: ${(error as Error).message}`);
    }
  }

  async lockThread(context: MappingContext, node_id: string): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      if (channel.locked) {
        context.logger.debug(`Thread ${thread.id} is already locked`);
        return;
      }

      // Handle archiving state for locking
      if (channel.archived) {
        thread.lockArchiving = true;
        thread.lockLocking = true;
        await channel.setArchived(false);
        await channel.setLocked(true);
        await channel.setArchived(true);
      } else {
        await channel.setLocked(true);
      }

      thread.locked = true;
      context.logger.info(`Locked Discord thread ${thread.id}`);
    } catch (error) {
      context.logger.error(`Failed to lock thread: ${(error as Error).message}`);
    }
  }

  async unlockThread(context: MappingContext, node_id: string): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      if (!channel.locked) {
        context.logger.debug(`Thread ${thread.id} is not locked`);
        return;
      }

      // Handle archiving state for unlocking
      if (channel.archived) {
        thread.lockArchiving = true;
        thread.lockLocking = true;
        await channel.setArchived(false);
        await channel.setLocked(false);
        await channel.setArchived(true);
      } else {
        await channel.setLocked(false);
      }

      thread.locked = false;
      context.logger.info(`Unlocked Discord thread ${thread.id}`);
    } catch (error) {
      context.logger.error(`Failed to unlock thread: ${(error as Error).message}`);
    }
  }

  async deleteThread(context: MappingContext, node_id: string): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      await channel.delete();

      // Remove from store
      const index = context.store.threads.indexOf(thread);
      if (index > -1) {
        context.store.threads.splice(index, 1);
      }

      context.logger.info(`Deleted Discord thread ${thread.id}`);
    } catch (error) {
      context.logger.error(`Failed to delete thread: ${(error as Error).message}`);
    }
  }

  async updateThreadTitle(
    context: MappingContext,
    node_id: string,
    title: string
  ): Promise<void> {
    try {
      const thread = context.store.threads.find(t => t.node_id === node_id);
      if (!thread) {
        context.logger.warn(`Thread not found for node_id: ${node_id}`);
        return;
      }

      const channel = await this.client.channels.fetch(thread.id) as ThreadChannel;
      if (!channel || !channel.isThread()) {
        context.logger.error(`Channel ${thread.id} is not a thread`);
        return;
      }

      await channel.setName(title);
      thread.title = title;

      context.logger.info(`Updated Discord thread title to: ${title}`);
    } catch (error) {
      context.logger.error(`Failed to update thread title: ${(error as Error).message}`);
    }
  }
}