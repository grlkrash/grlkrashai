import { TwitterApi } from 'twitter-api-v2';
import config from '../../config.js'; // Assuming config is at src/config.ts
import logger from '../../utils/logger.js'; // Assuming logger is at src/utils/logger.ts

logger.info('Initializing Twitter clients...');

// Client for User Actions (Posting) - OAuth 1.0a
// Requires App Key/Secret + Access Token/Secret for the GRLKRASHai account
const userClient = new TwitterApi({
    appKey: config.twitter.appKey,
    appSecret: config.twitter.appSecret,
    accessToken: config.twitter.accessToken,
    accessSecret: config.twitter.accessSecret,
});
// Export clients for different API versions/access levels under user context
export const twitterReadWriteClient = userClient.readWrite; // General R/W client
export const twitterV1Client = userClient.v1; // Specific v1 client (needed for media upload)
export const twitterV2Client = userClient.v2; // Specific v2 client (needed for tweet posting)
logger.info('Twitter User ReadWrite Clients (v1 & v2) Initialized.');

// Client for App-Only Actions (Listening/Searching) - OAuth 2.0 Bearer Token
// Requires Bearer Token associated with your Twitter Developer App
const appOnlyClient = new TwitterApi(config.twitter.bearerToken);
// Export clients for different API versions/access levels under app context
export const twitterReadOnlyClient = appOnlyClient.readOnly; // General R/O client
export const twitterV2ReadOnlyClient = appOnlyClient.v2; // Specific v2 client (needed for stream/search)
logger.info('Twitter AppOnly ReadOnly Client (v2) Initialized.'); 