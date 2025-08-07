#!/bin/bash

# GitHub Issues Discord Bot - Restart Script

echo "🔄 Restarting GitHub Issues Discord Bot..."

# Stop the bot
./scripts/stop.sh

# Wait a moment
echo "⏳ Waiting 2 seconds..."
sleep 2

# Start the bot
./scripts/start.sh