/**
 * Main configuration file for GRLKRASHai
 * 
 * Centralizes application configuration and environment variable loading
 */
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * Application configuration
 */
export const config = {
  twitter: {
    appKey: process.env.TWITTER_APP_KEY!,
    appSecret: process.env.TWITTER_APP_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    bearerToken: process.env.TWITTER_BEARER_TOKEN!,
    grlkrashaiUserId: process.env.TWITTER_GRLKRASHAI_USER_ID
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN!
  }
}

// Validate required Twitter configuration
const requiredTwitterConfig = [
  { key: 'appKey', value: config.twitter.appKey },
  { key: 'appSecret', value: config.twitter.appSecret },
  { key: 'accessToken', value: config.twitter.accessToken },
  { key: 'accessSecret', value: config.twitter.accessSecret },
  { key: 'bearerToken', value: config.twitter.bearerToken }
]

// Validate required Discord configuration
const requiredDiscordConfig = [
  { key: 'botToken', value: config.discord.botToken }
]

// Combine all configuration validations
const missingTwitterConfig = requiredTwitterConfig.filter(item => !item.value)
const missingDiscordConfig = requiredDiscordConfig.filter(item => !item.value)

// Check for missing Twitter configuration
if (missingTwitterConfig.length > 0) {
  console.error('ERROR: Missing required Twitter configuration:')
  missingTwitterConfig.forEach(item => {
    console.error(`- Missing TWITTER_${item.key.toUpperCase()} environment variable`)
  })
  process.exit(1)
}

// Check for missing Discord configuration
if (missingDiscordConfig.length > 0) {
  console.error('ERROR: Missing required Discord configuration:')
  missingDiscordConfig.forEach(item => {
    console.error(`- Missing DISCORD_${item.key.toUpperCase()} environment variable`)
  })
  process.exit(1)
}

export default config 