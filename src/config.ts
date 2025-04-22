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

const missingConfig = requiredTwitterConfig.filter(item => !item.value)

if (missingConfig.length > 0) {
  console.error('ERROR: Missing required Twitter configuration:')
  missingConfig.forEach(item => {
    console.error(`- Missing TWITTER_${item.key.toUpperCase()} environment variable`)
  })
  process.exit(1)
}

export default config 