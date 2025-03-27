import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define validation schema for platform tokens
const platformConfigSchema = z.object({
    telegram: z.object({
        botToken: z.string().min(1, 'Telegram bot token is required'),
    }),
    discord: z.object({
        botToken: z.string().min(1, 'Discord bot token is required'),
    }),
    facebook: z.object({
        appSecret: z.string().min(1, 'Facebook app secret is required'),
    }),
    instagram: z.object({
        appSecret: z.string().min(1, 'Instagram app secret is required'),
    }),
    tiktok: z.object({
        clientKey: z.string().min(1, 'TikTok client key is required'),
        clientSecret: z.string().min(1, 'TikTok client secret is required'),
    }),
});

// Create configuration object
const platformConfig = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
    },
    discord: {
        botToken: process.env.DISCORD_BOT_TOKEN,
    },
    facebook: {
        appSecret: process.env.FACEBOOK_APP_SECRET,
    },
    instagram: {
        appSecret: process.env.INSTAGRAM_APP_SECRET,
    },
    tiktok: {
        clientKey: process.env.TIKTOK_CLIENT_KEY,
        clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    },
};

// Validate configuration
try {
    platformConfigSchema.parse(platformConfig);
} catch (error) {
    console.error('Platform configuration validation failed:', error.errors);
    process.exit(1);
}

export default platformConfig;

// Helper function to validate all tokens are present
export function validatePlatformTokens(): void {
    const missingTokens: string[] = [];

    if (!platformConfig.telegram.botToken) missingTokens.push('TELEGRAM_BOT_TOKEN');
    if (!platformConfig.discord.botToken) missingTokens.push('DISCORD_BOT_TOKEN');
    if (!platformConfig.facebook.appSecret) missingTokens.push('FACEBOOK_APP_SECRET');
    if (!platformConfig.instagram.appSecret) missingTokens.push('INSTAGRAM_APP_SECRET');
    if (!platformConfig.tiktok.clientKey) missingTokens.push('TIKTOK_CLIENT_KEY');
    if (!platformConfig.tiktok.clientSecret) missingTokens.push('TIKTOK_CLIENT_SECRET');

    if (missingTokens.length > 0) {
        console.error('Missing required platform tokens:', missingTokens.join(', '));
        process.exit(1);
    }
}

// Helper function to mask tokens for logging
export function getMaskedTokens(): { [key: string]: string } {
    return {
        telegramBotToken: maskToken(platformConfig.telegram.botToken),
        discordBotToken: maskToken(platformConfig.discord.botToken),
        facebookAppSecret: maskToken(platformConfig.facebook.appSecret),
        instagramAppSecret: maskToken(platformConfig.instagram.appSecret),
        tiktokClientKey: maskToken(platformConfig.tiktok.clientKey),
        tiktokClientSecret: maskToken(platformConfig.tiktok.clientSecret),
    };
}

function maskToken(token: string | undefined): string {
    if (!token) return 'NOT_SET';
    if (token.length <= 8) return '********';
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
} 