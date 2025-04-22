import { ETwitterStreamEvent, EUploadMimeType, TweetV2, TwitterV2FilteredStreamResultStream, UserV2, TweetV2PostTweetResult } from 'twitter-api-v2'
import { promises as fs } from 'fs'
import path from 'path'
import { twitterConfig } from '@/config/twitter.config'
import { LoggingService } from '@/services/utils/LoggingService'
import { retry } from '@/utils/retry'
import { twitterReadWriteClient, twitterV2ReadOnlyClient, twitterV1Client } from './client'
import FSStatic from 'fs'

let stream: TwitterV2FilteredStreamResultStream | null = null

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

export async function initializeTwitterClient(config: any, logger: LoggingService, retryFn: Function): Promise<boolean> {
    try {
        // Verify client is initialized by making a simple test call
        await retryFn(async () => {
            // Simple verification that the client is ready
            await twitterReadWriteClient.v2.me()
        })
        
        logger.info('Twitter client verified successfully')
        return true
    } catch (error) {
        logger.error('Failed to verify Twitter client', { error })
        return false
    }
}

export async function startTwitterListener(
    handleMentionCallback: (tweetData: { text: string; user: UserV2; timestamp: string; id: string }) => Promise<void>,
    logger: LoggingService,
    retryFn: Function
): Promise<void> {
    try {
        const rules = [{ value: '@GRLKRASHai (meme OR shill OR $MORE OR create OR hello)', tag: 'grlkrash_mentions' }]

        await retryFn(async () => {
            const existingRules = await twitterV2ReadOnlyClient.streamRules()
            if (existingRules.data?.length) {
                await twitterV2ReadOnlyClient.updateStreamRules({
                    delete: { ids: existingRules.data.map(rule => rule.id) }
                })
            }

            const ruleResult = await twitterV2ReadOnlyClient.updateStreamRules({ add: rules })
            logger.info('Stream rules updated', { rules: ruleResult.data })

            stream = await twitterV2ReadOnlyClient.searchStream({
                expansions: ['author_id'],
                'tweet.fields': ['created_at']
            })

            stream.on(ETwitterStreamEvent.Data, async (data) => {
                try {
                    const authorUser = data.includes?.users?.find(user => user.id === data.data.author_id)
                    if (authorUser) {
                        await handleMentionCallback({
                            text: data.data.text,
                            user: authorUser,
                            timestamp: data.data.created_at,
                            id: data.data.id
                        })
                    }
                } catch (error) {
                    logger.error('Error handling mention callback', { error })
                }
            })

            stream.on(ETwitterStreamEvent.ConnectionError, (error) => {
                logger.error('Twitter stream connection error', { error })
            })

            stream.on(ETwitterStreamEvent.ConnectionClosed, () => {
                logger.warn('Twitter stream connection closed')
            })

            stream.on(ETwitterStreamEvent.ConnectionLost, () => {
                logger.warn('Twitter stream connection lost')
            })

            stream.on(ETwitterStreamEvent.TweetParseError, (error) => {
                logger.error('Twitter stream tweet parse error', { error })
            })

            stream.on(ETwitterStreamEvent.Ready, () => {
                logger.info('Twitter stream connected and ready')
            })
        })

        logger.info('Twitter listener started successfully')
    } catch (error) {
        logger.error('Failed to start Twitter listener', { error })
    }
}

/**
 * Posts a tweet using the Twitter API v2.
 * @param options - The tweet parameters (status, media, reply info).
 * @param logger - Logging service
 * @param retryFn - Retry function for resilient API calls 
 * @returns The ID of the posted tweet, or null on failure.
 */
export async function postTweet(options: PostTweetParams, logger: LoggingService, retryFn: Function): Promise<string | null> {
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

export async function postTextTweet(text: string, logger: LoggingService, retryFn: Function): Promise<boolean> {
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
    logger: LoggingService, 
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
    logger: LoggingService, 
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
    logger: LoggingService,
    retryFn: Function
): Promise<boolean> {
    if (!imageKey) {
        logger.warn('No image key provided, falling back to text tweet')
        return await postTextTweet(text, logger, retryFn)
    }

    const imageMap: { [key: string]: string } = {
        'default_meme': 'grlkrash_default.png',
        'happy_meme': 'grlkrash_happy.png',
        'perseverance_meme': 'grlkrash_perseverance.png'
    }

    const filename = imageMap[imageKey]
    if (!filename) {
        logger.error('Invalid image key provided', { imageKey })
        return false
    }

    try {
        const imagePath = path.join(__dirname, '../../..', 'public/images/memes', filename)
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

export async function shutdownTwitter(logger: LoggingService): Promise<void> {
    try {
        if (stream) {
            await stream.close()
            logger.info('Twitter stream closed')
        }
    } catch (error) {
        logger.error('Error closing Twitter stream', { error })
    } finally {
        stream = null
        logger.info('Twitter service shutdown complete')
    }
} 