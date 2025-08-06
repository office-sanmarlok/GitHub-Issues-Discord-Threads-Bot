import { MappingContext } from "../types/contextTypes";

export interface ErrorMetrics {
  totalErrors: number;
  consecutiveErrors: number;
  lastErrorTime?: Date;
  errorTypes: Map<string, number>;
}

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class IsolatedErrorHandler {
  private errorMetrics: Map<string, ErrorMetrics> = new Map();
  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  };

  /**
   * Handle an error for a specific mapping
   */
  handleError(context: MappingContext, error: Error, operation: string): void {
    const mappingId = context.mapping.id;
    const metrics = this.getOrCreateMetrics(mappingId);

    // Update metrics
    metrics.totalErrors++;
    metrics.consecutiveErrors++;
    metrics.lastErrorTime = new Date();

    // Track error types
    const errorType = error.name || 'UnknownError';
    const errorCount = metrics.errorTypes.get(errorType) || 0;
    metrics.errorTypes.set(errorType, errorCount + 1);

    // Log with context
    context.logger.error(`Error in ${operation} for mapping ${mappingId}`, error);

    // Store updated metrics
    this.errorMetrics.set(mappingId, metrics);
  }

  /**
   * Record a successful operation (resets consecutive errors)
   */
  recordSuccess(mappingId: string): void {
    const metrics = this.errorMetrics.get(mappingId);
    if (metrics) {
      metrics.consecutiveErrors = 0;
    }
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    context: MappingContext,
    operation: string,
    fn: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: Error | undefined;
    let delay = retryOptions.initialDelay;

    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        const result = await fn();
        this.recordSuccess(context.mapping.id);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.handleError(context, lastError, operation);

        if (attempt < retryOptions.maxRetries) {
          context.logger.warn(
            `Retry ${attempt + 1}/${retryOptions.maxRetries} for ${operation} after ${delay}ms`
          );
          
          await this.sleep(delay);
          delay = Math.min(delay * retryOptions.backoffMultiplier, retryOptions.maxDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Get error metrics for a mapping
   */
  getMetrics(mappingId: string): ErrorMetrics | undefined {
    return this.errorMetrics.get(mappingId);
  }

  /**
   * Get all error metrics
   */
  getAllMetrics(): Map<string, ErrorMetrics> {
    return new Map(this.errorMetrics);
  }

  /**
   * Reset metrics for a mapping
   */
  resetMetrics(mappingId: string): void {
    this.errorMetrics.delete(mappingId);
  }

  /**
   * Check if a mapping has too many errors
   */
  isUnhealthy(mappingId: string, threshold: number = 10): boolean {
    const metrics = this.errorMetrics.get(mappingId);
    return metrics ? metrics.consecutiveErrors >= threshold : false;
  }

  private getOrCreateMetrics(mappingId: string): ErrorMetrics {
    let metrics = this.errorMetrics.get(mappingId);
    if (!metrics) {
      metrics = {
        totalErrors: 0,
        consecutiveErrors: 0,
        errorTypes: new Map()
      };
      this.errorMetrics.set(mappingId, metrics);
    }
    return metrics;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker implementation for mapping-specific operations
 */
export class MappingCircuitBreaker {
  private states: Map<string, CircuitState> = new Map();
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(
    threshold: number = 5,
    timeout: number = 60000,
    resetTimeout: number = 300000
  ) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    mappingId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const state = this.getState(mappingId);

    if (state.status === 'open') {
      if (Date.now() - state.lastFailureTime! > this.resetTimeout) {
        // Try to half-open
        state.status = 'half-open';
      } else {
        throw new Error(`Circuit breaker is open for mapping ${mappingId}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeoutPromise()
      ]);

      // Success - reset or close circuit
      if (state.status === 'half-open') {
        state.status = 'closed';
        state.failures = 0;
        state.lastFailureTime = undefined;
      }

      return result as T;
    } catch (error) {
      // Failure - update state
      state.failures++;
      state.lastFailureTime = Date.now();

      if (state.failures >= this.threshold) {
        state.status = 'open';
        throw new Error(
          `Circuit breaker opened for mapping ${mappingId} after ${state.failures} failures`
        );
      }

      throw error;
    }
  }

  /**
   * Get the current state of a circuit
   */
  getCircuitState(mappingId: string): CircuitState {
    return this.getState(mappingId);
  }

  /**
   * Manually reset a circuit
   */
  reset(mappingId: string): void {
    this.states.delete(mappingId);
  }

  /**
   * Check if a circuit is open
   */
  isOpen(mappingId: string): boolean {
    const state = this.getState(mappingId);
    return state.status === 'open';
  }

  private getState(mappingId: string): CircuitState {
    let state = this.states.get(mappingId);
    if (!state) {
      state = {
        status: 'closed',
        failures: 0
      };
      this.states.set(mappingId, state);
    }
    return state;
  }

  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), this.timeout);
    });
  }
}

interface CircuitState {
  status: 'open' | 'closed' | 'half-open';
  failures: number;
  lastFailureTime?: number;
}