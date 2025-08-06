import { Client, GatewayIntentBits } from "discord.js";
import express, { Request, Response } from "express";
import { ConfigManager } from "./config/ConfigManager";
import { MultiStore } from "./store/MultiStore";
import { ContextProvider } from "./context/ContextProvider";
import { WebhookRouter } from "./webhook/WebhookRouter";
import { GitHubClientFactory } from "./github/GitHubClientFactory";
import { EnhancedDiscordHandlers } from "./discord/EnhancedDiscordHandlers";
import { GitHubWebhookHandlers } from "./webhook/GitHubWebhookHandlers";
import { IsolatedErrorHandler } from "./error/IsolatedErrorHandler";
import { HealthMonitor } from "./monitoring/HealthMonitor";
import { logger } from "./logger";
import { BotConfig } from "./types/configTypes";

export class EnhancedBot {
  private client: Client;
  private app: express.Application;
  private config!: BotConfig;
  private configManager: ConfigManager;
  private multiStore: MultiStore;
  private contextProvider: ContextProvider;
  private webhookRouter: WebhookRouter;
  private githubFactory: GitHubClientFactory;
  private discordHandlers: EnhancedDiscordHandlers;
  private githubHandlers: GitHubWebhookHandlers;
  private errorHandler: IsolatedErrorHandler;
  private healthMonitor: HealthMonitor;

