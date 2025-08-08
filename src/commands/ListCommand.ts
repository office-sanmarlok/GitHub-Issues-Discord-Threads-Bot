import { BaseCommand } from './BaseCommand';
import { 
  CommandArgs, 
  CommandContext, 
  CommandResult, 
  CommandServices
} from '../types/commandTypes';
import { logger } from '../logger';

export class ListCommand extends BaseCommand {
  name = 'list';
  description = '監視中のリポジトリ一覧を表示';
  
  async execute(
    args: CommandArgs,
    context: CommandContext,
    services: CommandServices
  ): Promise<CommandResult> {
    try {
      logger.info('Executing list command', {
        user: context.user.tag,
        guild: context.guild.name
      });
      
      // Get all mappings
      const mappings = services.mappingManager.getAllMappings();
      
      if (mappings.length === 0) {
        const embed = this.createInfoEmbed(
          '監視中のリポジトリ',
          '現在監視中のリポジトリはありません。\n`/watch` コマンドでリポジトリの監視を開始できます。'
        );
        
        return {
          success: true,
          message: '監視中のリポジトリはありません',
          embed
        };
      }
      
      // Create list embed
      const embed = this.createInfoEmbed('監視中のリポジトリ一覧');
      
      // Add fields for each mapping
      for (const mapping of mappings) {
        const repoName = `${mapping.repository.owner}/${mapping.repository.name}`;
        const fieldName = `📦 ${repoName}`;
        const fieldValue = 
          `**チャンネル**: <#${mapping.channel_id}>\n` +
          `**状態**: ${mapping.enabled ? '✅ 有効' : '⏸️ 無効'}\n` +
          `**作成日**: ${mapping.created_at ? new Date(mapping.created_at).toLocaleDateString() : '不明'}\n` +
          `**ID**: \`${mapping.id}\``;
        
        embed.addFields({
          name: fieldName,
          value: fieldValue,
          inline: false
        });
      }
      
      embed.setFooter({
        text: `合計 ${mappings.length} 個のリポジトリを監視中`
      });
      
      return {
        success: true,
        message: `監視中のリポジトリ: ${mappings.length}個`,
        embed
      };
    } catch (error) {
      logger.error('List command failed', error as Error);
      return this.handleError(error);
    }
  }
}