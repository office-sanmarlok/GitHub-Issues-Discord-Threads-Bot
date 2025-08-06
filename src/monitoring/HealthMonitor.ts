import { MultiStore } from "../store/MultiStore";
import { IsolatedErrorHandler } from "../error/IsolatedErrorHandler";
import { BotConfig } from "../types/configTypes";

export interface MappingHealth {
  mappingId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: {
    threadCount: number;
    errorCount: number;
    consecutiveErrors: number;
    lastError?: Date;
    uptime: number;
    lastActivity?: Date;
  };
  checks: {
    discord: boolean;
    github: boolean;
    store: boolean;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  mappings: MappingHealth[];
  systemMetrics: {
    totalMappings: number;
    activeMappings: number;
    healthyMappings: number;
    degradedMappings: number;
    unhealthyMappings: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

export class HealthMonitor {
  private startTime: Date;
  private lastActivityTimes: Map<string, Date> = new Map();
  private checkInterval?: NodeJS.Timer;
  private healthCache: Map<string, MappingHealth> = new Map();

  constructor(
    private multiStore: MultiStore,
    private errorHandler: IsolatedErrorHandler,
    private config: BotConfig
  ) {
    this.startTime = new Date();
  }

  /**
   * Start periodic health checks
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Record activity for a mapping
   */
  recordActivity(mappingId: string): void {
    this.lastActivityTimes.set(mappingId, new Date());
  }

  /**
   * Get health status for a specific mapping
   */
  async getMappingHealth(mappingId: string): Promise<MappingHealth | undefined> {
    const mapping = this.multiStore.getMapping(mappingId);
    if (!mapping) return undefined;

    const store = this.multiStore.getStoreByMappingId(mappingId);
    if (!store) return undefined;

    const errorMetrics = this.errorHandler.getMetrics(mappingId);
    const lastActivity = this.lastActivityTimes.get(mappingId);
    const now = new Date();

    // Perform health checks
    const checks = {
      discord: await this.checkDiscordConnection(mappingId),
      github: await this.checkGitHubConnection(mappingId),
      store: store !== undefined
    };

    // Calculate status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorMetrics && errorMetrics.consecutiveErrors > 10) {
      status = 'unhealthy';
    } else if (errorMetrics && errorMetrics.consecutiveErrors > 5) {
      status = 'degraded';
    } else if (!checks.discord || !checks.github || !checks.store) {
      status = 'degraded';
    }

    // Check for inactivity (if no activity for over 24 hours, mark as degraded)
    if (lastActivity) {
      const inactiveHours = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      if (inactiveHours > 24 && status === 'healthy') {
        status = 'degraded';
      }
    }

    const health: MappingHealth = {
      mappingId,
      status,
      lastCheck: now,
      metrics: {
        threadCount: store.threads.length,
        errorCount: errorMetrics?.totalErrors || 0,
        consecutiveErrors: errorMetrics?.consecutiveErrors || 0,
        lastError: errorMetrics?.lastErrorTime,
        uptime: now.getTime() - this.startTime.getTime(),
        lastActivity
      },
      checks
    };

    this.healthCache.set(mappingId, health);
    return health;
  }

  /**
   * Get system-wide health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const mappings = this.multiStore.getAllMappings();
    const mappingHealths: MappingHealth[] = [];

    for (const mapping of mappings) {
      const health = await this.getMappingHealth(mapping.id);
      if (health) {
        mappingHealths.push(health);
      }
    }

    const healthCounts = {
      healthy: mappingHealths.filter(m => m.status === 'healthy').length,
      degraded: mappingHealths.filter(m => m.status === 'degraded').length,
      unhealthy: mappingHealths.filter(m => m.status === 'unhealthy').length
    };

    // Determine overall system status
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthCounts.unhealthy > mappings.length * 0.5) {
      systemStatus = 'unhealthy';
    } else if (healthCounts.unhealthy > 0 || healthCounts.degraded > mappings.length * 0.3) {
      systemStatus = 'degraded';
    }

    return {
      status: systemStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      mappings: mappingHealths,
      systemMetrics: {
        totalMappings: mappings.length,
        activeMappings: mappings.filter(m => m.enabled).length,
        healthyMappings: healthCounts.healthy,
        degradedMappings: healthCounts.degraded,
        unhealthyMappings: healthCounts.unhealthy,
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Get a simple health check response
   */
  async getHealthCheck(): Promise<{ status: string; timestamp: string }> {
    const health = await this.getSystemHealth();
    return {
      status: health.status,
      timestamp: health.timestamp.toISOString()
    };
  }

  /**
   * Get detailed metrics for monitoring
   */
  async getMetrics(): Promise<any> {
    const health = await this.getSystemHealth();
    
    return {
      system: {
        status: health.status,
        uptime: health.uptime,
        memory: health.systemMetrics.memoryUsage,
        mappings: {
          total: health.systemMetrics.totalMappings,
          active: health.systemMetrics.activeMappings,
          healthy: health.systemMetrics.healthyMappings,
          degraded: health.systemMetrics.degradedMappings,
          unhealthy: health.systemMetrics.unhealthyMappings
        }
      },
      mappings: health.mappings.map(m => ({
        id: m.mappingId,
        status: m.status,
        threads: m.metrics.threadCount,
        errors: m.metrics.errorCount,
        lastActivity: m.metrics.lastActivity?.toISOString()
      }))
    };
  }

  /**
   * Reset health metrics for a mapping
   */
  resetMappingHealth(mappingId: string): void {
    this.healthCache.delete(mappingId);
    this.lastActivityTimes.delete(mappingId);
    this.errorHandler.resetMetrics(mappingId);
  }

  private async performHealthCheck(): Promise<void> {
    const mappings = this.multiStore.getAllMappings();
    
    for (const mapping of mappings) {
      if (mapping.enabled) {
        await this.getMappingHealth(mapping.id);
      }
    }
  }

  private async checkDiscordConnection(mappingId: string): Promise<boolean> {
    // This would check if Discord channel is accessible
    // For now, return true as a placeholder
    // In production, this would verify channel access
    return true;
  }

  private async checkGitHubConnection(mappingId: string): Promise<boolean> {
    // This would check if GitHub repository is accessible
    // For now, return true as a placeholder
    // In production, this would make a test API call
    return true;
  }
}