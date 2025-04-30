import { ETwitterStreamEvent, EUploadMimeType, TweetV2, UserV2, TweetV2PostTweetResult } from 'twitter-api-v2'
import { promises as fs } from 'fs'
import path from 'path'
import config from '../../config.js'
import { type Logger } from '../../utils/logger.js'
import { retry } from '../../utils/retry.js'
import { twitterReadWriteClient, twitterV2ReadOnlyClient, twitterV1Client } from './client.js'
import FSStatic from 'fs'

// Create a type that properly represents what searchStream returns
// The return type is a promise that resolves to a stream, so we need to handle both states
let stream: Awaited<ReturnType<typeof twitterV2ReadOnlyClient.searchStream>> | null = null

let sinceId: string | undefined = undefined; // To track the last processed tweet ID
let pollingInterval: NodeJS.Timeout | null = null; // To hold the interval timer

// Interface for tweet options, including media and potential reply info
export interface PostTweetParams {
    status: string;
    media?: {
        media_ids: string[]; // Array of media IDs from upload
    };
    reply?: {
        in_reply_to_tweet_id: string;
    }
}

export async function initializeTwitterClient(config: any, logger: Logger, retryFn: Function): Promise<boolean> {
    try {
        // Verify client is initialized by making a simple test call
        await retryFn(3, async () => {
            // Simple verification that the client is ready
            await twitterReadWriteClient.v2.me()
        }, 1000)
        
        logger.info('Twitter client verified successfully')
        return true
    } catch (error: any) {
        logger.error('Failed to verify Twitter client', { message: error?.message, code: error?.code, apiErrors: error?.errors, stack: error?.stack })
        return false
    }
}

export async function startMentionPolling(
    handleMentionCallback: (tweetData: { text: string; user: UserV2; timestamp: string; id: string }) => Promise<void>,
    logger: Logger,
    retryFn: Function
): Promise<void> {
    // Inside the startMentionPolling function body:
    const POLLING_INTERVAL_MS = 60 * 1000; // Poll every 60 seconds

    logger.info(`Starting Twitter mention polling every ${POLLING_INTERVAL_MS / 1000} seconds...`);

    if (pollingInterval) {
        logger.warn('Polling already active. Clearing existing interval.');
        clearInterval(pollingInterval);
    }

    // Function to perform a single poll
    const performPoll = async () => {
        logger.debug('Polling for mentions...', { sinceId });
        try {
            // Use the v1.1 client (User context)
            const mentions = await twitterReadWriteClient.v1.mentionTimeline({
                since_id: sinceId,
                count: 50, // Fetch up to 50 mentions per poll
                tweet_mode: 'extended' // Use extended mode to get full text
            });

            if (!mentions || !Array.isArray(mentions) || mentions.length === 0) {
                logger.debug('No new mentions found in this polling interval.');
                return;
            }

            logger.info(`Found ${mentions.length} new mention(s).`);

            // Update sinceId with the ID of the newest mention (first in the array)
            // Important: Use id_str for full precision
            const newestId = mentions[0].id_str;
            if (newestId) {
                sinceId = newestId;
                logger.debug(`Updated sinceId to ${sinceId}`);
            }

            // Process tweets, oldest first, to maintain order
            for (const tweet of mentions.reverse()) {
                // Basic check to avoid processing tweets older than the initial sinceId (if any)
                // More robust check might compare IDs numerically if needed

                // Map v1.1 Tweet to the structure expected by handleMentionCallback
                // NOTE: We create a partial UserV2-like object. HandleMention might need adjustment later if it relies heavily on UserV2 specifics.
                const userDataForCallback: Partial<UserV2> & { id: string; username: string } = {
                    id: tweet.user.id_str,
                    username: tweet.user.screen_name,
                    name: tweet.user.name
                    // Add other UserV2 fields if necessary and available in v1.1 user object
                };

                const mentionData = {
                    text: tweet.full_text || tweet.text, // Prefer full_text from extended mode
                    user: userDataForCallback as UserV2, // Cast to UserV2, acknowledging it's partial
                    timestamp: tweet.created_at,
                    id: tweet.id_str
                };

                logger.debug(`Processing mention ID: ${mentionData.id}`);
                try {
                    await handleMentionCallback(mentionData);
                } catch (callbackError: any) {
                    logger.error('Error executing handleMentionCallback', { tweetId: mentionData.id, error: callbackError });
                }
            }

        } catch (error: any) {
            // Handle potential API errors (like rate limits)
            logger.error('Error during mention poll:', { code: error?.code, message: error?.message, data: error?.data });
            // Consider specific handling for rate limit errors (e.g., backoff)
        }
    };

    // Perform an initial poll immediately, then set the interval
    performPoll(); 
    pollingInterval = setInterval(performPoll, POLLING_INTERVAL_MS);

    logger.info('Mention polling started.');

    // Return void as the function now manages its own interval
    return;
}

/**
 * Posts a tweet using the Twitter API v2.
 * @param options - The tweet parameters (status, media, reply info).
 * @param logger - Logging service
 * @param retryFn - Retry function for resilient API calls 
 * @returns The ID of the posted tweet, or null on failure.
 */
