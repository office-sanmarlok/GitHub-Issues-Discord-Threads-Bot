import { GitHubClientFactory } from '../GitHubClientFactory';
import { MappingContext } from '../../types/contextTypes';
import { Octokit } from '@octokit/rest';

// Mock Octokit
jest.mock('@octokit/rest');
jest.mock('@octokit/graphql');

// Mock config
jest.mock('../../config', () => ({
  config: {
    GITHUB_ACCESS_TOKEN: 'test_token'
  }
}));

// Mock logger
jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('GitHubClientFactory', () => {
  let factory: GitHubClientFactory;
  let mockContext: MappingContext;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    factory = new GitHubClientFactory('test_token');
    
    mockContext = {
      mapping: {
        id: 'mapping1',
        channel_id: 'channel123',
        repository: {
          owner: 'testowner',
          name: 'testrepo'
        },
        enabled: true
      },
      store: {} as any,
      repoCredentials: {
        owner: 'testowner',
        repo: 'testrepo'
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }
    };

    // Setup mock Octokit instance
    mockOctokit = {
      rest: {
        issues: {
          create: jest.fn(),
          createComment: jest.fn(),
          update: jest.fn(),
          lock: jest.fn(),
          unlock: jest.fn(),
          deleteComment: jest.fn(),
          listForRepo: jest.fn(),
          listCommentsForRepo: jest.fn()
        }
      }
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(() => mockOctokit);
  });

  describe('getClient', () => {
    it('should create and cache client for mapping', () => {
      const client1 = factory.getClient(mockContext);
      const client2 = factory.getClient(mockContext);

      expect(client1).toBe(client2); // Should return same cached instance
      expect(Octokit).toHaveBeenCalledTimes(1); // Should only create once
      expect(Octokit).toHaveBeenCalledWith({
        auth: 'test_token',
        baseUrl: 'https://api.github.com'
      });
    });

    it('should create separate clients for different mappings', () => {
      const context2 = {
        ...mockContext,
        mapping: { ...mockContext.mapping, id: 'mapping2' }
      };

      const client1 = factory.getClient(mockContext);
      const client2 = factory.getClient(context2);

      expect(client1).toBe(client2); // In this test they'll be same mock
      expect(Octokit).toHaveBeenCalledTimes(2); // Should create twice
    });
  });

  describe('createIssue', () => {
    it('should create issue with correct parameters', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          id: 1,
          number: 42,
          title: 'Test Issue',
          body: 'Test Body'
        }
      } as any);

      const result = await factory.createIssue(mockContext, {
        title: 'Test Issue',
        body: 'Test Body',
        labels: ['bug', 'help wanted']
      });

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test Issue',
        body: 'Test Body',
        labels: ['bug', 'help wanted'],
        assignees: undefined
      });

      expect(result.number).toBe(42);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Created issue #42: Test Issue'
      );
    });

    it('should handle errors when creating issue', async () => {
      const error = new Error('API Error');
      mockOctokit.rest.issues.create.mockRejectedValue(error);

      await expect(
        factory.createIssue(mockContext, {
          title: 'Test Issue',
          body: 'Test Body'
        })
      ).rejects.toThrow('API Error');

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to create issue',
        error
      );
    });
  });

  describe('createComment', () => {
    it('should create comment with correct parameters', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: {
          id: 123,
          body: 'Test Comment'
        }
      } as any);

      const result = await factory.createComment(mockContext, 42, {
        body: 'Test Comment'
      });

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 42,
        body: 'Test Comment'
      });

      expect(result.body).toBe('Test Comment');
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Created comment on issue #42'
      );
    });
  });

  describe('updateIssue', () => {
    it('should update issue with correct parameters', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({
        data: {
          number: 42,
          state: 'closed'
        }
      } as any);

      await factory.updateIssue(mockContext, 42, {
        state: 'closed',
        labels: ['resolved']
      });

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 42,
        state: 'closed',
        labels: ['resolved']
      });

      expect(mockContext.logger.info).toHaveBeenCalledWith('Updated issue #42');
    });
  });

  describe('lockIssue', () => {
    it('should lock issue with reason', async () => {
      mockOctokit.rest.issues.lock.mockResolvedValue({} as any);

      await factory.lockIssue(mockContext, 42, 'resolved');

      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 42,
        lock_reason: 'resolved'
      });

      expect(mockContext.logger.info).toHaveBeenCalledWith('Locked issue #42');
    });

    it('should lock issue without reason', async () => {
      mockOctokit.rest.issues.lock.mockResolvedValue({} as any);

      await factory.lockIssue(mockContext, 42);

      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 42,
        lock_reason: undefined
      });
    });
  });

  describe('unlockIssue', () => {
    it('should unlock issue', async () => {
      mockOctokit.rest.issues.unlock.mockResolvedValue({} as any);

      await factory.unlockIssue(mockContext, 42);

      expect(mockOctokit.rest.issues.unlock).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 42
      });

      expect(mockContext.logger.info).toHaveBeenCalledWith('Unlocked issue #42');
    });
  });

  describe('deleteComment', () => {
    it('should delete comment', async () => {
      mockOctokit.rest.issues.deleteComment.mockResolvedValue({} as any);

      await factory.deleteComment(mockContext, 123);

      expect(mockOctokit.rest.issues.deleteComment).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        comment_id: 123
      });

      expect(mockContext.logger.info).toHaveBeenCalledWith('Deleted comment 123');
    });
  });

  describe('getIssues', () => {
    it('should fetch all issues', async () => {
      const mockIssues = [
        { id: 1, number: 1, title: 'Issue 1' },
        { id: 2, number: 2, title: 'Issue 2' }
      ];

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: mockIssues
      } as any);

      const result = await factory.getIssues(mockContext);

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        state: 'all',
        per_page: 100
      });

      expect(result).toEqual(mockIssues);
      expect(mockContext.logger.info).toHaveBeenCalledWith('Fetched 2 issues');
    });

    it('should fetch issues with specific state', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      } as any);

      await factory.getIssues(mockContext, 'open');

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        state: 'open',
        per_page: 100
      });
    });
  });

  describe('getCommentsForRepo', () => {
    it('should fetch repository comments', async () => {
      const mockComments = [
        { id: 1, body: 'Comment 1' },
        { id: 2, body: 'Comment 2' }
      ];

      mockOctokit.rest.issues.listCommentsForRepo.mockResolvedValue({
        data: mockComments
      } as any);

      const result = await factory.getCommentsForRepo(mockContext);

      expect(mockOctokit.rest.issues.listCommentsForRepo).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        per_page: 100
      });

      expect(result).toEqual(mockComments);
      expect(mockContext.logger.info).toHaveBeenCalledWith('Fetched 2 comments');
    });
  });

  describe('client management', () => {
    it('should clear all cached clients', () => {
      factory.getClient(mockContext);
      expect(factory.getClientCount()).toBe(1);

      factory.clearClients();
      
      expect(factory.getClientCount()).toBe(0);
    });

    it('should track number of cached clients', () => {
      expect(factory.getClientCount()).toBe(0);

      factory.getClient(mockContext);
      expect(factory.getClientCount()).toBe(1);

      const context2 = {
        ...mockContext,
        mapping: { ...mockContext.mapping, id: 'mapping2' }
      };
      factory.getClient(context2);
      expect(factory.getClientCount()).toBe(2);
    });
  });
});