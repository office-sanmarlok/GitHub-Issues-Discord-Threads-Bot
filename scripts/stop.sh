#!/bin/bash

# GitHub Issues Discord Bot - Stop Script

echo "🛑 Stopping GitHub Issues Discord Bot..."

# Check if PM2 is running the bot
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "discord-bot"; then
        echo "✅ Stopping PM2 instance..."
        pm2 stop discord-bot
        pm2 delete discord-bot
        echo "✅ Bot stopped successfully!"
        exit 0
    fi
fi

# Check for PID file
if [ -f "bot.pid" ]; then
    PID=$(cat bot.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Stopping process PID: $PID"
        kill $PID
        rm bot.pid
        echo "✅ Bot stopped successfully!"
        exit 0
    else
        echo "⚠️  Process not found. Cleaning up PID file..."
        rm bot.pid
    fi
fi

# Check for process using port 5000
PID=$(lsof -Pi :5000 -sTCP:LISTEN -t 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "✅ Found bot process using port 5000: $PID"
    kill $PID
    # Update PID file if exists
    if [ -f "bot.pid" ]; then
        rm bot.pid
    fi
    echo "✅ Bot stopped successfully!"
    exit 0
fi

# Check for running node dist/index.js process
PID=$(pgrep -f "node dist/index.js")
if [ ! -z "$PID" ]; then
    echo "✅ Found running bot process: $PID"
    kill $PID
    if [ -f "bot.pid" ]; then
        rm bot.pid
    fi
    echo "✅ Bot stopped successfully!"
    exit 0
fi

echo "ℹ️  No running bot instance found."