export async function postTweet(options: PostTweetParams, logger: Logger, retryFn: Function): Promise<string | null> {
    try {
        const result = await retryFn(async () => {
            logger.info(`Attempting to post tweet (replyTo: ${options.reply?.in_reply_to_tweet_id ?? 'N/A'})...`)
            logger.debug('Tweet options:', options)
            
            return await twitterReadWriteClient.v2.tweet(options.status, {
                media: options.media ? { 
                    media_ids: options.media.media_ids as [string] 
                } : undefined,
                reply: options.reply
            })
        })

        const tweetId = result.data?.id
        if (tweetId) {
            logger.info(`Tweet posted successfully: ID ${tweetId}, Link: https://twitter.com/anyuser/status/${tweetId}`)
            return tweetId
        } else {
            logger.error('Tweet post API call succeeded but no tweet ID was returned.', { result })
            return null
        }
    } catch (error) {
        logger.error('Error posting tweet via Twitter API v2:', { error })
        return null
    }
}

export async function postTextTweet(text: string, logger: Logger, retryFn: Function): Promise<boolean> {
    try {
        const result = await retryFn(async () => {
            logger.info('Attempting to post text tweet')
            return await twitterReadWriteClient.v2.tweet(text)
        })

        logger.info('Text tweet posted successfully', { tweetId: result.data.id })
        return true
    } catch (error) {
        logger.error('Failed to post text tweet', { error })
        return false
    }
}

/**
 * Uploads media (image) to Twitter using path
 * @param filePath - Path to the image file
 * @param logger - Logging service  
 * @param retryFn - Retry function for resilient API calls
 * @param mimeType - Optional MIME type of the file
 * @returns The media ID string, or null on failure
 */
export async function uploadMediaFromPath(
    filePath: string, 
    logger: Logger, 
    retryFn: Function,
    mimeType?: string
): Promise<string | null> {
    try {
        logger.info(`Attempting to upload media from path: ${filePath}`)

        // Check if file exists before attempting upload
        if (!FSStatic.existsSync(filePath)) {
            logger.error(`Media file not found at path: ${filePath}`)
            return null
        }

        const mediaId = await retryFn(async () => {
            return await twitterV1Client.uploadMedia(filePath, { mimeType })
        })
        
        if (mediaId) {
            logger.info(`Media uploaded successfully: ID ${mediaId}`)
            return mediaId
        } else {
            logger.error('Media upload API call succeeded but no media_id_string returned.')
            return null
        }
    } catch (error) {
        logger.error('Error uploading media to Twitter:', { error })
        return null
    }
}

/**
 * Posts a tweet with a media file
 * @param status - The tweet text content
 * @param mediaPath - Path to the media file to upload
 * @param logger - Logging service
 * @param retryFn - Retry function for resilient API calls
 * @param replyToTweetId - Optional tweet ID to reply to
 * @returns True if successful, false otherwise
 */
export async function postMediaTweetFromPath(
    status: string, 
    mediaPath: string, 
    logger: Logger, 
    retryFn: Function,
    replyToTweetId?: string
): Promise<boolean> {
    try {
        // First upload the media
        const mediaId = await uploadMediaFromPath(mediaPath, logger, retryFn)
        
        if (!mediaId) {
            logger.error(`Failed to upload media for tweet: ${mediaPath}`)
            return false
        }
        
        // Prepare the tweet options
        const tweetOptions: PostTweetParams = {
            status,
            media: {
                media_ids: [mediaId]
            }
        }
        
        // Add reply parameters if provided
        if (replyToTweetId) {
            tweetOptions.reply = {
                in_reply_to_tweet_id: replyToTweetId
            }
        }
        
        // Post the tweet with the media
        const tweetId = await postTweet(tweetOptions, logger, retryFn)
        return tweetId !== null
    } catch (error) {
        logger.error('Error in postMediaTweetFromPath:', { error })
        return false
    }
}

export async function postImageTweet(
    text: string,
    imageKey: string | undefined,
    logger: Logger,
    retryFn: Function
): Promise<boolean> {
    if (!imageKey) {
        logger.warn('No image key provided, falling back to text tweet')
        return await postTextTweet(text, logger, retryFn)
    }

    const imageMap: { [key: string]: string } = {
        'pfp1': 'pfp1.png',
        'pfp2': 'pfp2.png',
        'pfp3': 'pfp3.png',
        'pfp4': 'pfp4.png',
        'pfp5': 'pfp5.png',
        'roblox': 'pfproblox.png',
        'minecraft': 'pfpminecraft.png'
    }

    const filename = imageMap[imageKey] || 'pfp1.png'
    if (!filename) {
        logger.error('Invalid image key provided', { imageKey })
        return false
    }

    try {
        const imagePath = path.join(__dirname, '../../..', 'public/images/pfp', filename)
        const imageBuffer = await retryFn(async () => {
            logger.info('Attempting to read image file', { path: imagePath })
            return await fs.readFile(imagePath)
        })

        const mimeType = filename.endsWith('.png') ? EUploadMimeType.Png : EUploadMimeType.Jpeg
        const mediaId = await retryFn(async () => {
            logger.info('Attempting to upload media')
            return await twitterV1Client.uploadMedia(imageBuffer, { mimeType })
        })

        const result = await retryFn(async () => {
            logger.info('Attempting to post image tweet')
            return await twitterReadWriteClient.v2.tweet(text, { 
                media: { 
                    media_ids: [mediaId] as [string] 
                } 
            })
        })

        logger.info('Image tweet posted successfully', { tweetId: result.data.id })
        return true
    } catch (error) {
        logger.error('Failed to post image tweet', { error })
        return false
    }
}

export async function shutdownTwitter(logger: Logger): Promise<void> {
    try {
        if (stream) {
            // Close the stream if it exists
            stream.close()
            logger.info('Twitter stream closed')
        }
        
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            logger.info('Twitter mention polling stopped')
        }
    } catch (error) {
        logger.error('Error during Twitter shutdown', { error })
    } finally {
        stream = null
        logger.info('Twitter service shutdown complete')
    }
} 