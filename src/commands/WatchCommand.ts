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

export class WatchCommand extends BaseCommand {
  name = 'watch';
  description = 'GitHub リポジトリの監視を開始';
  
  async execute(
    args: CommandArgs,
    context: CommandContext,
    services: CommandServices
  ): Promise<CommandResult> {
    try {
      // Validate arguments
      this.validateArgs(args, ['owner', 'repo']);
      
      const { owner, repo } = args;
      
      // Check if forum category is configured
      const botConfig = (services.mappingManager as any).configManager?.getConfig();
      
      if (!botConfig?.forum_category_id) {
        throw new CommandError(
          CommandErrorType.NO_CATEGORY,
          'フォーラムカテゴリが設定されていません。config.json に forum_category_id を設定してください。'
        );
      }
      
      // Defer reply if slash command
      await this.deferIfNeeded(context);
      
      logger.info('Executing watch command', {
        owner,
        repo,
        user: context.user.tag,
        guild: context.guild.name
      });
      
      // Add mapping
      const result = await services.mappingManager.addMapping(
        owner!,
        repo!,
        botConfig.forum_category_id,
        context.user.id
      );
      
      // Create success embed
      const embed = this.createSuccessEmbed(
        `✅ 監視を開始しました`,
        `**リポジトリ**: ${owner}/${repo}\n` +
        `**チャンネル**: <#${result.channelId}>\n` +
        `**マッピングID**: ${result.mapping.id}`
      );
      
      if (result.syncResult) {
        embed.addFields({
          name: '初期同期結果',
          value: `同期: ${result.syncResult.synced}件 / 全体: ${result.syncResult.total}件\n` +
                 `スキップ: ${result.syncResult.skipped}件 / エラー: ${result.syncResult.errors}件`
        });
      }
      
      return {
        success: true,
        message: `✅ ${owner}/${repo} の監視を開始しました`,
        embed
      };
    } catch (error) {
      logger.error('Watch command failed', error as Error);
      return this.handleError(error);
    }
  }
}