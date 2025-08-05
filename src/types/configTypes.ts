/**
 * Configuration types for multi-repository support
 */

/**
 * Main bot configuration structure
 */
export interface BotConfig {
  discord_token: string;
  github_access_token: string;
  webhook_port: number;
  webhook_path?: string;
  log_level?: 'debug' | 'info' | 'warn' | 'error';
  health_check_interval?: number;
  mappings: RepositoryMapping[];
}

/**
 * Repository-Channel mapping configuration
 */
export interface RepositoryMapping {
  id: string;                    // Unique identifier for the mapping
  channel_id: string;             // Discord forum channel ID
  repository: {
    owner: string;                // GitHub username or organization
    name: string;                 // Repository name
  };
  webhook_secret?: string;        // Optional webhook signature validation secret
  enabled: boolean;               // Enable/disable this mapping
  options?: MappingOptions;       // Optional configuration for future extensibility
}

/**
 * Optional mapping configuration for future extensibility
 */
export interface MappingOptions {
  sync_labels?: boolean;          // Whether to sync labels between platforms
  sync_assignees?: boolean;       // Whether to sync assignees
  auto_close_stale?: number;      // Days before auto-closing stale issues
  custom_rules?: CustomRule[];    // Custom synchronization rules
}

/**
 * Custom rule definition for advanced synchronization
 */
export interface CustomRule {
  type: 'filter' | 'transform' | 'action';
  condition: string;
  action: string;
  params?: Record<string, unknown>;
}

/**
 * Validation result for configuration
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Runtime repository credentials
 */
export interface RepoCredentials {
  owner: string;
  repo: string;
}