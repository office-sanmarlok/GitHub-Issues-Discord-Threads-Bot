#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BotConfig } from '../src/types/configTypes';

/**
 * Migration script to convert from .env configuration to config.json
 */
function migrateConfig(): void {
  console.log('🔄 Starting configuration migration...\n');

  // Load environment variables
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ No .env file found. Please ensure you have a .env file to migrate from.');
    process.exit(1);
  }

  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  console.log('✅ Loaded .env file');

  // Create new config structure
  const config: BotConfig = {
    discord_token: envConfig.DISCORD_TOKEN || '',
    github_access_token: envConfig.GITHUB_ACCESS_TOKEN || '',
    webhook_port: parseInt(envConfig.WEBHOOK_PORT || '5000'),
    webhook_path: envConfig.WEBHOOK_PATH || '/webhook',
    log_level: envConfig.LOG_LEVEL || 'info',
    health_check_interval: 60000,
    mappings: []
  };

  // Create default mapping from environment variables
  if (envConfig.DISCORD_CHANNEL_ID && envConfig.GITHUB_USERNAME && envConfig.GITHUB_REPOSITORY) {
    config.mappings.push({
      id: 'default-mapping',
      channel_id: envConfig.DISCORD_CHANNEL_ID,
      repository: {
        owner: envConfig.GITHUB_USERNAME,
        name: envConfig.GITHUB_REPOSITORY
      },
      webhook_secret: envConfig.WEBHOOK_SECRET,
      enabled: true,
      options: {
        sync_labels: true,
        sync_assignees: false
      }
    });

    console.log('✅ Created default mapping from environment variables');
  } else {
    console.warn('⚠️  Missing required environment variables for default mapping');
    console.log('   Required: DISCORD_CHANNEL_ID, GITHUB_USERNAME, GITHUB_REPOSITORY');
    
    // Create example mapping
    config.mappings.push({
      id: 'example-mapping',
      channel_id: 'YOUR_DISCORD_CHANNEL_ID',
      repository: {
        owner: 'YOUR_GITHUB_USERNAME',
        name: 'YOUR_REPOSITORY_NAME'
      },
      webhook_secret: 'optional_webhook_secret',
      enabled: false,
      options: {
        sync_labels: true,
        sync_assignees: false
      }
    });
  }

  // Check if config.json already exists
  const configPath = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    console.log('\n⚠️  config.json already exists!');
    console.log('   Creating config.json.migrated instead...');
    
    const migratePath = path.join(process.cwd(), 'config.json.migrated');
    fs.writeFileSync(migratePath, JSON.stringify(config, null, 2));
    console.log(`✅ Migration complete! Created ${migratePath}`);
    console.log('\n📝 Please review the migrated configuration and manually merge with your existing config.json');
  } else {
    // Write config.json
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ Migration complete! Created ${configPath}`);
  }

  console.log('\n📋 Next steps:');
  console.log('1. Review the generated config.json file');
  console.log('2. Add additional repository-channel mappings as needed');
  console.log('3. Update webhook secrets for security');
  console.log('4. Test the configuration with: npm run start:enhanced');
  console.log('\n⚠️  Important: Do not commit config.json to version control!');
  console.log('   Add it to .gitignore if not already present.');

  // Check .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('config.json')) {
      console.log('\n⚠️  Warning: config.json is not in .gitignore');
      console.log('   Consider adding it to prevent committing sensitive data.');
    }
  }
}

// Run migration
try {
  migrateConfig();
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}