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
// Import Twitter clients to ensure they're initialized at startup
import { twitterReadWriteClient, twitterV2ReadOnlyClient } from '@/services/twitter/client'
import { generateTextResponse } from '@/services/openai/openaiClient'

// Initialize logger
const logger = new LoggingService('GRLKRASHai')

// Create state instance to be used with GameWorker
let currentState: GRLKRASHWorldState = { ...initialWorldState }

// Define input type for processInput
interface ProcessInputArgs {
  type: string
  content: string
  context: {
    user: UserV2
    timestamp: string
    tweetId: string
  }
}

// Define decision type for processInput return value
interface ProcessDecision {
  action: string
  content?: string
  imageKey?: string
}

// Extend GameWorker with our custom processInput method
interface GRLKRASHGameWorker extends GameWorker {
  processInput: (input: ProcessInputArgs) => Promise<ProcessDecision>
}

// Initialize GameWorker with GRLKRASH personality
const worker = new GameWorker({
  id: 'grlkrash-worker',
  name: 'GRLKRASHai',
  description: 'Autonomous meme agent for GRLKRASH',
  functions: [], // Add any functions here if needed
  getEnvironment: async () => {
    // Return current state as part of the environment
    return { worldState: currentState };
  }
}) as GRLKRASHGameWorker

