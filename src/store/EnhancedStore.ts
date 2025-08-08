import { GuildForumTag } from 'discord.js';
import { Thread } from '../interfaces';
import { StoreMetrics, EnhancedStore as IEnhancedStore } from '../types/storeTypes';

export class EnhancedStore implements IEnhancedStore {
  threads: Thread[] = [];
  availableTags: GuildForumTag[] = [];
  metrics: StoreMetrics;

  constructor() {
    this.metrics = this.createInitialMetrics();
  }

  /**
   * Create initial metrics object
   */
  private createInitialMetrics(): StoreMetrics {
    return {
      threadCount: 0,
      issueCount: 0,
      lastSync: new Date(),
      syncErrors: 0,
      operations: {
        created: 0,
        updated: 0,
        deleted: 0,
        commented: 0
      }
    };
  }

  /**
   * Delete a thread by ID
   */
  deleteThread(id: string): Thread[] {
    const index = this.threads.findIndex((obj) => obj.id === id);
    if (index !== -1) {
      this.threads.splice(index, 1);
      this.metrics.threadCount = this.threads.length;
      this.updateMetrics('deleted');
    }
    return this.threads;
  }

  /**
   * Add a new thread or update existing one
   */
  addThread(thread: Thread): void {
    // Check if thread already exists
    const existingIndex = this.threads.findIndex(t => t.id === thread.id);
    
    if (existingIndex === -1) {
      // New thread
      this.threads.push(thread);
      this.updateMetrics('created');
    } else {
      // Update existing thread - merge important fields
      const existing = this.threads[existingIndex];
      
      // Preserve GitHub-specific fields if they exist
      this.threads[existingIndex] = {
        ...thread,
        // Keep GitHub data if it exists and new data doesn't have it
        number: thread.number || existing.number,
        node_id: thread.node_id || existing.node_id,
        body: thread.body || existing.body,
        // Merge comments array
        comments: [...existing.comments, ...thread.comments.filter(
          newComment => !existing.comments.some(c => c.id === newComment.id)
        )]
      };
      this.updateMetrics('updated');
    }
    
    this.metrics.threadCount = this.threads.length;
    this.metrics.issueCount = this.threads.filter(t => t.number !== undefined).length;
  }

  /**
   * Get a thread by ID
   */
  getThread(id: string): Thread | undefined {
    return this.threads.find(t => t.id === id);
  }

  /**
   * Get a thread by issue number
   */
  getThreadByIssueNumber(number: number): Thread | undefined {
    return this.threads.find(t => t.number === number);
  }

  /**
   * Get a thread by node ID
   */
  getThreadByNodeId(nodeId: string): Thread | undefined {
    return this.threads.find(t => t.node_id === nodeId);
  }

  /**
   * Update thread
   */
  updateThread(id: string, updates: Partial<Thread>): Thread | undefined {
    const thread = this.getThread(id);
    if (thread) {
      Object.assign(thread, updates);
      this.updateMetrics('updated');
      
      // Update issue count if number was added/removed
      this.metrics.issueCount = this.threads.filter(t => t.number !== undefined).length;
    }
    return thread;
  }

  /**
   * Update metrics for an operation
   */
  updateMetrics(operation: keyof StoreMetrics['operations']): void {
    this.metrics.operations[operation]++;
    this.metrics.lastSync = new Date();
  }

  /**
   * Increment sync error count
   */
  incrementSyncErrors(): void {
    this.metrics.syncErrors++;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.createInitialMetrics();
    this.metrics.threadCount = this.threads.length;
    this.metrics.issueCount = this.threads.filter(t => t.number !== undefined).length;
  }

  /**
   * Get current metrics
   */
  getMetrics(): StoreMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.threads = [];
    this.availableTags = [];
    this.resetMetrics();
  }
}