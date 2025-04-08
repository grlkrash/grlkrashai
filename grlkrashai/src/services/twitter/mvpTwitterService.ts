import { TwitterApi, ETwitterStreamEvent, EUploadMimeType, TweetV2, TwitterV2FilteredStreamResultStream, UserV2 } from 'twitter-api-v2'
import { promises as fs } from 'fs'
import path from 'path'
import { twitterConfig } from '@/config/twitter.config'
import { LoggingService } from '@/services/utils/LoggingService'
import { retry } from '@/utils/retry'

let rwClient: TwitterApi | null = null
let stream: TwitterV2FilteredStreamResultStream | null = null

export async function initializeTwitterClient(config: any, logger: LoggingService, retryFn: Function): Promise<TwitterApi | null> {
    try {
        rwClient = await retryFn(async () => {
            const client = new TwitterApi({
                appKey: config.credentials.appKey,
                appSecret: config.credentials.appSecret,
                accessToken: config.credentials.accessToken,
                accessSecret: config.credentials.accessSecret
            })
            return client.readWrite
        })
        
        logger.info('Twitter client initialized successfully')
        return rwClient
    } catch (error) {
        logger.error('Failed to initialize Twitter client', { error })
        return null
    }
}

export async function startTwitterListener(
    handleMentionCallback: (tweetData: { text: string; user: UserV2; timestamp: string; id: string }) => Promise<void>,
    logger: LoggingService,
    retryFn: Function
): Promise<void> {
    if (!rwClient) {
        logger.error('Twitter client not initialized')
        return
    }

    try {
        const v2Client = new TwitterApi(twitterConfig.api.bearerToken)
        const rules = [{ value: '@GRLKRASHai (meme OR shill OR $MORE OR create OR hello)', tag: 'grlkrash_mentions' }]

        await retryFn(async () => {
            const existingRules = await v2Client.streamRules()
            if (existingRules.data?.length) {
                await v2Client.updateStreamRules({
                    delete: { ids: existingRules.data.map(rule => rule.id) }
                })
            }

            const ruleResult = await v2Client.updateStreamRules({ add: rules })
            logger.info('Stream rules updated', { rules: ruleResult.data })

            stream = await v2Client.searchStream({
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

export async function postTextTweet(text: string, logger: LoggingService, retryFn: Function): Promise<boolean> {
    if (!rwClient) {
        logger.error('Twitter client not initialized')
        return false
    }

    try {
        const result = await retryFn(async () => {
            logger.info('Attempting to post text tweet')
            return await rwClient!.v2.tweet(text)
        })

        logger.info('Text tweet posted successfully', { tweetId: result.data.id })
        return true
    } catch (error) {
        logger.error('Failed to post text tweet', { error })
        return false
    }
}

export async function postImageTweet(
    text: string,
    imageKey: string | undefined,
    logger: LoggingService,
    retryFn: Function
): Promise<boolean> {
    if (!rwClient) {
        logger.error('Twitter client not initialized')
        return false
    }

    if (!imageKey) {
        logger.warn('No image key provided, falling back to text tweet')
        return await postTextTweet(text, logger, retryFn)
    }

    const imageMap: { [key: string]: string } = {
        'default_meme': 'grlkrash_default.png',
        'happy_meme': 'grlkrash_happy.png'
    }

    const filename = imageMap[imageKey]
    if (!filename) {
        logger.error('Invalid image key provided', { imageKey })
        return false
    }

    try {
        const imagePath = path.join(__dirname, '../../..', 'public/images/grlkrash', filename)
        const imageBuffer = await retryFn(async () => {
            logger.info('Attempting to read image file', { path: imagePath })
            return await fs.readFile(imagePath)
        })

        const mimeType = filename.endsWith('.png') ? EUploadMimeType.Png : EUploadMimeType.Jpeg
        const mediaId = await retryFn(async () => {
            logger.info('Attempting to upload media')
            return await rwClient!.v1.uploadMedia(imageBuffer, { mimeType })
        })

        const result = await retryFn(async () => {
            logger.info('Attempting to post image tweet')
            return await rwClient!.v2.tweet(text, { media: { media_ids: [mediaId] } })
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
        rwClient = null
        logger.info('Twitter service shutdown complete')
    }
} 