  constructor() {
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildWebhooks,
      ],
    });

    // Initialize Express app
    this.app = express();
    this.app.use(express.json());

    // Initialize core components
    this.configManager = new ConfigManager();
    this.multiStore = new MultiStore();
    this.contextProvider = new ContextProvider(this.multiStore);
    this.webhookRouter = new WebhookRouter(this.multiStore, this.contextProvider);
    this.errorHandler = new IsolatedErrorHandler();
  }

  /**
   * Initialize and start the bot
   */
  async start(): Promise<void> {
    try {
      logger.info("Starting Enhanced GitHub Issues Discord Threads Bot...");

      // Load configuration
      await this.loadConfiguration();

      // Initialize stores for all mappings
      await this.initializeStores();

      // Initialize GitHub client factory
      this.githubFactory = new GitHubClientFactory(this.config.github_access_token);

      // Initialize handlers
      this.discordHandlers = new EnhancedDiscordHandlers(
        this.multiStore,
        this.contextProvider,
        this.githubFactory
      );
      this.githubHandlers = new GitHubWebhookHandlers(this.client);

      // Initialize health monitor
      this.healthMonitor = new HealthMonitor(
        this.multiStore,
        this.errorHandler,
        this.config
      );

      // Setup Discord event handlers
      this.setupDiscordHandlers();

      // Setup GitHub webhook handlers
      this.setupWebhookHandlers();

      // Setup Express routes
      this.setupExpressRoutes();

      // Start health monitoring
      this.healthMonitor.startMonitoring(this.config.health_check_interval || 60000);

      // Login to Discord
      await this.client.login(this.config.discord_token);

      // Start webhook server
      const port = this.config.webhook_port || 5000;
      this.app.listen(port, () => {
        logger.info(`Webhook server listening on port ${port}`);
      });

      logger.info("Bot successfully started!");
    } catch (error) {
      logger.error("Failed to start bot", error as Error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down bot...");

    // Stop health monitoring
    this.healthMonitor.stopMonitoring();

    // Destroy Discord client
    this.client.destroy();

    // Clear GitHub clients
    this.githubFactory.clearClients();

    logger.info("Bot shutdown complete");
    process.exit(0);
  }

  private async loadConfiguration(): Promise<void> {
    logger.info("Loading configuration...");
    this.config = await this.configManager.loadConfig();
    logger.info(`Loaded ${this.config.mappings.length} repository mappings`);
  }

  private async initializeStores(): Promise<void> {
    logger.info("Initializing stores for mappings...");
    await this.multiStore.initialize(this.config.mappings);
    
    const enabledMappings = this.config.mappings.filter(m => m.enabled);
    logger.info(`Initialized ${enabledMappings.length} active stores`);
  }

  private setupDiscordHandlers(): void {
    logger.info("Setting up Discord event handlers...");

    // Client ready event
    this.client.once("ready", async () => {
      await this.discordHandlers.handleClientReady(this.client);
    });

    // Thread events
    this.client.on("threadCreate", async (thread) => {
      try {
        await this.discordHandlers.handleThreadCreate(thread);
      } catch (error) {
        logger.error("Error handling thread create", error as Error);
      }
    });

    this.client.on("threadUpdate", async (_, newThread) => {
      try {
        await this.discordHandlers.handleThreadUpdate(newThread);
      } catch (error) {
        logger.error("Error handling thread update", error as Error);
      }
    });

    this.client.on("threadDelete", async (thread) => {
      try {
        await this.discordHandlers.handleThreadDelete(thread);
      } catch (error) {
        logger.error("Error handling thread delete", error as Error);
      }
    });

    // Message events
    this.client.on("messageCreate", async (message) => {
      try {
        await this.discordHandlers.handleMessageCreate(message);
      } catch (error) {
        logger.error("Error handling message create", error as Error);
      }
    });

    this.client.on("messageDelete", async (message) => {
      try {
        await this.discordHandlers.handleMessageDelete(message);
      } catch (error) {
        logger.error("Error handling message delete", error as Error);
      }
    });

    // Channel events
    this.client.on("channelUpdate", async (_, newChannel) => {
      try {
        await this.discordHandlers.handleChannelUpdate(newChannel);
      } catch (error) {
        logger.error("Error handling channel update", error as Error);
      }
    });

    logger.info("Discord event handlers configured");
  }

  private setupWebhookHandlers(): void {
    logger.info("Setting up GitHub webhook handlers...");

    // Issue events
    this.webhookRouter.registerHandler("opened", 
      (ctx, payload) => this.githubHandlers.handleIssueOpened(ctx, payload));
    this.webhookRouter.registerHandler("closed", 
      (ctx, payload) => this.githubHandlers.handleIssueClosed(ctx, payload));
    this.webhookRouter.registerHandler("reopened", 
      (ctx, payload) => this.githubHandlers.handleIssueReopened(ctx, payload));
    this.webhookRouter.registerHandler("locked", 
      (ctx, payload) => this.githubHandlers.handleIssueLocked(ctx, payload));
    this.webhookRouter.registerHandler("unlocked", 
      (ctx, payload) => this.githubHandlers.handleIssueUnlocked(ctx, payload));
    this.webhookRouter.registerHandler("deleted", 
      (ctx, payload) => this.githubHandlers.handleIssueDeleted(ctx, payload));
    this.webhookRouter.registerHandler("edited", 
      (ctx, payload) => this.githubHandlers.handleIssueEdited(ctx, payload));
    this.webhookRouter.registerHandler("labeled", 
      (ctx, payload) => this.githubHandlers.handleIssueLabeled(ctx, payload));
    this.webhookRouter.registerHandler("unlabeled", 
      (ctx, payload) => this.githubHandlers.handleIssueUnlabeled(ctx, payload));

    // Issue comment events
    this.webhookRouter.registerHandler("created", 
      async (ctx, payload) => {
        // Check if this is an issue comment event
        if (payload.comment && payload.issue) {
          await this.githubHandlers.handleIssueCommentCreated(ctx, payload);
        }
      });
    this.webhookRouter.registerHandler("edited", 
      async (ctx, payload) => {
        if (payload.comment && payload.issue) {
          await this.githubHandlers.handleIssueCommentEdited(ctx, payload);
        }
      });
    this.webhookRouter.registerHandler("deleted", 
      async (ctx, payload) => {
        if (payload.comment && payload.issue) {
          await this.githubHandlers.handleIssueCommentDeleted(ctx, payload);
        }
      });

    // Ping event
    this.webhookRouter.registerHandler("ping", 
      (ctx, payload) => this.githubHandlers.handlePing(ctx, payload));

    logger.info("GitHub webhook handlers configured");
  }

  private setupExpressRoutes(): void {
    logger.info("Setting up Express routes...");

    // Main webhook endpoint
    const webhookPath = this.config.webhook_path || "/webhook";
    this.app.post(webhookPath, async (req: Request, res: Response) => {
      try {
        await this.webhookRouter.handleWebhook(req, res);
      } catch (error) {
        logger.error("Error handling webhook", error as Error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Health check endpoint
    this.app.get("/health", async (req: Request, res: Response) => {
      try {
        const health = await this.healthMonitor.getHealthCheck();
        res.json(health);
      } catch (error) {
        logger.error("Error getting health status", error as Error);
        res.status(500).json({ status: "error" });
      }
    });

    // Detailed metrics endpoint
    this.app.get("/metrics", async (req: Request, res: Response) => {
      try {
        const metrics = await this.healthMonitor.getMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error("Error getting metrics", error as Error);
        res.status(500).json({ error: "Failed to get metrics" });
      }
    });

    // Mapping-specific health endpoint
    this.app.get("/health/:mappingId", async (req: Request, res: Response) => {
      try {
        const health = await this.healthMonitor.getMappingHealth(req.params.mappingId);
        if (health) {
          res.json(health);
        } else {
          res.status(404).json({ error: "Mapping not found" });
        }
      } catch (error) {
        logger.error("Error getting mapping health", error as Error);
        res.status(500).json({ error: "Failed to get mapping health" });
      }
    });

    logger.info("Express routes configured");
  }
}

// Create and export bot instance
export const bot = new EnhancedBot();

// Handle process signals for graceful shutdown
process.on("SIGINT", () => bot.shutdown());
process.on("SIGTERM", () => bot.shutdown());

// Start the bot if this is the main module
if (require.main === module) {
  bot.start().catch((error) => {
    logger.error("Failed to start bot", error);
    process.exit(1);
  });
}