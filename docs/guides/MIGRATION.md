# 移行ガイド: シングルからマルチリポジトリサポートへ

このガイドは、シングルリポジトリ版から拡張マルチリポジトリ版の GitHub Issues Discord Threads Bot への移行を支援します。

## 概要

拡張版では重要なアーキテクチャ変更が導入されています：
- **設定**: 環境変数（`.env`） → JSON 設定（`config.json`）
- **データストレージ**: 単一ストア → 複数の分離ストア
- **イベントハンドリング**: 直接ハンドラー → コンテキストベースルーティング
- **エラーハンドリング**: グローバル → マッピングごとの分離

## 移行手順

### ステップ 1: 現在の設定をバックアップ

開始前に、既存の設定をバックアップしてください：

```bash
cp .env .env.backup
```

### ステップ 2: 依存関係をインストール

新しい依存関係を更新・インストール：

```bash
npm install
```

### ステップ 3: 移行スクリプトを実行

自動移行ツールを使用して `.env` ファイルを変換：

```bash
npm run migrate
```

これにより `.env` 設定に基づいた `config.json` ファイルが作成されます。

### ステップ 4: 生成された設定を確認

`config.json` を開いて移行された設定を確認：

```json
{
  "discord_token": "YOUR_DISCORD_TOKEN",
  "github_access_token": "YOUR_GITHUB_TOKEN",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "log_level": "info",
  "health_check_interval": 60000,
  "mappings": [
    {
      "id": "default-mapping",
      "channel_id": "YOUR_CHANNEL_ID",
      "repository": {
        "owner": "YOUR_GITHUB_USERNAME",
        "name": "YOUR_REPOSITORY"
      },
      "webhook_secret": "YOUR_WEBHOOK_SECRET",
      "enabled": true
    }
  ]
}
```

### ステップ 5: 追加マッピングを追加（オプション）

さらにリポジトリ・チャンネルマッピングを追加するには：

```json
"mappings": [
  {
    "id": "frontend-project",
    "channel_id": "1234567890123456789",
    "repository": {
      "owner": "your-org",
      "name": "frontend"
    },
    "webhook_secret": "secret_for_frontend",
    "enabled": true
  },
  {
    "id": "backend-project",
    "channel_id": "9876543210987654321",
    "repository": {
      "owner": "your-org",
      "name": "backend"
    },
    "webhook_secret": "secret_for_backend",
    "enabled": true
  }
]
```

### ステップ 6: GitHub Webhook を更新

Webhook エンドポイントは同じ（`/webhook`）ですが、複数のリポジトリをサポートするようになりました：

1. 各リポジトリの Settings → Webhooks へ移動
2. Webhook を更新または作成：
   - **URL**: `https://your-server:5000/webhook`
   - **Content type**: `application/json`
   - **Secret**: マッピングの `webhook_secret` を使用
   - **Events**: Issues、Issue comments

### ステップ 7: 移行をテスト

開発モードで実行してテスト：

```bash
npm run dev:enhanced
```

確認事項：
- Bot が Discord に接続する ✓
- 既存のスレッドが読み込まれる ✓
- 新しい Issue が正しく同期される ✓
- コメントが双方向で同期される ✓

### ステップ 8: 本番環境へデプロイ

テスト完了後：

```bash
# TypeScript コードをビルド
npm run build:tsc

# 本番環境で実行
npm run start:enhanced
```

## 設定マッピングリファレンス

| `.env` 変数 | `config.json` フィールド | 備考 |
|-------------|-------------------------|------|
| `DISCORD_TOKEN` | `discord_token` | 直接マッピング |
| `GITHUB_ACCESS_TOKEN` | `github_access_token` | 直接マッピング |
| `DISCORD_CHANNEL_ID` | `mappings[].channel_id` | マッピングごと |
| `GITHUB_USERNAME` | `mappings[].repository.owner` | マッピングごと |
| `GITHUB_REPOSITORY` | `mappings[].repository.name` | マッピングごと |
| `WEBHOOK_SECRET` | `mappings[].webhook_secret` | マッピングごと、オプション |
| `WEBHOOK_PORT` | `webhook_port` | 直接マッピング |
| `WEBHOOK_PATH` | `webhook_path` | 直接マッピング |
| `LOG_LEVEL` | `log_level` | 直接マッピング |

## 利用可能な新機能

移行後、以下を活用できます：

1. **複数リポジトリサポート**
   - 10個以上のリポジトリ・チャンネルマッピングを追加
   - 各マッピングは独立して動作

2. **ヘルスモニタリング**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5000/metrics
   ```

3. **マッピングごとの設定**
   - 個別の Webhook シークレット
   - 特定マッピングの有効/無効切り替え
   - マッピングごとのカスタム同期オプション

4. **改善されたエラーハンドリング**
   - マッピングごとの分離エラーハンドリング
   - サーキットブレーカー保護
   - 指数バックオフリトライロジック

## ロールバック手順

シングルリポジトリ版にロールバックする必要がある場合：

1. `.env` ファイルを復元：
   ```bash
   cp .env.backup .env
   ```

2. オリジナル版を実行：
   ```bash
   npm run dev  # または npm start
   ```

## トラブルシューティング

### 問題: Bot が起動しない
- `config.json` の構文を確認（有効な JSON）
- Discord トークンが正しいことを確認
- すべての必須フィールドが存在することを確認

### 問題: Webhook が受信されない
- Webhook シークレットが設定と一致することを確認
- Webhook URL がアクセス可能であることを確認
- `/health/{mapping-id}` でマッピング状態を確認

### 問題: 既存のスレッドが同期しない
- チャンネル ID が正しいことを確認
- Bot が Discord チャンネルの権限を持っていることを確認
- GitHub トークンが必要な権限を持っていることを確認

### 問題: メモリ使用量が高い
- アクティブなマッピング数を確認
- `/metrics` でヘルスメトリクスを確認
- 使用していないマッピングの無効化を検討

## ヘルプを得る

- 詳細なエラーメッセージのログを確認
- デバッグモードを使用: `"log_level": "debug"`
- ヘルス状態を確認: `/health`
- メトリクスを確認: `/metrics`

## ベストプラクティス

1. **1つのマッピングから開始**して動作を確認
2. **段階的にマッピングを追加**して問題を特定
3. セキュリティのため **Webhook シークレットを使用**
4. **ヘルスエンドポイントを定期的に監視**
5. シークレット保護のため **config.json を .gitignore に保持**
6. 変更前に **config.json をバックアップ**

## セキュリティに関する考慮事項

- `config.json` をバージョン管理にコミットしない
- 各リポジトリに異なる Webhook シークレットを使用
- GitHub アクセストークンを定期的にローテーション
- ログで失敗した Webhook 試行を監視
- 本番環境では Webhook エンドポイントに HTTPS を使用

---

追加のヘルプについては：
- [クイックスタートガイド](QUICKSTART.md)
- [EC2 セットアップガイド](SETUP_GUIDE_EC2.md)
- [メイン README](../../README.md)