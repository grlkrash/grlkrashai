import { GameWorker } from '@virtuals-protocol/game'
import { LoggingService } from '@/services/utils/LoggingService'
import { twitterConfig } from '@/config/twitter.config'
import { retry } from '@/utils/retry'
import { UserV2 } from 'twitter-api-v2'
import { GRLKRASHWorldState, initialWorldState } from '@/game/types'
import {
  initializeTwitterClient,
  startTwitterListener,
  postTextTweet,
  postImageTweet,
  shutdownTwitter
} from '@/services/twitter/mvpTwitterService'

// Initialize logger
const logger = new LoggingService('GRLKRASHai')

// Initialize GameWorker with GRLKRASH personality
const worker = new GameWorker({
  name: 'GRLKRASHai',
  description: 'Autonomous meme agent for GRLKRASH',
  initialState: initialWorldState,
  personality: {
    traits: {
      confident: 0.8,
      humble: 0.6,
      adventurous: 0.9,
      wise: 0.7
    },
    voice: {
      style: 'playful',
      tone: 'enthusiastic',
      formality: 'casual'
    }
  }
})

async function startAgent() {
  try {
    logger.info('Starting GRLKRASHai agent...')

    // Initialize Twitter client
    const twitterClient = await initializeTwitterClient(twitterConfig, logger, retry)
    if (!twitterClient) {
      throw new Error('Failed to initialize Twitter client')
    }
    logger.info('Twitter client initialized successfully')

    // Define mention handler
    async function handleMention(tweetData: {
      text: string
      user: UserV2
      timestamp: string
      id: string
    }) {
      logger.info(`Received mention: ${tweetData.text}`)

      try {
        // Process input through G.A.M.E.
        const decision = await worker.processInput({
          type: 'mention',
          content: tweetData.text,
          context: {
            user: tweetData.user,
            timestamp: tweetData.timestamp,
            tweetId: tweetData.id
          }
        })

        logger.info('G.A.M.E. decision:', decision)

        // Handle different action types
        if (decision.action === 'POST_TEXT' || decision.action === 'POST_SHILL') {
          const success = await postTextTweet(decision.content, logger, retry)
          logger.info(`Text tweet ${success ? 'posted successfully' : 'failed to post'}`)
        } else if (decision.action === 'POST_MEME') {
          const success = await postImageTweet(decision.content, decision.imageKey, logger, retry)
          logger.info(`Meme tweet ${success ? 'posted successfully' : 'failed to post'}`)
        } else if (decision.action === 'IGNORE') {
          logger.info('Ignoring mention as per G.A.M.E. decision')
        }
      } catch (error) {
        logger.error('Error processing mention:', error)
      }
    }

    // Start Twitter listener
    await startTwitterListener(handleMention, logger, retry)
    logger.info('Twitter listener started successfully')
    logger.info('GRLKRASHai agent is now running')

  } catch (error) {
    logger.error('Failed to start agent:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down GRLKRASHai agent...')
  await shutdownTwitter(logger)
  process.exit(0)
})

// Start the agent
startAgent().catch((error) => {
  logger.error('Fatal error in agent:', error)
  process.exit(1)
}) 