# GitHub Issues Discord Threads Bot

A powerful bidirectional synchronization bot between Discord forum channels and GitHub repository issues. This enhanced version supports **multiple repository-channel mappings** within a single bot instance, enabling teams to manage issues from multiple GitHub repositories across different Discord channels.

## 🌟 Key Features

### Multi-Repository Support (New!)
- **Multiple Mappings**: Manage 10+ repository-channel pairs simultaneously
- **Complete Isolation**: Each mapping operates independently with its own data store
- **JSON Configuration**: Easy-to-manage configuration file
- **Health Monitoring**: Built-in health checks and metrics per mapping
- **Error Isolation**: Failures in one mapping don't affect others
- **Webhook Security**: Optional HMAC signature validation per repository

### Core Synchronization Features

#### Issues
- ✅ Discord Thread Creation → GitHub Issue Creation
- ✅ GitHub Issue Creation → Discord Thread Creation
- ✅ Bidirectional state synchronization

#### Comments
- ✅ Discord Messages → GitHub Issue Comments
- ✅ GitHub Comments → Discord Messages
- ✅ User attribution with webhooks

#### Thread/Issue Management
- ✅ Open/Close state synchronization
- ✅ Lock/Unlock state synchronization
- ✅ Thread archiving ↔ Issue closing
- ✅ Thread deletion → Issue deletion

#### Tags & Labels
- ✅ Discord Forum Tags → GitHub Issue Labels
- ✅ Label synchronization on changes
- ✅ Custom tag mapping per repository

#### Attachments
- ✅ Image support (png, jpeg)
- ✅ Markdown formatting preservation

## 🚀 Quick Start

### Prerequisites
- Node.js v18 or higher
- Discord Bot with appropriate permissions
- GitHub Personal Access Token
- Server with public IP (for webhooks)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/office-sanmarlok/GitHub-Issues-Discord-Threads-Bot.git
cd GitHub-Issues-Discord-Threads-Bot
npm install
```

2. **Migrate from legacy configuration** (if upgrading)
```bash
npm run migrate
```

3. **Configure** (`config.json`)
```json
{
  "discord_token": "YOUR_DISCORD_BOT_TOKEN",
  "github_access_token": "YOUR_GITHUB_TOKEN",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "mappings": [
    {
      "id": "project-frontend",
      "channel_id": "DISCORD_CHANNEL_ID",
      "repository": {
        "owner": "github-username",
        "name": "repository-name"
      },
      "webhook_secret": "optional_secret",
      "enabled": true
    }
  ]
}
```

4. **Run the bot**
```bash
# Development
npm run dev:enhanced

# Production
npm run build:tsc
npm run start:enhanced
```

5. **Configure GitHub Webhooks**

For each repository:
- Go to Settings → Webhooks → Add webhook
- URL: `https://your-server:5000/webhook`
- Content type: `application/json`
- Secret: (optional, use from config)
- Events: Issues, Issue comments

## 📁 Documentation

- **Setup Guides**
  - [Quick Start Guide](docs/guides/QUICKSTART.md)
  - [EC2 Setup Guide](docs/guides/SETUP_GUIDE_EC2.md)
  
- **Development**
  - [Requirements](docs/planning/requirements.md)
  - [Design Document](docs/planning/design.md)
  - [Implementation Tasks](docs/planning/tasks.md)
  
- **Legacy**
  - [Single Repository Version](docs/legacy/README.legacy.md)

## 🏗️ Architecture

### Multi-Repository Architecture
```
Discord Channel 1 ←→ Bot (Store 1) ←→ GitHub Repository A
Discord Channel 2 ←→ Bot (Store 2) ←→ GitHub Repository B
Discord Channel 3 ←→ Bot (Store 3) ←→ GitHub Repository C
```

### Key Components
- **ConfigManager**: JSON configuration management
- **MultiStore**: Isolated data stores per mapping
- **ContextProvider**: Mapping context routing
- **WebhookRouter**: Repository identification and routing
- **GitHubClientFactory**: Per-mapping API clients
- **HealthMonitor**: System and mapping health tracking
- **IsolatedErrorHandler**: Error isolation with retry logic

## 🔧 Configuration

### Main Configuration Options
| Field | Description | Required |
|-------|-------------|----------|
| `discord_token` | Discord bot token | Yes |
| `github_access_token` | GitHub personal access token | Yes |
| `webhook_port` | Webhook server port (default: 5000) | No |
| `webhook_path` | Webhook endpoint path (default: "/webhook") | No |
| `mappings` | Array of repository-channel mappings | Yes |

### Mapping Configuration
| Field | Description | Required |
|-------|-------------|----------|
| `id` | Unique mapping identifier | Yes |
| `channel_id` | Discord forum channel ID | Yes |
| `repository.owner` | GitHub repository owner | Yes |
| `repository.name` | GitHub repository name | Yes |
| `webhook_secret` | HMAC signature secret | No |
| `enabled` | Enable/disable mapping | No |

## 📊 Monitoring

### Health Endpoints
```bash
GET /health          # System health
GET /health/{id}     # Mapping health
GET /metrics         # Detailed metrics
```

### Health States
- **🟢 Healthy**: Operating normally
- **🟡 Degraded**: Some issues but functional
- **🔴 Unhealthy**: Major issues requiring attention

## 🧪 Testing

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 🔄 Migration from Single Repository

If you're upgrading from the single-repository version:

1. Run the migration script: `npm run migrate`
2. Review and edit the generated `config.json`
3. Test with: `npm run dev:enhanced`
4. Update GitHub webhook URLs

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All tests pass
- Code follows existing patterns
- Documentation is updated
- Error handling maintains isolation

## 📝 License

MIT

## 🙏 Acknowledgments

Original single-repository version by Nicat.

---

For detailed setup instructions, see [Quick Start Guide](docs/guides/QUICKSTART.md) or [EC2 Setup Guide](docs/guides/SETUP_GUIDE_EC2.md).