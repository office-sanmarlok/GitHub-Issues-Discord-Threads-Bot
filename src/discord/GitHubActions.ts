import { Message, Attachment, Collection } from "discord.js";
import { MappingContext } from "../types/contextTypes";
import { GitHubClientFactory } from "../github/GitHubClientFactory";
import { Thread } from "../interfaces";

export async function createIssue(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread,
  message: Message
): Promise<void> {
  const { title, appliedTags, number } = thread;

  if (number) {
    context.logger.error("Thread already has an issue number");
    return;
  }

  try {
    const labels = appliedTags?.map(
      (id) => context.store.availableTags.find((item) => item.id === id)?.name || ""
    ).filter(label => label !== "");

    const body = formatIssueBody(message);
    
    const issue = await githubFactory.createIssue(context, {
      title,
      body,
      labels
    });

    // Update thread with GitHub data
    thread.node_id = issue.node_id;
    thread.body = issue.body || "";
    thread.number = issue.number;

    context.logger.info(`Created issue #${issue.number}: ${title}`);
  } catch (error) {
    context.logger.error(`Failed to create issue: ${(error as Error).message}`);
  }
}

export async function createIssueComment(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread,
  message: Message
): Promise<void> {
  const { number } = thread;

  if (!number) {
    context.logger.error("Thread does not have an issue number");
    return;
  }

  try {
    const body = formatIssueBody(message);
    
    const comment = await githubFactory.createComment(context, number, { body });

    // Store comment mapping
    thread.comments.push({
      id: message.id,
      git_id: comment.id
    });

    context.logger.info(`Created comment on issue #${number}`);
  } catch (error) {
    context.logger.error(`Failed to create comment: ${(error as Error).message}`);
  }
}

export async function closeIssue(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread
): Promise<void> {
  const { number } = thread;

  if (!number) {
    context.logger.error("Thread does not have an issue number");
    return;
  }

  try {
    await githubFactory.updateIssue(context, number, { state: 'closed' });
    context.logger.info(`Closed issue #${number}`);
  } catch (error) {
    context.logger.error(`Failed to close issue: ${(error as Error).message}`);
  }
}

export async function openIssue(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread
): Promise<void> {
  const { number } = thread;

  if (!number) {
    context.logger.error("Thread does not have an issue number");
    return;
  }

  try {
    await githubFactory.updateIssue(context, number, { state: 'open' });
    context.logger.info(`Reopened issue #${number}`);
  } catch (error) {
    context.logger.error(`Failed to reopen issue: ${(error as Error).message}`);
  }
}

export async function lockIssue(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread
): Promise<void> {
  const { number } = thread;

  if (!number) {
    context.logger.error("Thread does not have an issue number");
    return;
  }

  try {
    await githubFactory.lockIssue(context, number);
    context.logger.info(`Locked issue #${number}`);
  } catch (error) {
    context.logger.error(`Failed to lock issue: ${(error as Error).message}`);
  }
}

export async function unlockIssue(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread
): Promise<void> {
  const { number } = thread;

  if (!number) {
    context.logger.error("Thread does not have an issue number");
    return;
  }

  try {
    await githubFactory.unlockIssue(context, number);
    context.logger.info(`Unlocked issue #${number}`);
  } catch (error) {
    context.logger.error(`Failed to unlock issue: ${(error as Error).message}`);
  }
}

export async function deleteIssue(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread
): Promise<void> {
  const { node_id } = thread;

  if (!node_id) {
    context.logger.error("Thread does not have a node ID");
    return;
  }

  try {
    await githubFactory.deleteIssue(context, node_id);
    context.logger.info(`Deleted issue with node ID: ${node_id}`);
  } catch (error) {
    context.logger.error(`Failed to delete issue: ${(error as Error).message}`);
  }
}

export async function deleteComment(
  context: MappingContext,
  githubFactory: GitHubClientFactory,
  thread: Thread,
  commentId: number
): Promise<void> {
  try {
    await githubFactory.deleteComment(context, commentId);
    context.logger.info(`Deleted comment ${commentId}`);
  } catch (error) {
    context.logger.error(`Failed to delete comment: ${(error as Error).message}`);
  }
}

function formatIssueBody(message: Message): string {
  const { guildId, channelId, id, content, author, attachments } = message;
  const { globalName, username, avatar } = author;
  const displayName = globalName || username;

  const avatarUrl = avatar 
    ? `https://cdn.discordapp.com/avatars/${author.id}/${avatar}.webp?size=40`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(author.id) % 5}.png`;

  let body = `<kbd>[![${displayName}](${avatarUrl})](https://discord.com/channels/${guildId}/${channelId}/${id})</kbd> [${displayName}](https://discord.com/channels/${guildId}/${channelId}/${id})  \`BOT\`\n\n`;
  body += `${content}\n`;
  body += formatAttachments(attachments);

  return body;
}

function formatAttachments(attachments: Collection<string, Attachment>): string {
  let markdown = "";
  
  attachments.forEach(({ url, name, contentType }) => {
    if (contentType?.startsWith('image/')) {
      markdown += `![${name}](${url} "${name}")\n`;
    } else {
      markdown += `[${name}](${url})\n`;
    }
  });

  return markdown;
}