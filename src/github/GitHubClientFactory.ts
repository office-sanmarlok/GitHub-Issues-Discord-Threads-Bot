import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { MappingContext } from '../types/contextTypes';
import { config } from '../config';
import { logger } from '../logger';

export interface IssueData {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface CommentData {
  body: string;
}

export interface UpdateData {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
}

export class GitHubClientFactory {
  private clients: Map<string, Octokit> = new Map();
  private graphqlClients: Map<string, typeof graphql> = new Map();
  private accessToken: string;

  constructor(accessToken?: string) {
    // Use provided token or fall back to config
    this.accessToken = accessToken || config.GITHUB_ACCESS_TOKEN;
  }

  /**
   * Get or create Octokit client for a mapping
   */
  getClient(context: MappingContext): Octokit {
    const mappingId = context.mapping.id;
    
    let client = this.clients.get(mappingId);
    if (!client) {
      client = new Octokit({
        auth: this.accessToken,
        baseUrl: 'https://api.github.com'
      });
      this.clients.set(mappingId, client);
      
      context.logger.debug('Created GitHub client');
    }
    
    return client;
  }

  /**
   * Get or create GraphQL client for a mapping
   */
  getGraphQLClient(context: MappingContext): typeof graphql {
    const mappingId = context.mapping.id;
    
    let client = this.graphqlClients.get(mappingId);
    if (!client) {
      client = graphql.defaults({
        headers: {
          authorization: `token ${this.accessToken}`,
        },
      });
      this.graphqlClients.set(mappingId, client);
      
      context.logger.debug('Created GitHub GraphQL client');
    }
    
    return client;
  }

  /**
   * Create a GitHub issue
   */
  async createIssue(context: MappingContext, data: IssueData) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      const response = await client.rest.issues.create({
        owner,
        repo,
        title: data.title,
        body: data.body,
        labels: data.labels,
        assignees: data.assignees
      });

      context.logger.info(`Created issue #${response.data.number}: ${data.title}`);
      return response.data;
      
    } catch (error) {
      context.logger.error('Failed to create issue', error as Error);
      throw error;
    }
  }

  /**
   * Create a comment on an issue
   */
  async createComment(context: MappingContext, issueNumber: number, data: CommentData) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      const response = await client.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: data.body
      });

      context.logger.info(`Created comment on issue #${issueNumber}`);
      return response.data;
      
    } catch (error) {
      context.logger.error(`Failed to create comment on issue #${issueNumber}`, error as Error);
      throw error;
    }
  }

  /**
   * Update an issue
   */
  async updateIssue(context: MappingContext, issueNumber: number, data: UpdateData) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      const response = await client.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...data
      });

      context.logger.info(`Updated issue #${issueNumber}`);
      return response.data;
      
    } catch (error) {
      context.logger.error(`Failed to update issue #${issueNumber}`, error as Error);
      throw error;
    }
  }

  /**
   * Lock an issue
   */
  async lockIssue(context: MappingContext, issueNumber: number, lockReason?: string) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      await client.rest.issues.lock({
        owner,
        repo,
        issue_number: issueNumber,
        lock_reason: lockReason as 'off-topic' | 'too heated' | 'resolved' | 'spam' | undefined
      });

      context.logger.info(`Locked issue #${issueNumber}`);
      
    } catch (error) {
      context.logger.error(`Failed to lock issue #${issueNumber}`, error as Error);
      throw error;
    }
  }

  /**
   * Unlock an issue
   */
  async unlockIssue(context: MappingContext, issueNumber: number) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      await client.rest.issues.unlock({
        owner,
        repo,
        issue_number: issueNumber
      });

      context.logger.info(`Unlocked issue #${issueNumber}`);
      
    } catch (error) {
      context.logger.error(`Failed to unlock issue #${issueNumber}`, error as Error);
      throw error;
    }
  }

  /**
   * Delete an issue (using GraphQL)
   */
  async deleteIssue(context: MappingContext, nodeId: string) {
    const client = this.getGraphQLClient(context);

    try {
      await client(
        `mutation deleteIssue($issueId: ID!) {
          deleteIssue(input: {issueId: $issueId}) {
            clientMutationId
          }
        }`,
        { issueId: nodeId }
      );

      context.logger.info(`Deleted issue with node ID: ${nodeId}`);
      
    } catch (error) {
      context.logger.error(`Failed to delete issue with node ID: ${nodeId}`, error as Error);
      throw error;
    }
  }

  /**
   * Delete a comment
   */
  async deleteComment(context: MappingContext, commentId: number) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      await client.rest.issues.deleteComment({
        owner,
        repo,
        comment_id: commentId
      });

      context.logger.info(`Deleted comment ${commentId}`);
      
    } catch (error) {
      context.logger.error(`Failed to delete comment ${commentId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get all issues for a repository
   */
  async getIssues(context: MappingContext, state: 'open' | 'closed' | 'all' = 'all') {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      const response = await client.rest.issues.listForRepo({
        owner,
        repo,
        state,
        per_page: 100 // Adjust as needed
      });

      context.logger.info(`Fetched ${response.data.length} issues`);
      return response.data;
      
    } catch (error) {
      context.logger.error('Failed to fetch issues', error as Error);
      throw error;
    }
  }

  /**
   * Get comments for a repository
   */
  async getCommentsForRepo(context: MappingContext) {
    const client = this.getClient(context);
    const { owner, repo } = context.repoCredentials;

    try {
      const response = await client.rest.issues.listCommentsForRepo({
        owner,
        repo,
        per_page: 100 // Adjust as needed
      });

      context.logger.info(`Fetched ${response.data.length} comments`);
      return response.data;
      
    } catch (error) {
      context.logger.error('Failed to fetch comments', error as Error);
      throw error;
    }
  }

  /**
   * Clear cached clients
   */
  clearClients(): void {
    this.clients.clear();
    this.graphqlClients.clear();
    logger.debug('Cleared all GitHub clients');
  }

  /**
   * Get number of cached clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}