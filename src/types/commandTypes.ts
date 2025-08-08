import { 
  Client, 
  Guild, 
  User, 
  Message, 
  TextChannel, 
  ForumChannel, 
  ChatInputCommandInteraction,
  EmbedBuilder 
} from 'discord.js';
import { MultiStore } from '../store/MultiStore';
import { DynamicMappingManager } from '../managers/DynamicMappingManager';
import { GitHubClientFactory } from '../github/GitHubClientFactory';

export interface CommandContext {
  type: 'slash' | 'prefix';
  user: User;
  channel: TextChannel | ForumChannel;
  guild: Guild;
  message?: Message;
  interaction?: ChatInputCommandInteraction;
}

export interface CommandArgs {
  owner?: string;
  repo?: string;
  deleteChannel?: boolean;
}

export interface CommandResult {
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
  error?: Error;
}

export interface CommandServices {
  multiStore: MultiStore;
  mappingManager: DynamicMappingManager;
  githubFactory: GitHubClientFactory;
  discordClient: Client;
}

export enum CommandErrorType {
  INVALID_ARGS = 'INVALID_ARGS',
  REPO_NOT_FOUND = 'REPO_NOT_FOUND',
  ALREADY_WATCHING = 'ALREADY_WATCHING',
  NOT_WATCHING = 'NOT_WATCHING',
  CHANNEL_CREATE_FAILED = 'CHANNEL_CREATE_FAILED',
  CONFIG_UPDATE_FAILED = 'CONFIG_UPDATE_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  NO_CATEGORY = 'NO_CATEGORY',
  UNKNOWN = 'UNKNOWN'
}

export class CommandError extends Error {
  constructor(
    public type: CommandErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CommandError';
  }
  
  toUserMessage(): string {
    const messages: Record<CommandErrorType, string> = {
      INVALID_ARGS: '❌ コマンドの形式が正しくありません',
      REPO_NOT_FOUND: '❌ 指定されたリポジトリが見つかりません',
      ALREADY_WATCHING: '⚠️ このリポジトリは既に監視中です',
      NOT_WATCHING: '⚠️ このリポジトリは監視されていません',
      CHANNEL_CREATE_FAILED: '❌ チャンネルの作成に失敗しました',
      CONFIG_UPDATE_FAILED: '❌ 設定の保存に失敗しました',
      RATE_LIMITED: '⏳ API制限に達しました。しばらく待ってから再試行してください',
      NO_CATEGORY: '❌ フォーラムカテゴリが設定されていません',
      UNKNOWN: '❌ 予期しないエラーが発生しました'
    };
    return messages[this.type] || messages.UNKNOWN;
  }
}

export interface MappingResult {
  mapping: RepositoryMapping;
  channelId: string;
  syncResult?: SyncResult;
}

export interface SyncResult {
  total: number;
  synced: number;
  errors: number;
  skipped: number;
}

export interface RepositoryMapping {
  id: string;
  channel_id: string;
  repository: {
    owner: string;
    name: string;
  };
  enabled: boolean;
  created_at?: string;
  created_by?: string;
  auto_synced?: boolean;
  tags?: {
    [labelName: string]: string;
  };
}