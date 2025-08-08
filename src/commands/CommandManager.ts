import { 
  Client, 
  Message, 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  REST,
  Routes,
  TextChannel,
  ForumChannel
} from 'discord.js';
import { BaseCommand } from './BaseCommand';
import { 
  CommandContext, 
  CommandArgs, 
  CommandResult,
  CommandServices 
} from '../types/commandTypes';
import { logger } from '../logger';
import { MultiStore } from '../store/MultiStore';
import { DynamicMappingManager } from '../managers/DynamicMappingManager';
import { GitHubClientFactory } from '../github/GitHubClientFactory';

export class CommandManager {
  private commands: Map<string, BaseCommand> = new Map();
  private prefix: string;
  private services: CommandServices;
  
  constructor(
    private client: Client,
    private multiStore: MultiStore,
    private githubFactory: GitHubClientFactory,
    prefix: string = '!'
  ) {
    this.prefix = prefix;
    this.services = {
      multiStore,
      mappingManager: null!, // Will be set after DynamicMappingManager is created
      githubFactory,
      discordClient: client
    };
  }
  
  setMappingManager(mappingManager: DynamicMappingManager): void {
    this.services.mappingManager = mappingManager;
  }
  
  registerCommand(command: BaseCommand): void {
    this.commands.set(command.name, command);
    logger.info(`Registered command: ${command.name}`);
  }
  
  async registerSlashCommands(): Promise<void> {
    if (!this.client.application) {
      logger.error('Client application not ready');
      return;
    }
    
    const slashCommands = [];
    
    // Watch command
    slashCommands.push(
      new SlashCommandBuilder()
        .setName('watch')
        .setDescription('GitHub リポジトリの監視を開始')
        .addStringOption(option =>
          option.setName('owner')
            .setDescription('リポジトリのオーナー')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('repo')
            .setDescription('リポジトリ名')
            .setRequired(true))
        .toJSON()
    );
    
    // Unwatch command
    slashCommands.push(
      new SlashCommandBuilder()
        .setName('unwatch')
        .setDescription('GitHub リポジトリの監視を停止')
        .addStringOption(option =>
          option.setName('owner')
            .setDescription('リポジトリのオーナー')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('repo')
            .setDescription('リポジトリ名')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('delete_channel')
            .setDescription('チャンネルも削除するか')
            .setRequired(false))
        .toJSON()
    );
    
    // List command
    slashCommands.push(
      new SlashCommandBuilder()
        .setName('list')
        .setDescription('監視中のリポジトリ一覧を表示')
        .toJSON()
    );
    
    try {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
      
      // Register commands for all guilds the bot is in
      const guilds = this.client.guilds.cache;
      
      for (const [guildId, guild] of guilds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(this.client.application.id, guildId),
            { body: slashCommands }
          );
          logger.info(`Registered slash commands for guild: ${guild.name}`);
        } catch (error) {
          logger.error(`Failed to register commands for guild ${guild.name}`, error as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to register slash commands', error as Error);
    }
  }
  
  async handlePrefixCommand(message: Message): Promise<void> {
    if (!message.content.startsWith(this.prefix)) {
      return;
    }
    
    const args = message.content.slice(this.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    
    if (!commandName) {
      return;
    }
    
    const command = this.commands.get(commandName);
    if (!command) {
      return;
    }
    
    try {
      const context = this.createContextFromMessage(message);
      const commandArgs = this.parseArgs(commandName, args);
      
      logger.info('Executing prefix command', {
        command: commandName,
        user: message.author.tag,
        guild: message.guild?.name,
        args: commandArgs
      });
      
      const result = await command.execute(commandArgs, context, this.services);
      await command.sendResponse(context, result);
    } catch (error) {
      logger.error(`Error executing prefix command: ${commandName}`, error as Error);
      await message.reply('❌ コマンドの実行中にエラーが発生しました');
    }
  }
  
  async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply('❌ 不明なコマンドです');
      return;
    }
    
    try {
      const context = this.createContextFromInteraction(interaction);
      const commandArgs = this.parseInteractionOptions(interaction);
      
      logger.info('Executing slash command', {
        command: interaction.commandName,
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        args: commandArgs
      });
      
      const result = await command.execute(commandArgs, context, this.services);
      await command.sendResponse(context, result);
    } catch (error) {
      logger.error(`Error executing slash command: ${interaction.commandName}`, error as Error);
      
      const errorMessage = '❌ コマンドの実行中にエラーが発生しました';
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else if (interaction.replied) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
  
  private createContextFromMessage(message: Message): CommandContext {
    return {
      type: 'prefix',
      user: message.author,
      channel: message.channel as TextChannel | ForumChannel,
      guild: message.guild!,
      message
    };
  }
  
  private createContextFromInteraction(interaction: ChatInputCommandInteraction): CommandContext {
    return {
      type: 'slash',
      user: interaction.user,
      channel: interaction.channel as TextChannel | ForumChannel,
      guild: interaction.guild!,
      interaction
    };
  }
  
  private parseArgs(commandName: string, args: string[]): CommandArgs {
    const result: CommandArgs = {};
    
    switch (commandName) {
      case 'watch':
        result.owner = args[0];
        result.repo = args[1];
        break;
        
      case 'unwatch':
        result.owner = args[0];
        result.repo = args[1];
        result.deleteChannel = args[2] === 'true' || args[2] === 'yes';
        break;
        
      case 'list':
        // No arguments needed
        break;
    }
    
    return result;
  }
  
  private parseInteractionOptions(interaction: ChatInputCommandInteraction): CommandArgs {
    const result: CommandArgs = {};
    
    result.owner = interaction.options.getString('owner') || undefined;
    result.repo = interaction.options.getString('repo') || undefined;
    result.deleteChannel = interaction.options.getBoolean('delete_channel') || false;
    
    return result;
  }
  
  async executeCommand(
    commandName: string,
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const command = this.commands.get(commandName);
    if (!command) {
      return {
        success: false,
        message: '❌ 不明なコマンドです'
      };
    }
    
    return await command.execute(args, context, this.services);
  }
}