# Enhanced Multi-Repository GitHub Issues Discord Threads Bot

## Overview

This enhanced version of the GitHub Issues Discord Threads Bot supports multiple repository-channel mappings within a single bot instance. It enables teams to manage issues from multiple GitHub repositories across different Discord channels, maintaining complete isolation between each mapping.

## Key Features

- **Multi-Repository Support**: Manage up to 10+ repository-channel mappings simultaneously
- **Complete Isolation**: Each mapping operates independently with its own data store
- **JSON Configuration**: Easy-to-manage configuration file instead of environment variables
- **Health Monitoring**: Built-in health checks and metrics for each mapping
- **Error Isolation**: Failures in one mapping don't affect others
- **Webhook Security**: Optional HMAC signature validation per repository
- **Circuit Breaker**: Automatic failure detection and recovery

## Architecture Changes

### Old Architecture (Single Repository)
```
Discord Channel <-> Bot <-> GitHub Repository
```

### New Architecture (Multi-Repository)
```
Discord Channel 1 <-> Bot (Store 1) <-> GitHub Repository A
Discord Channel 2 <-> Bot (Store 2) <-> GitHub Repository B
Discord Channel 3 <-> Bot (Store 3) <-> GitHub Repository C
```

## Migration Guide

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Migrate Configuration

Convert your `.env` file to the new `config.json` format:

```bash
npm run migrate
```

This will create a `config.json` file based on your existing `.env` configuration.

### Step 3: Configure Multiple Repositories

Edit `config.json` to add multiple repository mappings:

```json
{
  "discord_token": "YOUR_DISCORD_BOT_TOKEN",
  "github_access_token": "YOUR_GITHUB_ACCESS_TOKEN",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    {
      "id": "frontend-project",
      "channel_id": "1234567890123456789",
      "repository": {
        "owner": "your-org",
        "name": "frontend"
      },
      "webhook_secret": "secret_for_frontend",
      "enabled": true,
      "options": {
        "sync_labels": true,
        "sync_assignees": false
      }
    },
    {
      "id": "backend-project",
      "channel_id": "9876543210987654321",
      "repository": {
        "owner": "your-org",
        "name": "backend"
      },
      "webhook_secret": "secret_for_backend",
      "enabled": true
    }
  ]
}
```

### Step 4: Update GitHub Webhooks

For each repository, configure the webhook to point to your bot:

1. Go to Repository Settings → Webhooks
2. Add webhook URL: `https://your-domain.com:5000/webhook`
3. Content type: `application/json`
4. Secret: Use the `webhook_secret` from your mapping configuration
5. Select events:
   - Issues
   - Issue comments

### Step 5: Run the Enhanced Bot

```bash
# Development
npm run dev:enhanced

# Production (build first)
npm run build:tsc
npm run start:enhanced
```

## Configuration Reference

### Main Configuration

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `discord_token` | string | Discord bot token | Yes |
| `github_access_token` | string | GitHub personal access token | Yes |
| `webhook_port` | number | Port for webhook server | No (default: 5000) |
| `webhook_path` | string | Path for webhook endpoint | No (default: "/webhook") |
| `log_level` | string | Logging level (debug/info/warn/error) | No (default: "info") |
| `health_check_interval` | number | Health check interval in ms | No (default: 60000) |
| `mappings` | array | Repository-channel mappings | Yes |

### Mapping Configuration

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | string | Unique identifier for mapping | Yes |
| `channel_id` | string | Discord forum channel ID | Yes |
| `repository.owner` | string | GitHub repository owner | Yes |
| `repository.name` | string | GitHub repository name | Yes |
| `webhook_secret` | string | Secret for webhook validation | No |
| `enabled` | boolean | Enable/disable this mapping | No (default: true) |
| `options` | object | Additional sync options | No |

## API Endpoints

### Health Check

```bash
# Overall system health
GET /health

# Specific mapping health
GET /health/{mapping-id}

# Detailed metrics
GET /metrics
```

### Webhook

```bash
# GitHub webhook endpoint
POST /webhook
```

## Monitoring

### Health Status

The bot provides three health states:
- **healthy**: Operating normally
- **degraded**: Some issues but still functional
- **unhealthy**: Major issues, requires attention

### Metrics

Access detailed metrics at `/metrics`:
- Thread counts per mapping
- Error rates
- Response times
- Memory usage
- Last activity timestamps

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **Mapping not working**
   - Check if mapping is enabled in config.json
   - Verify channel ID is correct
   - Ensure bot has permissions in the Discord channel

2. **Webhook not received**
   - Check webhook secret matches configuration
   - Verify webhook URL is accessible
   - Check health endpoint: `/health/{mapping-id}`

3. **High error rate**
   - Check `/metrics` for error details
   - Review logs for specific mapping
   - Circuit breaker may have triggered - check health status

### Debug Mode

Enable debug logging in config.json:

```json
{
  "log_level": "debug"
}
```

## Performance Considerations

- Each mapping uses approximately 10-20MB of memory
- Supports up to 10 concurrent mappings efficiently
- Response time target: < 2 seconds for all operations
- Health checks run every 60 seconds by default

## Security

- Always use webhook secrets in production
- Keep config.json in .gitignore
- Use environment-specific configurations
- Rotate GitHub access tokens regularly
- Monitor failed webhook attempts

## Backward Compatibility

The enhanced version maintains backward compatibility with single-repository setups. You can run with just one mapping to replicate the original behavior.

## Development

### Project Structure

```
src/
├── config/          # Configuration management
├── context/         # Mapping context providers
├── discord/         # Discord handlers and actions
├── error/           # Error handling and circuit breaker
├── github/          # GitHub client factory
├── monitoring/      # Health monitoring
├── store/           # Multi-store management
├── types/           # TypeScript type definitions
├── webhook/         # Webhook routing and handlers
└── EnhancedIndex.ts # Main entry point
```

### Adding New Features

1. Always use `MappingContext` for operations
2. Ensure proper error isolation
3. Update health checks if adding new dependencies
4. Add tests for new functionality
5. Document configuration changes

## License

MIT