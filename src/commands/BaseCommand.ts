import { EmbedBuilder } from 'discord.js';
import { 
  CommandArgs, 
  CommandContext, 
  CommandResult, 
  CommandServices,
  CommandError,
  CommandErrorType
} from '../types/commandTypes';
import { logger } from '../logger';

export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  
  abstract execute(
    args: CommandArgs,
    context: CommandContext,
    services: CommandServices
  ): Promise<CommandResult>;
  
  protected handleError(error: Error | unknown): CommandResult {
    if (error instanceof CommandError) {
      logger.error(`Command error: ${error.type}`, error);
      return {
        success: false,
        message: error.toUserMessage(),
        error: error
      };
    }
    
    const unknownError = error instanceof Error ? error : new Error(String(error));
    logger.error('Unexpected command error', unknownError);
    
    return {
      success: false,
      message: '❌ 予期しないエラーが発生しました',
      error: unknownError
    };
  }
  
  async sendResponse(
    context: CommandContext,
    result: CommandResult
  ): Promise<void> {
    try {
      const responseContent = {
        content: result.message,
        embeds: result.embed ? [result.embed] : []
      };
      
      if (context.type === 'slash' && context.interaction) {
        if (context.interaction.deferred) {
          await context.interaction.editReply(responseContent);
        } else if (context.interaction.replied) {
          await context.interaction.followUp(responseContent);
        } else {
          await context.interaction.reply(responseContent);
        }
      } else if (context.message) {
        await context.message.reply(responseContent);
      }
    } catch (error) {
      logger.error('Failed to send command response', error as Error);
    }
  }
  
  protected createEmbed(title: string, color: number = 0x0099ff): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();
  }
  
  protected createSuccessEmbed(title: string, description?: string): EmbedBuilder {
    const embed = this.createEmbed(title, 0x00ff00);
    if (description) {
      embed.setDescription(description);
    }
    return embed;
  }
  
  protected createErrorEmbed(title: string, description?: string): EmbedBuilder {
    const embed = this.createEmbed(title, 0xff0000);
    if (description) {
      embed.setDescription(description);
    }
    return embed;
  }
  
  protected createInfoEmbed(title: string, description?: string): EmbedBuilder {
    const embed = this.createEmbed(title, 0x0099ff);
    if (description) {
      embed.setDescription(description);
    }
    return embed;
  }
  
  protected validateArgs(args: CommandArgs, required: string[]): void {
    for (const field of required) {
      if (!args[field as keyof CommandArgs]) {
        throw new CommandError(
          CommandErrorType.INVALID_ARGS,
          `必須パラメータ '${field}' が指定されていません`
        );
      }
    }
  }
  
  protected async deferIfNeeded(context: CommandContext): Promise<void> {
    if (context.type === 'slash' && context.interaction && !context.interaction.deferred) {
      await context.interaction.deferReply();
    }
  }
}