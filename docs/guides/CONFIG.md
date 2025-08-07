# config.json 設定ガイド

## 設定ファイルの構造

```json
{
  "discord_token": "Discord Botのトークン",
  "github_access_token": "GitHubのアクセストークン",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    {
      "id": "一意の識別子",
      "channel_id": "DiscordチャンネルID",
      "repository": {
        "owner": "GitHubユーザー名または組織名",
        "name": "リポジトリ名"
      },
      "webhook_secret": "Webhook検証用シークレット（省略可）",
      "enabled": true,
      "options": {
        "sync_labels": true,
        "sync_assignees": false
      }
    }
  ]
}
```

## メイン設定

| フィールド | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|------------|------|
| `discord_token` | string | ✅ | - | Discord Botのトークン |
| `github_access_token` | string | ✅ | - | GitHub Personal Access Token |
| `webhook_port` | number | ❌ | 5000 | Webhookサーバーのポート番号 |
| `webhook_path` | string | ❌ | "/webhook" | Webhookエンドポイントのパス |
| `log_level` | string | ❌ | "info" | ログレベル（debug/info/warn/error） |
| `health_check_interval` | number | ❌ | 60000 | ヘルスチェック間隔（ミリ秒） |
| `mappings` | array | ✅ | - | リポジトリとチャンネルのマッピング配列 |

## マッピング設定

| フィールド | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|------------|------|
| `id` | string | ✅ | - | マッピングの一意識別子（英数字推奨） |
| `channel_id` | string | ✅ | - | Discord フォーラムチャンネルのID |
| `repository.owner` | string | ✅ | - | GitHubリポジトリの所有者 |
| `repository.name` | string | ✅ | - | GitHubリポジトリ名 |
| `webhook_secret` | string | ❌ | null | Webhook署名検証用シークレット |
| `enabled` | boolean | ❌ | true | このマッピングの有効/無効 |
| `options` | object | ❌ | {} | 追加オプション |

## webhook_secret について

### セキュリティレベル

#### 🔓 設定なし（開発環境向け）
```json
{
  "webhook_secret": null
}
```
- 署名検証をスキップ
- 誰でもWebhookエンドポイントにアクセス可能
- **本番環境では非推奨**

#### 🔒 設定あり（本番環境推奨）
```json
{
  "webhook_secret": "your-secret-string-here"
}
```
- GitHubがリクエストにHMAC-SHA256署名を付与
- Botが署名を検証してなりすましを防止
- **GitHub側でも同じシークレットを設定する必要あり**

### GitHub側での設定方法
1. リポジトリ → Settings → Webhooks
2. Add webhook または既存のWebhookを編集
3. **Secret**欄に`webhook_secret`と同じ文字列を入力

## enabled について

マッピングごとの有効/無効スイッチです。

### 使用例

```json
{
  "mappings": [
    {
      "id": "production",
      "enabled": true   // ✅ アクティブ
    },
    {
      "id": "staging",
      "enabled": false  // ⏸️ 一時停止中
    }
  ]
}
```

### 活用シーン
- **開発中**: 特定のマッピングだけテスト
- **トラブル時**: 問題のあるマッピングを一時無効化
- **段階的導入**: 1つずつマッピングを有効化
- **メンテナンス**: 設定を残したまま一時停止

## options について

マッピングごとの詳細な動作設定です。

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|------------|------|
| `sync_labels` | boolean | true | GitHubラベルとDiscordタグの同期 |
| `sync_assignees` | boolean | false | 担当者情報の同期 |

### 将来の拡張予定
- `sync_milestones`: マイルストーンの同期
- `sync_projects`: プロジェクトボードとの連携
- `auto_close_stale`: 古いIssueの自動クローズ
- `mention_users`: ユーザーメンションの変換

## 実際の設定例

### 最小構成（シングルリポジトリ）
```json
{
  "discord_token": "MTIzNDU2Nzg5...",
  "github_access_token": "ghp_xxxxxxxxxxxxx",
  "mappings": [
    {
      "id": "main",
      "channel_id": "1234567890123456789",
      "repository": {
        "owner": "myusername",
        "name": "my-project"
      }
    }
  ]
}
```

### 本番環境（マルチリポジトリ）
```json
{
  "discord_token": "MTIzNDU2Nzg5...",
  "github_access_token": "ghp_xxxxxxxxxxxxx",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    {
      "id": "frontend",
      "channel_id": "1111111111111111111",
      "repository": {
        "owner": "my-org",
        "name": "frontend-app"
      },
      "webhook_secret": "frontend_secret_key_2024",
      "enabled": true,
      "options": {
        "sync_labels": true,
        "sync_assignees": true
      }
    },
    {
      "id": "backend",
      "channel_id": "2222222222222222222",
      "repository": {
        "owner": "my-org",
        "name": "backend-api"
      },
      "webhook_secret": "backend_secret_key_2024",
      "enabled": true,
      "options": {
        "sync_labels": true,
        "sync_assignees": false
      }
    },
    {
      "id": "docs",
      "channel_id": "3333333333333333333",
      "repository": {
        "owner": "my-org",
        "name": "documentation"
      },
      "enabled": false  // 準備中
    }
  ]
}
```

## Discord チャンネルIDの取得方法

1. Discord開発者モードを有効化
   - 設定 → 詳細設定 → 開発者モード ON
2. フォーラムチャンネルを右クリック
3. 「IDをコピー」を選択

## GitHub アクセストークンの作成

1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token
4. 必要な権限:
   - `repo` (プライベートリポジトリの場合)
   - `public_repo` (パブリックリポジトリのみの場合)

## セキュリティに関する注意

⚠️ **重要**: `config.json`には機密情報が含まれます！

- `.gitignore`に`config.json`を追加済み
- 絶対にGitにコミットしない
- 本番環境では環境変数や秘密管理サービスの使用を検討
- `config.json.example`を参考用として提供

## トラブルシューティング

### マッピングが動作しない
- `enabled: true`になっているか確認
- チャンネルIDが正しいか確認
- Botがチャンネルにアクセス権限を持っているか確認

### Webhookが受信されない
- ポート番号が開放されているか確認
- `webhook_secret`がGitHub側と一致しているか確認
- `/health/{mapping-id}`でマッピングの状態を確認

### エラーが発生する
- `log_level: "debug"`にして詳細ログを確認
- `/metrics`エンドポイントでエラー率を確認
- 特定のマッピングだけ`enabled: false`にして切り分け