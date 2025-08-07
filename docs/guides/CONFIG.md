# config.json 設定ガイド

このガイドでは、config.jsonの各設定項目を**実際に書く順番**で説明します。

## 基本的な構造

```json
{
  "discord_token": "ここにDiscord Botのトークン",
  "github_access_token": "ここにGitHubのトークン",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    // ここにリポジトリとチャンネルの対応を書く
  ]
}
```

## 設定項目の詳細（上から順に）

### 1. discord_token（必須）

Discord Botのトークンです。

```json
"discord_token": "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GqWerty.1234567890abcdefghijklmnop"
```

**取得方法:**
1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. アプリケーション作成 → Bot → Reset Token
3. トークンをコピー

### 2. github_access_token（必須）

GitHubのPersonal Access Tokenです。

```json
"github_access_token": "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
```

**取得方法:**
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic) → Generate new token
3. 権限: `repo`（プライベートリポジトリ）または `public_repo`（パブリックのみ）

### 3. webhook_port（省略可）

Webhookを受け取るポート番号です。

```json
"webhook_port": 5000  // デフォルト: 5000
```

- 省略すると5000番ポートを使用
- AWSやファイアウォールでこのポートを開放する必要あり
- 他のサービスと被る場合は変更

### 4. webhook_path（省略可）

WebhookのURLパスです。

```json
"webhook_path": "/webhook"  // デフォルト: "/webhook"
```

- 省略すると`/webhook`を使用
- 完全なURL: `https://あなたのサーバー:5000/webhook`
- セキュリティのため変更可能（例: `/github-hook-2024`）

### 5. log_level（省略可）

ログの詳細度です。

```json
"log_level": "info"  // デフォルト: "info"
```

**選択肢:**
- `"debug"` - すべての詳細情報（開発・デバッグ時）
- `"info"` - 通常の動作情報（デフォルト）
- `"warn"` - 警告のみ
- `"error"` - エラーのみ

### 6. health_check_interval（省略可）

システムの健康状態をチェックする間隔（ミリ秒）です。

```json
"health_check_interval": 60000  // デフォルト: 60000（1分）
```

- 60000 = 1分ごとにチェック
- 各マッピングのエラー率や接続状態を監視
- `/health`エンドポイントで確認可能

### 7. mappings（必須）

リポジトリとDiscordチャンネルの対応リストです。**配列なので`[]`で囲む**。

```json
"mappings": [
  {
    // 1つ目のマッピング
  },
  {
    // 2つ目のマッピング
  }
]
```

## mappings内の各項目（上から順に）

各マッピングは以下の構造です：

```json
{
  "id": "project1",
  "channel_id": "1234567890123456789",
  "repository": {
    "owner": "your-username",
    "name": "your-repo"
  },
  "webhook_secret": "your-secret-key",
  "enabled": true,
  "options": {
    "sync_labels": true,
    "sync_assignees": false
  }
}
```

### 7.1. id（必須）

このマッピングの識別名です。

```json
"id": "frontend"  // 英数字とハイフンのみ推奨
```

- 一意である必要がある
- ログやヘルスチェックで使用
- 例: `"frontend"`, `"backend-api"`, `"docs"`

### 7.2. channel_id（必須）

Discord フォーラムチャンネルのIDです。

```json
"channel_id": "1234567890123456789"  // 18桁の数字
```

**取得方法:**
1. Discord設定 → 詳細設定 → 開発者モード ON
2. フォーラムチャンネルを右クリック → IDをコピー

### 7.3. repository（必須）

GitHubリポジトリの情報です。

```json
"repository": {
  "owner": "octocat",      // ユーザー名または組織名
  "name": "hello-world"    // リポジトリ名
}
```

- URLが `https://github.com/octocat/hello-world` の場合
  - owner: `"octocat"`
  - name: `"hello-world"`

### 7.4. webhook_secret（省略可、推奨）

Webhook検証用の秘密鍵です。

```json
"webhook_secret": "my-secret-key-2024"
```

**重要:**
- 設定しない場合、誰でもWebhookを送信可能（セキュリティリスク）
- 設定する場合、GitHub側でも同じ値を設定する必要あり

**GitHub側の設定:**
1. リポジトリ → Settings → Webhooks
2. Add webhook または編集
3. Secret欄に同じ文字列を入力

### 7.5. enabled（省略可）

このマッピングを有効にするかどうかです。

```json
"enabled": true  // デフォルト: true
```

- `true` - このマッピングは動作する
- `false` - 設定は残るが無効（一時停止）

**使用例:**
- テスト中: `false`にして他のマッピングだけテスト
- トラブル時: 問題のあるマッピングだけ`false`に

### 7.6. options（省略可）

追加オプションです。

```json
"options": {
  "sync_labels": true,      // デフォルト: true
  "sync_assignees": false   // デフォルト: false
}
```

- `sync_labels` - GitHubラベルとDiscordタグを同期
- `sync_assignees` - 担当者情報を同期（未実装）

## 完全な設定例

### 最小構成（1つのリポジトリ）

```json
{
  "discord_token": "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GqWerty.xxx",
  "github_access_token": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
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

### 標準構成（複数リポジトリ、セキュリティあり）

```json
{
  "discord_token": "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GqWerty.xxx",
  "github_access_token": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    {
      "id": "frontend",
      "channel_id": "1111111111111111111",
      "repository": {
        "owner": "my-company",
        "name": "frontend-app"
      },
      "webhook_secret": "frontend_secret_2024",
      "enabled": true,
      "options": {
        "sync_labels": true
      }
    },
    {
      "id": "backend",
      "channel_id": "2222222222222222222",
      "repository": {
        "owner": "my-company",
        "name": "backend-api"
      },
      "webhook_secret": "backend_secret_2024",
      "enabled": true
    },
    {
      "id": "test-repo",
      "channel_id": "3333333333333333333",
      "repository": {
        "owner": "my-company",
        "name": "test-project"
      },
      "enabled": false  // 準備中なので無効
    }
  ]
}
```

## よくある質問

### Q: webhook_secretは必須？
A: いいえ、省略可能です。ただし本番環境では設定を強く推奨します。

### Q: enabledをfalseにすると？
A: その設定は残りますが、同期は行われません。設定を消さずに一時停止できます。

### Q: ポート5000が使えない
A: `webhook_port`を変更してください（例: 3000、8080など）。ファイアウォールの開放も忘れずに。

### Q: log_levelはどれがいい？
A: 通常は`"info"`、問題調査時は`"debug"`、本番は`"warn"`か`"error"`。

### Q: health_check_intervalは？
A: デフォルトの60000（1分）で通常は十分です。

## セキュリティ注意事項

⚠️ **重要**
- `config.json`を絶対にGitにコミットしない（.gitignore済み）
- トークンは定期的に更新する
- webhook_secretは推測困難な文字列にする
- 本番環境では環境変数の使用も検討

## トラブルシューティング

### Botが起動しない
```bash
# エラーログを確認
npm run dev:enhanced
# または
cat bot.log
```

### マッピングが動作しない
1. `enabled: true`か確認
2. channel_idが正しいか確認
3. `/health/マッピングID`で状態確認

### Webhookが来ない
1. ポートが開いているか確認
2. GitHub側のWebhook設定を確認
3. webhook_secretが一致しているか確認