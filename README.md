# GitHub Issues Discord Threads Bot

Discord フォーラムチャンネルと GitHub リポジトリの Issue を双方向同期する強力なボット。この拡張版では、単一のボットインスタンスで**複数のリポジトリ・チャンネルマッピング**をサポートし、チームが異なる Discord チャンネルで複数の GitHub リポジトリの Issue を管理できます。

## 🌟 主な機能

### マルチリポジトリサポート（新機能！）
- **複数マッピング**: 10個以上のリポジトリ・チャンネルペアを同時管理
- **完全な分離**: 各マッピングは独自のデータストアで独立動作
- **JSON設定**: 管理しやすい設定ファイル
- **ヘルスモニタリング**: マッピングごとのヘルスチェックとメトリクス内蔵
- **エラー分離**: 1つのマッピングの障害が他に影響しない
- **Webhookセキュリティ**: リポジトリごとのHMAC署名検証（オプション）

### コア同期機能

#### Issues
- ✅ Discord スレッド作成 → GitHub Issue 作成
- ✅ GitHub Issue 作成 → Discord スレッド作成
- ✅ 双方向の状態同期

#### コメント
- ✅ Discord メッセージ → GitHub Issue コメント
- ✅ GitHub コメント → Discord メッセージ
- ✅ Webhook によるユーザー属性付与

#### スレッド/Issue 管理
- ✅ オープン/クローズ状態の同期
- ✅ ロック/アンロック状態の同期
- ✅ スレッドアーカイブ ↔ Issue クローズ
- ✅ スレッド削除 → Issue 削除

#### タグ & ラベル
- ✅ Discord フォーラムタグ → GitHub Issue ラベル
- ✅ 変更時のラベル同期
- ✅ リポジトリごとのカスタムタグマッピング

#### 添付ファイル
- ✅ 画像サポート（png、jpeg）
- ✅ Markdown フォーマットの保持

## 🚀 クイックスタート

### 前提条件
- Node.js v18 以降
- 適切な権限を持つ Discord Bot
- GitHub Personal Access Token
- 公開 IP を持つサーバー（Webhook 用）

### インストール

1. **リポジトリをクローン**
```bash
git clone https://github.com/office-sanmarlok/GitHub-Issues-Discord-Threads-Bot.git
cd GitHub-Issues-Discord-Threads-Bot
npm install
```

2. **設定**（`config.json`）
```json
{
  "discord_token": "YOUR_DISCORD_BOT_TOKEN",
  "github_access_token": "YOUR_GITHUB_TOKEN",
  "webhook_port": 5000,
  "webhook_path": "/webhook",
  "mappings": [
    {
      "id": "project-frontend",
      "channel_id": "DISCORD_CHANNEL_ID",
      "repository": {
        "owner": "github-username",
        "name": "repository-name"
      },
      "webhook_secret": "optional_secret",
      "enabled": true
    }
  ]
}
```

3. **ボットを実行**
```bash
# 開発環境
npm run dev

# 本番環境
npm run build
npm start
```

4. **GitHub Webhook を設定**

各リポジトリで：
- Settings → Webhooks → Add webhook
- URL: `https://your-server:5000/webhook`
- Content type: `application/json`
- Secret: （オプション、設定から使用）
- Events: Issues、Issue comments

## 📁 ドキュメント

- **セットアップガイド**
  - [クイックスタートガイド](docs/guides/QUICKSTART.md)
  - [EC2 セットアップガイド](docs/guides/SETUP_GUIDE_EC2.md)
  - [設定リファレンス](docs/guides/CONFIG.md)
  
- **開発**
  - [要件定義](docs/requirements.md)
  - [設計ドキュメント](docs/design.md)
  - [実装タスク](docs/tasks.md)

## 🏗️ アーキテクチャ

### マルチリポジトリアーキテクチャ
```
Discord チャンネル 1 ←→ Bot (Store 1) ←→ GitHub リポジトリ A
Discord チャンネル 2 ←→ Bot (Store 2) ←→ GitHub リポジトリ B
Discord チャンネル 3 ←→ Bot (Store 3) ←→ GitHub リポジトリ C
```

### 主要コンポーネント
- **ConfigManager**: JSON 設定管理
- **MultiStore**: マッピングごとの分離データストア
- **ContextProvider**: マッピングコンテキストルーティング
- **WebhookRouter**: リポジトリ識別とルーティング
- **GitHubClientFactory**: マッピングごとの API クライアント
- **HealthMonitor**: システムとマッピングのヘルストラッキング
- **IsolatedErrorHandler**: リトライロジック付きエラー分離

## 🔧 設定（config.json）

### 基本設定
| フィールド | 説明 | 必須 | デフォルト |
|-----------|------|------|-----------|
| `discord_token` | Discord Bot トークン | ✅ | - |
| `github_access_token` | GitHub アクセストークン | ✅ | - |
| `webhook_port` | Webhook サーバーポート | ❌ | 5000 |
| `webhook_path` | Webhook エンドポイントパス | ❌ | "/webhook" |
| `log_level` | ログレベル（debug/info/warn/error） | ❌ | "info" |
| `health_check_interval` | ヘルスチェック間隔（ミリ秒） | ❌ | 60000 |
| `mappings` | リポジトリ・チャンネルマッピング配列 | ✅ | - |

### マッピング設定
| フィールド | 説明 | 必須 | デフォルト |
|-----------|------|------|-----------|
| `id` | マッピング識別子 | ✅ | - |
| `channel_id` | Discord フォーラムチャンネル ID | ✅ | - |
| `repository.owner` | GitHub リポジトリ所有者 | ✅ | - |
| `repository.name` | GitHub リポジトリ名 | ✅ | - |
| `webhook_secret` | Webhook 署名検証用（推奨） | ❌ | null |
| `enabled` | マッピングの有効/無効 | ❌ | true |
| `options.sync_labels` | ラベル同期の有効化 | ❌ | true |
| `options.sync_assignees` | 担当者同期の有効化 | ❌ | false |

📖 **詳細な設定ガイド**: [CONFIG.md](docs/guides/CONFIG.md)

## 📊 モニタリング

### ヘルスエンドポイント
```bash
GET /health          # システムヘルス
GET /health/{id}     # マッピングヘルス
GET /metrics         # 詳細メトリクス
```

### ヘルス状態
- **🟢 Healthy**: 正常動作中
- **🟡 Degraded**: 一部問題があるが動作中
- **🔴 Unhealthy**: 重大な問題で要対応

## 🧪 テスト

```bash
npm test              # テスト実行
npm run test:watch    # ウォッチモード
npm run test:coverage # カバレッジレポート
```

## 🛠️ サーバー管理

便利な管理スクリプト：

```bash
./scripts/start.sh    # ボット起動
./scripts/stop.sh     # ボット停止
./scripts/restart.sh  # ボット再起動
./scripts/status.sh   # 状態確認
```

## 🤝 コントリビューション

コントリビューションを歓迎します！以下を確認してください：
- すべてのテストがパス
- 既存のパターンに従うコード
- ドキュメントの更新
- エラーハンドリングが分離を維持

## 📝 ライセンス

MIT

## 🙏 謝辞

オリジナルのシングルリポジトリ版作者: Nicat

---

詳細なセットアップ手順は [クイックスタートガイド](docs/guides/QUICKSTART.md) または [EC2 セットアップガイド](docs/guides/SETUP_GUIDE_EC2.md) を参照してください。