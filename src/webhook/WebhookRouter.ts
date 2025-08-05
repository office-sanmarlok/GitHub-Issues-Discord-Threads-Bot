import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { MultiStore } from '../store/MultiStore';
import { ContextProvider } from '../context/ContextProvider';
import { WebhookPayload, MappingContext } from '../types/contextTypes';
import { logger } from '../logger';

export type WebhookHandler = (context: MappingContext, payload: WebhookPayload) => Promise<void>;

export class WebhookRouter {
  private handlers: Map<string, WebhookHandler> = new Map();

  constructor(
    private multiStore: MultiStore,
    private contextProvider: ContextProvider
  ) {}

  /**
   * Register a handler for a specific GitHub action
   */
  registerHandler(action: string, handler: WebhookHandler): void {
    this.handlers.set(action, handler);
    logger.debug(`Registered webhook handler for action: ${action}`);
  }

  /**
   * Handle incoming webhook request
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as WebhookPayload;
      
      // Log webhook receipt
      logger.debug(`Received webhook: ${payload.action} for ${payload.repository?.full_name}`);

      // Check if repository exists in payload
      if (!payload.repository) {
        logger.warn('Webhook payload missing repository information');
        res.status(400).json({ error: 'Missing repository information' });
        return;
      }

      // Extract repository information
      const { owner, repo } = this.extractRepository(payload);
      
      // Get mapping context
      const context = this.contextProvider.fromRepository(owner, repo);
      
      if (!context) {
        logger.warn(`No mapping found for repository ${owner}/${repo}`);
        res.status(404).json({ error: 'Repository not configured' });
        return;
      }

      // Validate webhook signature if configured
      if (context.mapping.webhook_secret) {
        const signature = req.headers['x-hub-signature-256'] as string;
        
        if (!signature) {
          logger.error(`Missing signature for webhook from ${owner}/${repo}`);
          res.status(401).json({ error: 'Missing signature' });
          return;
        }

        const isValid = this.validateSignature(
          JSON.stringify(req.body),
          signature,
          context.mapping.webhook_secret
        );

        if (!isValid) {
          logger.error(`Invalid signature for webhook from ${owner}/${repo}`);
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Route to appropriate handler
      await this.routeToHandler(payload.action, context, payload);

      // Send success response
      res.status(200).json({ msg: 'ok' });

    } catch (error) {
      logger.error('Webhook processing error', error as Error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Validate webhook signature using HMAC
   */
  validateSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      const computedSignature = `sha256=${hmac.update(payload).digest('hex')}`;
      
      // Use timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
      );
    } catch (error) {
      logger.error('Signature validation error', error as Error);
      return false;
    }
  }

  /**
   * Extract repository owner and name from webhook payload
   */
  extractRepository(payload: WebhookPayload): { owner: string; repo: string } {
    return {
      owner: payload.repository.owner.login,
      repo: payload.repository.name
    };
  }

  /**
   * Route webhook to appropriate handler based on action
   */
  async routeToHandler(
    action: string, 
    context: MappingContext, 
    payload: WebhookPayload
  ): Promise<void> {
    const handler = this.handlers.get(action);
    
    if (!handler) {
      logger.debug(`No handler registered for action: ${action}`);
      return;
    }

    try {
      context.logger.info(`Processing webhook action: ${action}`);
      await handler(context, payload);
      context.logger.info(`Successfully processed webhook action: ${action}`);
    } catch (error) {
      context.logger.error(`Error processing webhook action: ${action}`, error as Error);
      throw error;
    }
  }

  /**
   * Get all registered action handlers
   */
  getRegisteredActions(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all registered handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Check if an action has a handler
   */
  hasHandler(action: string): boolean {
    return this.handlers.has(action);
  }
}