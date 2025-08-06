# クイックスタートガイド

## 最速セットアップ手順

### 1. Discord Bot作成
```
1. https://discord.com/developers/applications で新規アプリ作成
2. Bot → Reset Token でトークン取得
3. Intents: PRESENCE INTENT, MESSAGE CONTENT INTENT を有効化
4. OAuth2 → URL Generator → bot選択 → 権限: Manage Webhooks, Send Messages, Read Message History
5. 生成されたURLでBotをサーバーに招待
```

### 2. GitHub Token作成
```
1. https://github.com/settings/personal-access-tokens/new
2. Repository access: 対象リポジトリ選択
3. Permissions: Issues → Read & Write
4. Generate token
```

### 3. EC2設定
```bash
# セキュリティグループでポート5000を開放（インバウンド）

# プロジェクトクローン
git clone https://github.com/sanmarlok/GitHub-Issues-Discord-Threads-Bot.git
cd GitHub-Issues-Discord-Threads-Bot

# 環境変数設定
cat > .env << EOF
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
DISCORD_CHANNEL_ID=YOUR_FORUM_CHANNEL_ID
GITHUB_ACCESS_TOKEN=YOUR_GITHUB_TOKEN
GITHUB_USERNAME=YOUR_GITHUB_USERNAME
GITHUB_REPOSITORY=YOUR_REPO_NAME
EOF

# インストール & 起動
npm install
nohup npm run dev > bot.log 2>&1 &
```

### 4. GitHub Webhook設定
```
リポジトリ → Settings → Webhooks → Add webhook
- Payload URL: http://YOUR_EC2_IP:5000/
- Content type: application/json
- SSL verification: Disable
- Events: Issues, Issue comments
```

### 5. 動作確認
```bash
# ログ確認
tail -f bot.log

# 再起動が必要な場合
pkill -f "tsx watch src/index.ts" && sleep 2 && nohup npm run dev > bot.log 2>&1 &
```

## よくある問題

### Discord権限エラー
→ Botを再招待（権限にManage Webhooks必須）

### GitHub同期しない
→ EC2セキュリティグループでポート5000が開いているか確認

### ログの見方
```
discord->github: Discordからの操作がGitHubに反映
github->discord: GitHubからの操作がDiscordに反映
```