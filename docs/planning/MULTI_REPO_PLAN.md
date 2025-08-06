# 複数リポジトリ対応 実装計画

## 概要
現在の単一リポジトリ・単一チャンネル制限を解除し、1つのBotインスタンスで複数のGitHubリポジトリと複数のDiscordチャンネルを管理できるようにする。

## 現状の制限事項
- 1つのBotインスタンス = 1つのDiscordチャンネル + 1つのGitHubリポジトリ
- 環境変数による固定設定
- グローバルな単一storeによるデータ管理
- Webhook URLとリポジトリが1対1対応

## 提案アーキテクチャ

### 設計方針
- **マルチテナント設計**: チャンネル/リポジトリごとに独立したデータストア
- **設定ファイルベース**: JSONファイルで複数マッピングを管理
- **単一Webhookエンドポイント**: ペイロード内容でリポジトリを識別

### システム構成

```
Discord Server
├── Channel A ←→ GitHub Repo A
├── Channel B ←→ GitHub Repo B
└── Channel C ←→ GitHub Repo C
     ↑
    Bot
     ↑
  Webhook
(Single Endpoint)
```

## 実装詳細

### 1. 設定ファイル構造

#### config.json
```json
{
  "discord_token": "YOUR_DISCORD_BOT_TOKEN",
  "github_access_token": "YOUR_GITHUB_TOKEN",
  "webhook_port": 5000,
  "mappings": [
    {
      "id": "mapping_1",
      "channel_id": "1234567890123456789",
      "repository": {
        "owner": "your-username",
        "name": "project-a"
      },
      "webhook_secret": "optional_secret_a",
      "enabled": true
    },
    {
      "id": "mapping_2",
      "channel_id": "9876543210987654321",
      "repository": {
        "owner": "your-username",
        "name": "project-b"
      },
      "webhook_secret": "optional_secret_b",
      "enabled": true
    }
  ]
}
```

### 2. データストア改修

#### 現在の構造
```typescript
class Store {
  threads: Thread[] = [];
  availableTags: GuildForumTag[] = [];
}
```

#### 改修後の構造
```typescript
interface RepositoryMapping {
  id: string;
  channelId: string;
  repository: {
    owner: string;
    name: string;
  };
  webhookSecret?: string;
}

class MultiStore {
  private stores: Map<string, Store> = new Map();
  private mappings: RepositoryMapping[] = [];
  
  // チャンネルIDからストアを取得
  getStoreByChannel(channelId: string): Store | undefined {
    return this.stores.get(channelId);
  }
  
  // リポジトリ情報からストアを取得
  getStoreByRepo(owner: string, repo: string): Store | undefined {
    const mapping = this.mappings.find(
      m => m.repository.owner === owner && m.repository.name === repo
    );
    return mapping ? this.stores.get(mapping.channelId) : undefined;
  }
  
  // マッピング情報を取得
  getMappingByChannel(channelId: string): RepositoryMapping | undefined
  getMappingByRepo(owner: string, repo: string): RepositoryMapping | undefined
}
```

### 3. Webhook処理の改修

#### github.ts
```typescript
app.post("/webhook", async (req, res) => {
  // リポジトリ情報から適切なマッピングを特定
  const { repository, action } = req.body;
  const repoOwner = repository.owner.login;
  const repoName = repository.name;
  
  const mapping = multiStore.getMappingByRepo(repoOwner, repoName);
  
  if (!mapping) {
    logger.warn(`No mapping found for ${repoOwner}/${repoName}`);
    return res.status(404).json({ error: "Repository not configured" });
  }
  
  // Webhook Secretの検証（オプション）
  if (mapping.webhookSecret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!verifyWebhookSignature(req.body, signature, mapping.webhookSecret)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }
  
  // 適切なstoreとconfigを使用して処理
  const store = multiStore.getStoreByChannel(mapping.channelId);
  const context = {
    store,
    mapping,
    repoCredentials: {
      owner: mapping.repository.owner,
      repo: mapping.repository.name
    }
  };
  
  githubActions[action]?.(req, context);
  res.json({ msg: "ok" });
});
```

### 4. Discord処理の改修

#### discordHandlers.ts
```typescript
export async function handleThreadCreate(params: AnyThreadChannel) {
  // どのチャンネルのイベントか判定
  const mapping = multiStore.getMappingByChannel(params.parentId);
  if (!mapping) return; // 管理対象外のチャンネル
  
  const store = multiStore.getStoreByChannel(params.parentId);
  if (!store) return;
  
  const { id, name, appliedTags } = params;
  
  store.threads.push({
    id,
    appliedTags,
    title: name,
    archived: false,
    locked: false,
    comments: [],
  });
}
```

