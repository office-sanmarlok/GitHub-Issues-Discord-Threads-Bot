#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
function migrateConfig() {
    console.log('🔄 Starting configuration migration...\n');
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ No .env file found. Please ensure you have a .env file to migrate from.');
        process.exit(1);
    }
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    console.log('✅ Loaded .env file');
    const config = {
        discord_token: envConfig.DISCORD_TOKEN || '',
        github_access_token: envConfig.GITHUB_ACCESS_TOKEN || '',
        webhook_port: parseInt(envConfig.WEBHOOK_PORT || '5000'),
        webhook_path: envConfig.WEBHOOK_PATH || '/webhook',
        log_level: envConfig.LOG_LEVEL || 'info',
        health_check_interval: 60000,
        mappings: []
    };
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
    }
    else {
        console.warn('⚠️  Missing required environment variables for default mapping');
        console.log('   Required: DISCORD_CHANNEL_ID, GITHUB_USERNAME, GITHUB_REPOSITORY');
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
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
        console.log('\n⚠️  config.json already exists!');
        console.log('   Creating config.json.migrated instead...');
        const migratePath = path.join(process.cwd(), 'config.json.migrated');
        fs.writeFileSync(migratePath, JSON.stringify(config, null, 2));
        console.log(`✅ Migration complete! Created ${migratePath}`);
        console.log('\n📝 Please review the migrated configuration and manually merge with your existing config.json');
    }
    else {
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
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignore.includes('config.json')) {
            console.log('\n⚠️  Warning: config.json is not in .gitignore');
            console.log('   Consider adding it to prevent committing sensitive data.');
        }
    }
}
try {
    migrateConfig();
}
catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}
