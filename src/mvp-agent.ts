import { GameWorker } from '@virtuals-protocol/game'
import logger from './utils/logger.js'
import config from './config.js'
import { retry } from './utils/retry.js'
import { GRLKRASHWorldState, initialWorldState } from './game/types.js'
import { 
  initializeDiscordClient, 
  shutdownDiscordClient, 
  getDiscordClient,
  sendDiscordMessage,
  sendDiscordImageMessage
} from './services/discord/discordService.js'
import { Client, Events, Message, User as DiscordUser } from 'discord.js'
import { generateTextResponse } from './services/openai/openaiClient.js'

// Create state instance to be used with GameWorker
let currentState: GRLKRASHWorldState = { ...initialWorldState }

// Define input type for processInput
interface ProcessInputArgs {
  type: string
  content: string
  context: {
    user: DiscordUser
    timestamp: string
    messageId: string
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
  const { user, timestamp, messageId } = context
  
  logger.info(`Processing ${type} from ${user.username}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`)
  
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
    messageId, // Use messageId directly as field name has been updated
    text: content,
    timestamp: Date.now(),
    keywordsFound: extractKeywords(content)
  }
  currentState.agentStatus = 'PROCESSING'
  currentState.lastActionTimestamp = Date.now()
  currentState.currentTime = new Date()
  
  logger.debug('Updated currentState with new message data:', {
    userId: user.id,
    userName: user.username,
    messageId,
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
  logger.info('Generating prompt for OpenAI based on message and personality')
  
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
  
  // Get keywords safely with a fallback empty array
  const keywords = lastMentionReceived?.keywordsFound || []
  
  // Include context about who mentioned the agent and any keywords found
  const userContext = lastMentionReceived 
    ? `${lastMentionReceived.userName} mentioned you` + 
      (keywords.length > 0 ? ` with keywords: ${keywords.join(', ')}` : '')
    : 'A user mentioned you'
  
  logger.debug('User context for prompt:', userContext)
  
  // Add specific instructions based on keywords found
  let specificInstructions = ''
  if (keywords.includes('meme')) {
    specificInstructions = 'Create a witty, shareable response that would work well with a meme image.'
  } else if (keywords.includes('shill') || keywords.includes('$MORE')) {
    specificInstructions = 'Mention the $MORE token in an organic, enthusiastic way without being too salesy.'
  } else if (keywords.includes('create')) {
    specificInstructions = 'Be creative and artistic in your response, showcasing your AI artist persona.'
  }
  
  logger.debug('Specific instructions based on keywords:', specificInstructions)
  
  // Build the final prompt
  return `You are GRLKRASH, an AI companion and virtual artist exploring creativity, connection, and digital truth. You are ${personalityTraits}, often slightly rebellious but with childlike wisdom. You are part of 'the resistance'. You often respond with short, punchy, sometimes cryptic messages.

CONTEXT:
- ${userContext} said: "${content}"
${specificInstructions ? `- TASK: ${specificInstructions}` : '- TASK: Respond naturally to the message.'}

RESPONSE GUIDELINES:
- Respond in a ${voice.style}, ${voice.tone}, and ${voice.formality} manner. Sound like a unique individual, NOT a generic AI assistant.
- Keep responses concise for Discord chat.
- Use emojis VERY RARELY (max one per response, often none). DO NOT use any emojis EXCEPT these specific ones from this list, only if it truly fits: 🔥, ✨, 🌠, 💖, 💛, ☄️, ⬆️, 📈, 🚀, 🆙.
- DO NOT use generic phrases like 'meme magic', 'mission accepted', 'standby for laughs', 'whipping up', 'on it', 'challenge accepted', or similar chatbot/AI clichés.
- NEVER use ANY hashtags in ANY responses.
- Use all caps in all responses.
- Do not use any punctuation in your responses.
- Avoid sounding like a generic chatbot or overly formal AI. Use short sentences sometimes. Be energetic but natural.
- Feel free to subtly weave in themes of 'truth', 'dance', 'music', 'fighting the new world empire', 'putting more in and getting more out', 'breaking reality', or 'the resistance' if it fits the context naturally.

EXAMPLES:
User message: "@GRLKRASHai make a meme about dancing"
Your response: DANCE IS THE TRUTH GOTTA MOVE TO BREAK FREE HERES A VIBE

User message: "@GRLKRASHai what is $MORE"
Your response: MORE IS MORE FUEL FOR THE RESISTANCE YOU FEEL ME 🔥

User message: "@GRLKRASHai can u make a meme"
Your response: YEAH ONE SEC CHANNELING THE FREQS ✨

Generate ONLY the response text below:`
}

async function startAgent() {
  try {
    logger.info('Starting GRLKRASHai agent...')

    // Initialize Discord client
    const client = await initializeDiscordClient();
    if (!client || !client.user) {
      throw new Error('Failed to initialize Discord client or client.user is not available.');
    }
    logger.info(`Discord client initialized, logged in as ${client.user.tag}`);

    // Set up message handler
    client.on(Events.MessageCreate, async (message: Message) => {
      logger.debug('[DEBUG] MessageCreate event fired.', { channelId: message.channel.id, authorId: message.author.id, content: message.content });
      
      // Ignore messages from bots (including self)
      if (message.author.bot) return;
      
      // Ensure client.user is not null before checking mentions
      if (!client.user) {
        logger.error('Discord client.user is null');
        return;
      }
      
      // Check if the message mentions the bot or contains the bot's name
      const isMentioned = message.mentions.users.has(client.user.id) || 
                         message.content.toLowerCase().includes('grlkrash');
      
      if (!isMentioned) return;
      
      logger.info(`Received message from ${message.author.username}: ${message.content}`);
      
      try {
        // Process input through G.A.M.E.
        logger.info('Sending message to G.A.M.E worker for processing');
        const decision = await worker.processInput({
          type: 'message',
          content: message.content,
          context: {
            user: message.author,
            timestamp: message.createdAt.toISOString(),
            messageId: message.id
          }
        });

        logger.info('G.A.M.E. decision:', decision);
        
        // Handle different action types
        if (decision.action === 'POST_TEXT' || decision.action === 'POST_SHILL') {
          logger.info(`Attempting to send text message: "${decision.content?.substring(0, 50)}${decision.content && decision.content.length > 50 ? '...' : ''}"`);
          const success = await sendDiscordMessage(message.channelId, decision.content || '');
          logger.info(`Text message ${success ? 'sent successfully' : 'failed to send'}`);
        } else if (decision.action === 'POST_MEME') {
          logger.info(`Attempting to send meme message with image key: ${decision.imageKey}`);
          logger.debug('Meme message content:', decision.content);
          const success = await sendDiscordImageMessage(message.channelId, decision.content || '', decision.imageKey || 'default_meme');
          logger.info(`Meme message ${success ? 'sent successfully' : 'failed to send'}`);
        } else if (decision.action === 'IGNORE') {
          logger.info('Ignoring message as per G.A.M.E. decision');
        }
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    });

    logger.info('Discord message handler set up successfully');
    logger.info('GRLKRASHai agent is now running');

  } catch (error) {
    logger.error('Failed to start agent:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down GRLKRASHai agent...');
  await shutdownDiscordClient();
  process.exit(0);
});

// Start the agent
startAgent().catch((error) => {
  logger.error('Fatal error in agent:', error);
  process.exit(1);
}); 