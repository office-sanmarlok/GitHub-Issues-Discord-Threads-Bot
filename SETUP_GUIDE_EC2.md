# GitHub Issues Discord Threads Bot - EC2セットアップガイド

このガイドでは、AWS EC2環境でGitHub Issues Discord Threads Botをセットアップする手順を説明します。

## 前提条件

- AWS EC2インスタンス（Ubuntu）
- Node.js環境（推奨: v18以上）
- 公開IPアドレス
- Discord Botアカウント
- GitHubアカウントとリポジトリ

## 1. Discord Botの作成と設定

### 1.1 Bot作成
1. [Discord Developer Portal](https://discord.com/developers/applications?new_application=true)でアプリケーションを作成
2. 左側メニューから「Bot」を選択
3. 「Reset Token」をクリックしてトークンを取得（後で使用）

### 1.2 Bot権限設定
Botページで以下のIntentsを有効化：
- ✅ PRESENCE INTENT
- ✅ MESSAGE CONTENT INTENT

### 1.3 招待URL生成
1. 左側メニューから「OAuth2」→「URL Generator」を選択
2. Scopesで「bot」を選択
3. Bot Permissionsで以下を選択：
   - Manage Webhooks（必須）
   - Send Messages
   - Read Message History

生成されたURL例：
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=536938496&integration_type=0&scope=bot
```

### 1.4 Discordサーバーの準備
1. Discordサーバーにフォーラムチャンネルを作成
2. チャンネルを右クリック→「IDをコピー」（開発者モードを有効にする必要あり）
3. Bot招待後、フォーラムチャンネルの権限設定でBotに以下を付与：
   - チャンネルを見る
   - メッセージを送信
   - Webhookを管理
   - メッセージ履歴を読む

## 2. GitHub設定

### 2.1 Personal Access Token作成
1. [GitHub Settings](https://github.com/settings/personal-access-tokens/new) → Developer settings → Personal access tokens → Fine-grained tokens
2. 「Generate new token」をクリック
3. Repository accessで「Only select repositories」を選択し、対象リポジトリを選択
4. Repository permissionsで「Issues」を「Read & Write」に設定
5. トークンを生成してコピー

## 3. EC2環境の準備

### 3.1 セキュリティグループ設定
AWSコンソールでEC2インスタンスのセキュリティグループを編集：

**インバウンドルール追加：**
- タイプ: カスタムTCP
- ポート範囲: 5000
- ソース: 0.0.0.0/0（GitHubのWebhookはIPが変動するため）
- 説明: GitHub webhook for Discord bot

### 3.2 プロジェクトのクローン
```bash
git clone https://github.com/your-repo/GitHub-Issues-Discord-Threads-Bot.git
cd GitHub-Issues-Discord-Threads-Bot
```

## 4. 環境変数の設定

`.env`ファイルを作成：
```bash
nano .env
```

以下の内容を設定：
```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
DISCORD_CHANNEL_ID=YOUR_FORUM_CHANNEL_ID

GITHUB_ACCESS_TOKEN=YOUR_GITHUB_TOKEN
GITHUB_USERNAME=YOUR_GITHUB_USERNAME
GITHUB_REPOSITORY=YOUR_REPO_NAME
```

## 5. インストールと起動

### 5.1 依存関係のインストール
```bash
npm install
```

### 5.2 開発モードで起動（テスト用）
```bash
npm run dev
```

### 5.3 バックグラウンドで起動
```bash
nohup npm run dev > bot.log 2>&1 &
```

### 5.4 ログの確認
```bash
tail -f bot.log
```

正常に起動すると以下のようなログが表示されます：
```
Server is running on port 5000
[info]: Logged in as YOUR_BOT_NAME!
[info]: Issues loaded : X
```

## 6. GitHub Webhook設定

### 6.1 Webhook追加
1. GitHubリポジトリ → Settings → Webhooks → Add webhook
2. 以下を設定：
   - **Payload URL**: `http://YOUR_EC2_PUBLIC_IP:5000/`
   - **Content type**: `application/json`
   - **SSL verification**: Disable（HTTPの場合）
   - **Which events?**: 以下を選択：
     - Issues
     - Issue comments

3. 「Add webhook」をクリック

### 6.2 動作確認
- GitHubでIssueを作成 → Discordにスレッドが作成される
- Discordでスレッドを作成 → GitHubにIssueが作成される
- 相互にコメントが同期される

## 7. プロセス管理

### Botの停止
```bash
pkill -f "tsx watch src/index.ts"
```

### Botの再起動
```bash
pkill -f "tsx watch src/index.ts"
sleep 2
nohup npm run dev > bot.log 2>&1 &
```

### プロセス確認
```bash
ps aux | grep -E "(npm|tsx)" | grep -v grep
```

## 8. トラブルシューティング

### Discord権限エラー
```
DiscordAPIError[50013]: Missing Permissions
```
→ Botの権限を確認し、必要に応じて再招待

### GitHub同期されない
- Webhook配信履歴を確認（GitHub → Settings → Webhooks → Recent Deliveries）
- EC2セキュリティグループでポート5000が開いているか確認
- bot.logでエラーを確認

### Issueが0件として読み込まれる
- GitHub Personal Access Tokenの権限を確認
- 対象リポジトリへのアクセス権を確認

## 9. 本番環境での推奨事項

### PM2でのプロセス管理
```bash
npm install -g pm2
pm2 start "npm run dev" --name github-discord-bot
pm2 save
pm2 startup
```

### HTTPS化（推奨）
1. Nginxをインストール
2. Let's Encryptで証明書取得
3. リバースプロキシ設定
4. GitHub WebhookのURLをHTTPSに変更

### ログローテーション
```bash
# logrotate設定
sudo nano /etc/logrotate.d/github-discord-bot
```

```
/home/ubuntu/sanmarlok-discord/GitHub-Issues-Discord-Threads-Bot/bot.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

## 参考リンク

- [Discord Developer Documentation](https://discord.com/developers/docs)
- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [Original Repository](https://github.com/sanmarlok/GitHub-Issues-Discord-Threads-Bot)