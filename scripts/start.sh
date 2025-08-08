#!/bin/bash

# GitHub Issues Discord Bot - Start Script

echo "🚀 Starting GitHub Issues Discord Bot..."

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo "❌ Error: config.json not found!"
    echo "Please create config.json from config.json.example"
    exit 1
fi

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo "✅ Using PM2 to start the bot..."
    
    # Stop existing instance if running
    pm2 stop discord-bot 2>/dev/null
    pm2 delete discord-bot 2>/dev/null
    
    # Start new instance
    pm2 start npm --name "discord-bot" -- start
    pm2 save
    
    echo "✅ Bot started successfully!"
    echo "📋 Commands:"
    echo "  View logs:    pm2 logs discord-bot"
    echo "  Stop bot:     pm2 stop discord-bot"
    echo "  Restart bot:  pm2 restart discord-bot"
    echo "  Monitor:      pm2 monit"
else
    echo "⚠️  PM2 not found. Using nohup instead..."
    echo "💡 Install PM2 for better process management: npm install -g pm2"
    
    # Check if already running
    if pgrep -f "EnhancedIndex" > /dev/null; then
        echo "⚠️  Bot is already running. Stop it first with: ./scripts/stop.sh"
        exit 1
    fi
    
    # Build first
    echo "🔨 Building TypeScript..."
    npm run build
    
    # Start with nohup
    nohup npm start > bot.log 2>&1 &
    echo $! > bot.pid
    
    echo "✅ Bot started with PID: $(cat bot.pid)"
    echo "📋 Commands:"
    echo "  View logs:    tail -f bot.log"
    echo "  Stop bot:     ./scripts/stop.sh"
fi

echo "🌐 Health check: http://localhost:5000/health"