// Add processInput function to the worker (the G.A.M.E. protocol doesn't have onProcessInput in its interface)
worker.processInput = async (input: ProcessInputArgs): Promise<ProcessDecision> => {
  // 1. Analyze input data
  const { type, content, context } = input
  const { user, timestamp, tweetId } = context
  
  logger.info(`Processing ${type} from @${user.username}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`)
  
  // 2. Define personality configuration
  const personality = {
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
  
  logger.debug('Using personality configuration:', personality)
  
  // 3. Update world state
  const previousState = { ...currentState }
  currentState.lastMentionReceived = {
    userId: user.id,
    userName: user.username,
    tweetId,
    text: content,
    timestamp: Date.now(),
    keywordsFound: extractKeywords(content)
  }
  currentState.agentStatus = 'PROCESSING'
  currentState.lastActionTimestamp = Date.now()
  currentState.currentTime = new Date()
  
  logger.debug('Updated currentState with new mention data:', {
    userId: user.id,
    userName: user.username,
    tweetId,
    keywordsFound: currentState.lastMentionReceived.keywordsFound,
    agentStatus: currentState.agentStatus
  })
  
  // 4. Make decision based on content analysis
  logger.info(`Making decision based on keywords: ${currentState.lastMentionReceived.keywordsFound.join(', ') || 'none found'}`)
  const decision = await makeDecision(content, currentState, personality)
  logger.info(`Decision made: ${decision.action}`)
  
  // 5. If generating content, prepare prompt and call OpenAI
  if (decision.action === 'POST_TEXT' || decision.action === 'POST_MEME') {
    const prompt = generatePrompt(content, currentState, personality)
    logger.debug('Generated OpenAI prompt:', prompt)
    
    logger.info('Calling OpenAI to generate response text')
    const generatedContent = await generateTextResponse(prompt)
    logger.info(`Received generated content (${generatedContent.length} chars)`)
    logger.debug('Generated content:', generatedContent)
    
    decision.content = generatedContent
  }
  
  // 6. Return final decision
  return decision
}

// Helper function to extract keywords from content
function extractKeywords(content: string): string[] {
  if (!content) return []
  
  const keywords = ['meme', 'shill', '$MORE', 'create', 'perseverance', 'build', 'happy']
  const lowerContent = content.toLowerCase()
  
  return keywords.filter(keyword => 
    lowerContent.includes(keyword.toLowerCase())
  )
}

// Helper function to make decision based on content and state
// Prioritizes meme > shill > create > ignore
async function makeDecision(
  content: string,
  state: GRLKRASHWorldState,
  personality: any
): Promise<ProcessDecision> {
  const keywords = extractKeywords(content)
  
  // Check for keywords in priority order
  if (keywords.includes('meme')) {
    // Select appropriate meme image based on other keywords
    let imageKey = 'default_meme'
    
    if (keywords.includes('perseverance') || keywords.includes('build')) {
      imageKey = 'perseverance_meme'
    } else if (keywords.includes('happy')) {
      imageKey = 'happy_meme'
    }
    
    return {
      action: 'POST_MEME',
      imageKey
    }
  }
  
  if (keywords.includes('shill') || keywords.includes('$MORE')) {
    return {
      action: 'POST_SHILL'
    }
  }
  
  if (keywords.includes('create')) {
    return {
      action: 'POST_TEXT'
    }
  }
  
  // Default fallback if no keywords match
  return {
    action: 'IGNORE'
  }
}

// Helper function to generate prompt for OpenAI
function generatePrompt(
  content: string,
  state: GRLKRASHWorldState,
  personality: any
): string {
  logger.info('Generating prompt for OpenAI based on mention and personality')
  
  const { traits, voice } = personality
  const { lastMentionReceived } = state
  
  // Build personality traits description
  const personalityTraits = [
    traits.confident > 0.7 ? 'confident' : 'humble',
    traits.adventurous > 0.7 ? 'adventurous' : 'cautious',
    traits.wise > 0.7 ? 'wise' : 'playful',
    'creative',
    'meme-aware'
  ].join(', ')
  
  logger.debug('Using personality traits:', personalityTraits)
  
  // Format voice style direction clearly
  const voiceDirection = `Respond in a ${voice.style} and ${voice.tone} tone, keeping it ${voice.formality}.`
  
  // Include context about who mentioned the agent and any keywords found
  const userContext = `@${lastMentionReceived.userName} mentioned you` + 
    (lastMentionReceived.keywordsFound.length > 0 
      ? ` with keywords: ${lastMentionReceived.keywordsFound.join(', ')}`
      : '')
  
  logger.debug('User context for prompt:', userContext)
  
  // Add specific instructions based on keywords found
  let specificInstructions = ''
  if (lastMentionReceived.keywordsFound.includes('meme')) {
    specificInstructions = 'Create a witty, shareable response that would work well with a meme image.'
  } else if (lastMentionReceived.keywordsFound.includes('shill') || lastMentionReceived.keywordsFound.includes('$MORE')) {
    specificInstructions = 'Mention the $MORE token in an organic, enthusiastic way without being too salesy.'
  } else if (lastMentionReceived.keywordsFound.includes('create')) {
    specificInstructions = 'Be creative and artistic in your response, showcasing your AI artist persona.'
  }
  
  logger.debug('Specific instructions based on keywords:', specificInstructions)
  
  // Build the final prompt
  return `You are GRLKRASH, an AI artist who is ${personalityTraits}.
  
Task: Generate a Twitter response (max 280 chars) to ${userContext}.

Their mention: "${content}"

${specificInstructions}

${voiceDirection}

Remember you're a quirky AI artist who mixes confidence with a touch of humility and loves creating shareable content.`
}

async function startAgent() {
  try {
    logger.info('Starting GRLKRASHai agent...')

    // Verify Twitter client is initialized
    const clientInitialized = await initializeTwitterClient(twitterConfig, logger, retry)
    if (!clientInitialized) {
      throw new Error('Failed to verify Twitter client')
    }
    logger.info('Twitter client verified successfully')

    // Define mention handler
    async function handleMention(tweetData: {
      text: string
      user: UserV2
      timestamp: string
      id: string
    }) {
      logger.info(`Received mention from @${tweetData.user.username}: ${tweetData.text}`)

      try {
        // Process input through G.A.M.E.
        logger.info('Sending mention to G.A.M.E worker for processing')
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
          logger.info(`Attempting to post text tweet: "${decision.content?.substring(0, 50)}${decision.content && decision.content.length > 50 ? '...' : ''}"`)
          const success = await postTextTweet(decision.content, logger, retry)
          logger.info(`Text tweet ${success ? 'posted successfully' : 'failed to post'}`)
        } else if (decision.action === 'POST_MEME') {
          logger.info(`Attempting to post meme tweet with image key: ${decision.imageKey}`)
          logger.debug('Meme tweet content:', decision.content)
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