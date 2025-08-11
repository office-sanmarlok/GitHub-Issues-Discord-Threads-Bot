/**
 * Store types for multi-repository support
 */

import { GuildForumTag } from 'discord.js';
import { Thread, Comment } from '../interfaces';

/**
 * Metrics for tracking store operations
 */
export interface StoreMetrics {
  threadCount: number;
  issueCount: number;
  lastSync: Date;
  syncErrors: number;
  operations: {
    created: number;
    updated: number;
    deleted: number;
    commented: number;
  };
}

/**
 * Enhanced store interface with metrics
 */
export interface EnhancedStore {
  threads: Thread[];
  availableTags: GuildForumTag[];
  metrics: StoreMetrics;
  
  deleteThread(id: string): Thread[];
  addThread(thread: Thread): void;
  getThread(id: string): Thread | undefined;
  getThreadByIssueNumber(number: number): Thread | undefined;
  getThreadByNodeId(nodeId: string): Thread | undefined;
  updateThread(id: string, updates: Partial<Thread>): Thread | undefined;
  updateMetrics(operation: keyof StoreMetrics['operations']): void;
  resetMetrics(): void;
  findCommentByGitId(threadId: string, gitId: number): Comment | undefined;
  updateCommentMapping(threadId: string, gitId: number, newMessageId: string): void;
  removeCommentMapping(threadId: string, gitId: number): void;
}

/**
 * Health status for a mapping
 */
export interface HealthStatus {
  mappingId: string;
  channelId: string;
  repository: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastSync: Date;
  errorCount: number;
  metrics: MappingMetrics;
}

/**
 * Detailed metrics for a mapping
 */
export interface MappingMetrics {
  eventsProcessed: number;
  eventsSucceeded: number;
  eventsFailed: number;
  averageResponseTime: number;
  lastEventTime: Date | null;
  uptime: number;
}