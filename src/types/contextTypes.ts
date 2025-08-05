/**
 * Context types for multi-repository support
 */

import { Store } from '../store';
import { RepositoryMapping, RepoCredentials } from './configTypes';
import { Request } from 'express';

/**
 * Contextual logger that includes mapping information
 */
export interface ContextualLogger {
  info(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

/**
 * Mapping context that carries all necessary information for operations
 */
export interface MappingContext {
  mapping: RepositoryMapping;
  store: Store;
  repoCredentials: RepoCredentials;
  logger: ContextualLogger;
}

/**
 * Provider interface for creating mapping contexts
 */
export interface ContextProvider {
  fromChannel(channelId: string): MappingContext | undefined;
  fromRepository(owner: string, repo: string): MappingContext | undefined;
  fromWebhook(payload: WebhookPayload): MappingContext | undefined;
}

/**
 * GitHub webhook payload structure
 */
export interface WebhookPayload {
  action: string;
  repository: {
    owner: {
      login: string;
    };
    name: string;
    full_name: string;
  };
  issue?: GitHubIssue;
  comment?: GitHubComment;
  sender: GitHubUser;
}

/**
 * GitHub issue structure in webhook
 */
export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  locked: boolean;
  labels: GitHubLabel[];
  user: GitHubUser;
}

/**
 * GitHub comment structure in webhook
 */
export interface GitHubComment {
  id: number;
  node_id: string;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub user structure
 */
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  type: string;
}

/**
 * GitHub label structure
 */
export interface GitHubLabel {
  id: number;
  node_id: string;
  name: string;
  color: string;
  description: string | null;
}

/**
 * Action context for handlers
 */
export interface ActionContext {
  mapping: RepositoryMapping;
  store: Store;
  repoCredentials: RepoCredentials;
}