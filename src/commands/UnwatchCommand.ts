import { BaseCommand } from './BaseCommand';
import { 
  CommandArgs, 
  CommandContext, 
  CommandResult, 
  CommandServices,
  CommandError,
  CommandErrorType
} from '../types/commandTypes';
import { logger } from '../logger';

export class UnwatchCommand extends BaseCommand {
  name = 'unwatch';
  description = 'GitHub リポジトリの監視を停止';
  
  async execute(
    args: CommandArgs,
    context: CommandContext,
    services: CommandServices
  ): Promise<CommandResult> {
    try {
      // Validate arguments
      this.validateArgs(args, ['owner', 'repo']);
      
      const { owner, repo, deleteChannel } = args;
      
      // Defer reply if slash command
      await this.deferIfNeeded(context);
      
      logger.info('Executing unwatch command', {
        owner,
        repo,
        deleteChannel,
        user: context.user.tag,
        guild: context.guild.name
      });
      
      // Remove mapping
      await services.mappingManager.removeMapping(
        owner!,
        repo!,
        deleteChannel || false
      );
      
      // Create success embed
      const embed = this.createSuccessEmbed(
        `✅ 監視を停止しました`,
        `**リポジトリ**: ${owner}/${repo}\n` +
        `**チャンネル削除**: ${deleteChannel ? 'はい' : 'いいえ'}`
      );
      
      return {
        success: true,
        message: `✅ ${owner}/${repo} の監視を停止しました`,
        embed
      };
    } catch (error) {
      logger.error('Unwatch command failed', error as Error);
      return this.handleError(error);
    }
  }
}