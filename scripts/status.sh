#!/bin/bash

# GitHub Issues Discord Bot - Status Script

echo "📊 GitHub Issues Discord Bot Status"
echo "===================================="

# Check PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "discord-bot"; then
        echo "✅ Bot is running via PM2"
        pm2 show discord-bot
        echo ""
        echo "Recent logs:"
        pm2 logs discord-bot --lines 5 --nostream
        RUNNING=true
    fi
fi

# Check PID file
if [ -f "bot.pid" ] && [ -z "$RUNNING" ]; then
    PID=$(cat bot.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Bot is running with PID: $PID"
        echo "Memory usage:"
        ps aux | grep $PID | grep -v grep
        RUNNING=true
    fi
fi

# Check for process
if [ -z "$RUNNING" ]; then
    PID=$(pgrep -f "EnhancedIndex")
    if [ ! -z "$PID" ]; then
        echo "✅ Bot is running (PID: $PID)"
        echo "Memory usage:"
        ps aux | grep $PID | grep -v grep
        RUNNING=true
    fi
fi

if [ -z "$RUNNING" ]; then
    echo "❌ Bot is not running"
    echo ""
    echo "Start the bot with: ./scripts/start.sh"
    exit 1
fi

echo ""
echo "🔍 Health Check:"

# Try to fetch health status
if curl -s -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Health endpoint is responding"
    curl -s http://localhost:5000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5000/health
else
    echo "⚠️  Health endpoint not responding"
fi

echo ""
echo "📋 Management Commands:"
echo "  Stop:     ./scripts/stop.sh"
echo "  Restart:  ./scripts/restart.sh"
echo "  Logs:     tail -f bot.log (or pm2 logs discord-bot)"
echo "  Health:   curl http://localhost:5000/health"
echo "  Metrics:  curl http://localhost:5000/metrics"