### 5. GitHub Actions改修

#### githubActions.ts
```typescript
// 動的なrepoCredentials生成
export async function createIssue(
  thread: Thread, 
  params: Message,
  context: ActionContext
) {
  const { mapping } = context;
  const repoCredentials = {
    owner: mapping.repository.owner,
    repo: mapping.repository.name
  };
  
  // 既存のロジックを使用
  const response = await octokit.rest.issues.create({
    ...repoCredentials,
    labels,
    title,
    body,
  });
  // ...
}
```

## 変更が必要なファイル一覧

| ファイル | 変更内容 | 優先度 |
|---------|---------|--------|
| src/config.ts | JSONファイル読み込み、マッピング管理 | 高 |
| src/store.ts | MultiStore実装 | 高 |
| src/github/github.ts | リポジトリ識別、コンテキスト渡し | 高 |
| src/github/githubActions.ts | 動的repoCredentials | 高 |
| src/github/githubHandlers.ts | コンテキスト受け取り | 中 |
| src/discord/discordHandlers.ts | 複数チャンネル対応 | 高 |
| src/discord/discordActions.ts | マッピング認識 | 中 |
| src/logger.ts | チャンネル/リポジトリ情報付加 | 低 |
| src/interfaces.ts | 新しい型定義追加 | 高 |

## 移行計画

### Phase 1: 基盤整備（互換性維持）
1. MultiStore実装（既存Storeをラップ）
2. 設定ファイル読み込み機能追加（環境変数フォールバック）
3. インターフェース定義追加

### Phase 2: コア機能改修
1. Webhook処理のマルチテナント化
2. Discord処理のマルチテナント化
3. GitHub Actions関数のコンテキスト対応

### Phase 3: テストと最適化
1. 各マッピングの独立性確認
2. エラーハンドリングの改善
3. ログ出力の改善

### Phase 4: 運用機能追加（オプション）
1. Discord Slash Commandsでの動的設定
2. Web管理画面
3. データベース永続化

## 設定例

### 開発環境（1リポジトリ）
```json
{
  "discord_token": "${DISCORD_TOKEN}",
  "github_access_token": "${GITHUB_ACCESS_TOKEN}",
  "webhook_port": 5000,
  "mappings": [
    {
      "channel_id": "${DISCORD_CHANNEL_ID}",
      "repository": {
        "owner": "${GITHUB_USERNAME}",
        "name": "${GITHUB_REPOSITORY}"
      }
    }
  ]
}
```

### 本番環境（複数リポジトリ）
```json
{
  "discord_token": "PRODUCTION_TOKEN",
  "github_access_token": "PRODUCTION_GITHUB_TOKEN",
  "webhook_port": 5000,
  "mappings": [
    {
      "channel_id": "1111111111111111111",
      "repository": {
        "owner": "myorg",
        "name": "frontend"
      }
    },
    {
      "channel_id": "2222222222222222222",
      "repository": {
        "owner": "myorg",
        "name": "backend"
      }
    },
    {
      "channel_id": "3333333333333333333",
      "repository": {
        "owner": "myorg",
        "name": "mobile-app"
      }
    }
  ]
}
```

## 考慮事項

### パフォーマンス
- メモリ使用量: リポジトリ数に比例
- API レート制限: GitHub API 5000req/hour を考慮
- Discord Gateway: 並行処理に注意

### セキュリティ
- Webhook Secret検証の実装
- チャンネル間のデータ分離
- 権限チェックの強化

### エラーハンドリング
- 個別マッピングのエラー分離
- フェイルセーフ機構
- リトライロジック

### 監視・ロギング
- マッピングごとのメトリクス
- エラー率の監視
- 詳細なデバッグログ

## 今後の拡張可能性

1. **マルチサーバー対応**: 複数のDiscordサーバーに対応
2. **組織全体管理**: GitHub Organization全体のリポジトリを自動検出
3. **カスタムルール**: リポジトリごとの同期ルール設定
4. **双方向ラベル同期**: GitHub→Discordのラベル同期実装
5. **リッチUI**: Webベースの設定管理画面
6. **プラグインシステム**: カスタム処理の追加

## まとめ

この設計により、既存のコードベースを活かしながら、段階的に複数リポジトリ対応を実装できる。各フェーズは独立してテスト可能で、リスクを最小限に抑えながら機能拡張が可能。