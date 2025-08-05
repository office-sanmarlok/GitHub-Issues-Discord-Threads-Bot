import { WebhookRouter } from '../WebhookRouter';
import { MultiStore } from '../../store/MultiStore';
import { ContextProvider } from '../../context/ContextProvider';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { WebhookPayload, MappingContext } from '../../types/contextTypes';
import { RepositoryMapping } from '../../types/configTypes';

jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('WebhookRouter', () => {
  let webhookRouter: WebhookRouter;
  let multiStore: MultiStore;
  let contextProvider: ContextProvider;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const testMapping: RepositoryMapping = {
    id: 'mapping1',
    channel_id: 'channel123',
    repository: {
      owner: 'testowner',
      name: 'testrepo'
    },
    enabled: true,
    webhook_secret: 'test_secret'
  };

  const testPayload: WebhookPayload = {
    action: 'opened',
    repository: {
      owner: { login: 'testowner' },
      name: 'testrepo',
      full_name: 'testowner/testrepo'
    },
    sender: {
      login: 'testuser',
      id: 123,
      avatar_url: 'https://example.com/avatar.png',
      type: 'User'
    }
  };

  beforeEach(async () => {
    multiStore = new MultiStore();
    await multiStore.initialize([testMapping]);
    contextProvider = new ContextProvider(multiStore);
    webhookRouter = new WebhookRouter(multiStore, contextProvider);

    mockReq = {
      body: testPayload,
      headers: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('handleWebhook', () => {
    it('should process valid webhook for configured repository', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      webhookRouter.registerHandler('opened', handler);

      // Remove webhook secret for this test
      const mappingWithoutSecret = { ...testMapping, webhook_secret: undefined };
      await multiStore.initialize([mappingWithoutSecret]);

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          mapping: expect.objectContaining({ id: 'mapping1' }),
          store: expect.anything(),
          repoCredentials: { owner: 'testowner', repo: 'testrepo' }
        }),
        testPayload
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ msg: 'ok' });
    });

    it('should return 404 for unconfigured repository', async () => {
      const unknownPayload = {
        ...testPayload,
        repository: {
          owner: { login: 'unknown' },
          name: 'unknown',
          full_name: 'unknown/unknown'
        }
      };
      mockReq.body = unknownPayload;

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Repository not configured' });
    });

    it('should return 400 for missing repository information', async () => {
      mockReq.body = { action: 'ping' };

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing repository information' });
    });

    it('should validate webhook signature when configured', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      webhookRouter.registerHandler('opened', handler);

      // Generate valid signature
      const hmac = crypto.createHmac('sha256', 'test_secret');
      const signature = `sha256=${hmac.update(JSON.stringify(testPayload)).digest('hex')}`;
      
      mockReq.headers = { 'x-hub-signature-256': signature };

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(handler).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject webhook with invalid signature', async () => {
      mockReq.headers = { 'x-hub-signature-256': 'sha256=invalid_signature' };

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should reject webhook with missing signature when secret is configured', async () => {
      mockReq.headers = {}; // No signature header

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing signature' });
    });

    it('should handle handler errors gracefully', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      webhookRouter.registerHandler('opened', handler);

      // Remove webhook secret for simplicity
      const mappingWithoutSecret = { ...testMapping, webhook_secret: undefined };
      await multiStore.initialize([mappingWithoutSecret]);

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle webhook with no registered handler', async () => {
      // No handler registered for 'opened' action
      
      // Remove webhook secret for simplicity
      const mappingWithoutSecret = { ...testMapping, webhook_secret: undefined };
      await multiStore.initialize([mappingWithoutSecret]);

      await webhookRouter.handleWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ msg: 'ok' });
    });
  });

  describe('validateSignature', () => {
    it('should validate correct signature', () => {
      const payload = JSON.stringify(testPayload);
      const secret = 'test_secret';
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;

      const isValid = webhookRouter.validateSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const payload = JSON.stringify(testPayload);
      const secret = 'test_secret';
      const signature = 'sha256=invalid_signature';

      const isValid = webhookRouter.validateSignature(payload, signature, secret);

      expect(isValid).toBe(false);
    });

    it('should handle signature validation errors', () => {
      const payload = JSON.stringify(testPayload);
      const secret = 'test_secret';
      const signature = 'invalid_format'; // No sha256= prefix

      const isValid = webhookRouter.validateSignature(payload, signature, secret);

      expect(isValid).toBe(false);
    });
  });

  describe('extractRepository', () => {
    it('should extract owner and repo from payload', () => {
      const result = webhookRouter.extractRepository(testPayload);

      expect(result).toEqual({
        owner: 'testowner',
        repo: 'testrepo'
      });
    });
  });

  describe('handler management', () => {
    it('should register and retrieve handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      webhookRouter.registerHandler('opened', handler1);
      webhookRouter.registerHandler('closed', handler2);

      expect(webhookRouter.hasHandler('opened')).toBe(true);
      expect(webhookRouter.hasHandler('closed')).toBe(true);
      expect(webhookRouter.hasHandler('unknown')).toBe(false);
    });

    it('should get all registered actions', () => {
      webhookRouter.registerHandler('opened', jest.fn());
      webhookRouter.registerHandler('closed', jest.fn());
      webhookRouter.registerHandler('created', jest.fn());

      const actions = webhookRouter.getRegisteredActions();

      expect(actions).toEqual(['opened', 'closed', 'created']);
    });

    it('should clear all handlers', () => {
      webhookRouter.registerHandler('opened', jest.fn());
      webhookRouter.registerHandler('closed', jest.fn());

      webhookRouter.clearHandlers();

      expect(webhookRouter.getRegisteredActions()).toEqual([]);
      expect(webhookRouter.hasHandler('opened')).toBe(false);
    });
  });

  describe('routeToHandler', () => {
    it('should route to correct handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      webhookRouter.registerHandler('opened', handler);

      const context = contextProvider.fromRepository('testowner', 'testrepo');
      
      await webhookRouter.routeToHandler('opened', context!, testPayload);

      expect(handler).toHaveBeenCalledWith(context, testPayload);
    });

    it('should handle missing handler gracefully', async () => {
      const context = contextProvider.fromRepository('testowner', 'testrepo');
      
      // Should not throw
      await expect(
        webhookRouter.routeToHandler('unknown', context!, testPayload)
      ).resolves.toBeUndefined();
    });

    it('should propagate handler errors', async () => {
      const error = new Error('Handler error');
      const handler = jest.fn().mockRejectedValue(error);
      webhookRouter.registerHandler('opened', handler);

      const context = contextProvider.fromRepository('testowner', 'testrepo');
      
      await expect(
        webhookRouter.routeToHandler('opened', context!, testPayload)
      ).rejects.toThrow('Handler error');
    });
  });
});