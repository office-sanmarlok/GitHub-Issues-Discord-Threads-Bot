# Migration Guide: Single to Multi-Repository Support

This guide helps you migrate from the single-repository version to the enhanced multi-repository version of the GitHub Issues Discord Threads Bot.

## Overview

The enhanced version introduces significant architectural changes:
- **Configuration**: Environment variables (`.env`) → JSON configuration (`config.json`)
- **Data Storage**: Single store → Multiple isolated stores
- **Event Handling**: Direct handlers → Context-based routing
- **Error Handling**: Global → Per-mapping isolation

## Migration Steps

### Step 1: Backup Current Configuration

Before starting, backup your existing configuration:

```bash
cp .env .env.backup
```

### Step 2: Install Dependencies

Update and install new dependencies:

```bash
npm install
```

### Step 3: Run Migration Script

Use the automated migration tool to convert your `.env` file:

```bash
npm run migrate
```

This creates a `config.json` file based on your `.env` configuration.

### Step 4: Review Generated Configuration

Open `config.json` and verify the migrated settings:

```json
{
  "discord_token": "YOUR_DISCORD_TOKEN",
  "github_access_token": "YOUR_GITHUB_TOKEN",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    {
      "id": "default-mapping",
      "channel_id": "YOUR_CHANNEL_ID",
      "repository": {
        "owner": "YOUR_GITHUB_USERNAME",
        "name": "YOUR_REPOSITORY"
      },
      "webhook_secret": "YOUR_WEBHOOK_SECRET",
      "enabled": true
    }
  ]
}
```

### Step 5: Add Additional Mappings (Optional)

To add more repository-channel mappings:

```json
"mappings": [
  {
    "id": "frontend-project",
    "channel_id": "1234567890123456789",
    "repository": {
      "owner": "your-org",
      "name": "frontend"
    },
    "webhook_secret": "secret_for_frontend",
    "enabled": true
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
```

### Step 6: Update GitHub Webhooks

The webhook endpoint remains the same (`/webhook`), but now supports multiple repositories:

1. Go to each repository's Settings → Webhooks
2. Update or create webhook:
   - **URL**: `https://your-server:5000/webhook`
   - **Content type**: `application/json`
   - **Secret**: Use the `webhook_secret` from your mapping
   - **Events**: Issues, Issue comments

### Step 7: Test the Migration

Run in development mode to test:

```bash
npm run dev:enhanced
```

Verify:
- Bot connects to Discord ✓
- Existing threads are loaded ✓
- New issues sync correctly ✓
- Comments sync bidirectionally ✓

### Step 8: Deploy to Production

Once testing is complete:

```bash
# Build the TypeScript code
npm run build:tsc

# Run in production
npm run start:enhanced
```

## Configuration Mapping Reference

| `.env` Variable | `config.json` Field | Notes |
|----------------|---------------------|-------|
| `DISCORD_TOKEN` | `discord_token` | Direct mapping |
| `GITHUB_ACCESS_TOKEN` | `github_access_token` | Direct mapping |
| `DISCORD_CHANNEL_ID` | `mappings[].channel_id` | Now per-mapping |
| `GITHUB_USERNAME` | `mappings[].repository.owner` | Now per-mapping |
| `GITHUB_REPOSITORY` | `mappings[].repository.name` | Now per-mapping |
| `WEBHOOK_SECRET` | `mappings[].webhook_secret` | Now per-mapping, optional |
| `WEBHOOK_PORT` | `webhook_port` | Direct mapping |
| `WEBHOOK_PATH` | `webhook_path` | Direct mapping |
| `LOG_LEVEL` | `log_level` | Direct mapping |

## New Features Available

After migration, you can take advantage of:

1. **Multiple Repository Support**
   - Add up to 10+ repository-channel mappings
   - Each mapping operates independently

2. **Health Monitoring**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5000/metrics
   ```

3. **Per-Mapping Configuration**
   - Individual webhook secrets
   - Enable/disable specific mappings
   - Custom sync options per mapping

4. **Improved Error Handling**
   - Isolated error handling per mapping
   - Circuit breaker protection
   - Exponential backoff retry logic

## Rollback Procedure

If you need to rollback to the single-repository version:

1. Restore your `.env` file:
   ```bash
   cp .env.backup .env
   ```

2. Run the original version:
   ```bash
   npm run dev  # or npm start
   ```

## Troubleshooting

### Issue: Bot doesn't start
- Check `config.json` syntax (valid JSON)
- Verify Discord token is correct
- Ensure all required fields are present

### Issue: Webhooks not received
- Check webhook secret matches configuration
- Verify webhook URL is accessible
- Use `/health/{mapping-id}` to check mapping status

### Issue: Existing threads not syncing
- Ensure channel IDs are correct
- Check bot has permissions in Discord channels
- Verify GitHub token has required permissions

### Issue: High memory usage
- Review number of active mappings
- Check health metrics at `/metrics`
- Consider disabling unused mappings

## Getting Help

- Check logs for detailed error messages
- Use debug mode: `"log_level": "debug"`
- Review health status: `/health`
- Check metrics: `/metrics`

## Best Practices

1. **Start with one mapping** to verify everything works
2. **Add mappings gradually** to identify any issues
3. **Use webhook secrets** for security
4. **Monitor health endpoints** regularly
5. **Keep config.json in .gitignore** to protect secrets
6. **Backup config.json** before making changes

## Security Considerations

- Never commit `config.json` to version control
- Use different webhook secrets for each repository
- Rotate GitHub access tokens periodically
- Monitor failed webhook attempts in logs
- Use HTTPS for webhook endpoints in production

---

For additional help, see:
- [Quick Start Guide](QUICKSTART.md)
- [EC2 Setup Guide](SETUP_GUIDE_EC2.md)
- [Main README](../../README.md)