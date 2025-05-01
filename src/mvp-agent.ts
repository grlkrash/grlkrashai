import { GameWorker } from '@virtuals-protocol/game'
import logger from './utils/logger.js'
import config from './config.js'
import { retry } from './utils/retry.js'
import { loadLyrics, getRandomLyricLines } from './utils/lyricLoader.js'
import { GRLKRASHWorldState, initialWorldState } from './game/types.js'
import { 
  initializeDiscordClient, 
  shutdownDiscordClient, 
  getDiscordClient,
  sendDiscordMessage,
  sendDiscordImageMessage
} from './services/discord/discordService.js'
import { postImageTweet, postTextTweet } from './services/twitter/mvpTwitterService.js'
import { Client, Events, Message, User as DiscordUser } from 'discord.js'
import { generateTextResponse } from './services/openai/openaiClient.js'
import { URLSearchParams } from 'url'

// Create state instance to be used with GameWorker
let currentState: GRLKRASHWorldState = { ...initialWorldState }

// Set to track users who have interacted
const processedUserIds = new Set<string>();

// Interval for autonomous actions
let autonomousActionInterval: NodeJS.Timeout | null = null;

// Define input type for processInput
interface ProcessInputArgs {
  type: string
  content: string
  context: {
    user: DiscordUser | { id: string; username: string }
    timestamp: string
    messageId: string
    channelId?: string // Add channelId as optional for backward compatibility
  }
}

// Define decision type for processInput return value
interface ProcessDecision {
  action: string
  content?: string
  imageKey?: string
  context?: {
    previousVerse?: string
    [key: string]: any // Allow for additional context properties
  }
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
  
  // Add improved logging for all input types
  const user = context.user as any // Cast user for logging access
  logger.info(`Processing ${type} from ${user?.username || 'System'}: "${content?.substring(0, 50)}${content?.length > 50 ? '...' : ''}"`)
  
  // Handle different input types
  if (type === 'autonomous_tick') {
    logger.info(`Processing autonomous tick action`)
    
    // For autonomous actions, just use a simplified state update
    currentState.agentStatus = 'PROCESSING'
    currentState.lastActionTimestamp = Date.now()
    currentState.currentTime = new Date()
    
    // Make decision based on autonomous tick
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
    
    // Make decision directly without additional processing - pass the full input object
    const decision = await makeDecision(content || '', currentState, personality, input)
    logger.info(`Autonomous decision made: ${decision.action}`)
    
    // Handle state update specific to autonomous post decision - UPDATE TIMESTAMP RIGHT AFTER DECISION
    if (decision.action === 'POST_AUTONOMOUS_TWEET') {
      currentState.lastTwitterPostTimestamp = Date.now() // Update timestamp HERE
      logger.debug('Updated lastTwitterPostTimestamp in state.')
    }
    
    // 5. If generating content, prepare prompt and call OpenAI
    if (decision.action === 'POST_AUTONOMOUS_TWEET') {
      // Generate autonomous tweet content
      const prompt = generateAutonomousTweetPrompt(currentState, personality)
      logger.debug('Generated autonomous tweet prompt:', prompt)
      
      logger.info('Calling OpenAI to generate autonomous tweet')
      const temperature = 0.75 // Slightly higher temperature for more creative tweets
      
      // Only call OpenAI if a valid prompt was generated
      if (prompt) { // REMOVED check for decision.content !== undefined
        const generatedTweet = await generateTextResponse(prompt, temperature)
        logger.info(`Received generated tweet (${generatedTweet.length} chars)`)
        logger.debug('Generated tweet:', generatedTweet)
        
        decision.content = generatedTweet
      } else {
        // Handle case where prompt generation failed
        logger.error('OpenAI call needed but prompt generation failed for action:', decision.action)
        decision.content = undefined // Ensure content is undefined so action handler knows it failed
      }
    }
    
    // Reset agent status to IDLE after processing
    currentState.agentStatus = 'IDLE'
    
    return decision
  }
  
  // For Discord mentions, continue with normal processing
  const { user: discordUser, timestamp, messageId } = context
  
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
    userId: discordUser.id,
    userName: discordUser.username,
    messageId, // Use messageId directly as field name has been updated
    text: content,
    timestamp: Date.now(),
    keywordsFound: extractKeywords(content)
  }
  currentState.agentStatus = 'PROCESSING'
  currentState.lastActionTimestamp = Date.now()
  currentState.currentTime = new Date()
  
  logger.debug('Updated currentState with new message data:', {
    userId: discordUser.id,
    userName: discordUser.username,
    messageId,
    keywordsFound: currentState.lastMentionReceived.keywordsFound,
    agentStatus: currentState.agentStatus
  })
  
  // 4. Make decision based on content analysis
  logger.info(`Making decision based on keywords: ${currentState.lastMentionReceived.keywordsFound.join(', ') || 'none found'}`)
  const decision = await makeDecision(content || '', currentState, personality, input)
  logger.info(`Decision made: ${decision.action}`)
  
  // Handle state update specific to autonomous post decision - MOVED HERE right after decision is made
  if (decision.action === 'POST_AUTONOMOUS_TWEET') {
    currentState.lastTwitterPostTimestamp = Date.now()
    logger.debug('Updated lastTwitterPostTimestamp in state.')
  }
  
  // 5. If generating content, prepare prompt and call OpenAI
  let prompt = '';
  let temperature = 0.7; // Default temperature
  let currentTopic = content || ''; // Use input content as default topic
  let requiresOpenAI = false; // Flag to track if OpenAI is needed

  if (decision.action === 'GENERATE_LYRICS') {
    prompt = generateLyricsPrompt(currentTopic, currentState, personality);
    temperature = 0.6;
    logger.info('Calling OpenAI to generate initial lyrics');
    requiresOpenAI = true;
  } else if (decision.action === 'GENERATE_MORE_LYRICS') {
    // Extract topic and previous verse from decision context/content
    currentTopic = decision.content || currentState.lastLyricRequest?.topic || 'the struggle'; // Get topic
    const prevVerse = decision.context?.previousVerse || '';
    if (!prevVerse) logger.warn("Generating 'more' lyrics but no previous verse found in decision context");
    prompt = generateMoreLyricsPrompt(currentTopic, prevVerse, currentState, personality); // Note parameter order
    temperature = 0.65; // Slightly higher temperature for continuation creativity
    logger.info('Calling OpenAI to generate MORE lyrics');
    requiresOpenAI = true;
  } else if (decision.action === 'POST_AUTONOMOUS_TWEET') {
    prompt = generateAutonomousTweetPrompt(currentState, personality);
    temperature = 0.75;
    logger.info('Calling OpenAI to generate autonomous thought');
    requiresOpenAI = true;
  } else if (decision.action === 'POST_TEXT') {
    // Handle POST_TEXT if still needed
    prompt = generatePrompt(currentTopic, currentState, personality);
    logger.info('Calling OpenAI to generate response text');
    requiresOpenAI = true;
  }
  // ... Any other actions needing OpenAI would go here ...

  // Only call OpenAI if required and a valid prompt was generated
  if (requiresOpenAI) {
    if (prompt) {
      const generatedContent = await generateTextResponse(prompt, temperature);
      const logMsg = decision.action.replace(/_/g, ' ').toLowerCase(); // Generate log message from action name
      logger.info(`Received generated ${logMsg} (${generatedContent.length} chars)`);
      logger.debug(`Generated ${logMsg}:`, generatedContent);
      decision.content = generatedContent; // Assign generated content back
    } else {
      logger.error('OpenAI call needed but prompt generation failed for action:', decision.action);
      decision.content = undefined; // Ensure content is undefined
    }
  }
  
  // Update last lyric request context if lyrics were generated
  if ((decision.action === 'GENERATE_LYRICS' || decision.action === 'GENERATE_MORE_LYRICS') && decision.content) {
    // Ensure context exists and has user/channelId
    const userId = input.context.user?.id;
    const channelId = input.context.channelId;
    if (userId && channelId) {
      currentState.lastLyricRequest = {
        userId: userId,
        channelId: channelId,
        topic: currentTopic, // Use the topic determined above
        lastVerse: decision.content, // Store the NEWLY generated verse
        timestamp: Date.now()
      };
      logger.debug('Updated lastLyricRequest state.');
    } else {
      logger.warn('Could not update lastLyricRequest state: missing userId or channelId in input context.');
    }
  }
  
  // Reset agent status to IDLE after processing
  currentState.agentStatus = 'IDLE'
  
  // 6. Return final decision
  return decision
}

// Helper function to extract keywords from content
function extractKeywords(content: string): string[] {
  if (!content) return []
  
  const triggerKeywords = ['post', 'truth', 'pfp', 'say', 'create', 'message', 'lyrics', 'song', 'write', 'verse', 'more', 'another', 'continue', 'next']
  const lowerContent = content.toLowerCase()
  
  return triggerKeywords.filter(keyword => 
    lowerContent.includes(keyword.toLowerCase())
  )
}

// Helper function to make decision based on content and state
async function makeDecision(
  // Input: content is user message AFTER bot mention is removed
  inputContent: string, 
  state: GRLKRASHWorldState, 
  personality: any,
  input: ProcessInputArgs
): Promise<ProcessDecision> {

  // --- Autonomous Action Check ---
  if (input.type === 'autonomous_tick') {
      const MIN_TIME_BETWEEN_POSTS_MS = 6 * 60 * 60 * 1000; // e.g., 6 hours
      const now = Date.now();
      const lastPostTime = state.lastTwitterPostTimestamp ?? 0; 

      if (now - lastPostTime > MIN_TIME_BETWEEN_POSTS_MS) {
          logger.debug('Autonomous trigger: Time threshold met. Deciding to generate a thought.');
          // Return the action type, content will be generated later
          return { 
              action: 'POST_AUTONOMOUS_TWEET' 
          };
      } else {
          logger.debug('Autonomous trigger: Not enough time passed since last post. Ignoring.');
          return { action: 'IGNORE' };
      }
  } 
  // --- End Autonomous Action Check ---
  else if (input.type === 'discord_mention') {
    const keywordsFound = extractKeywords(inputContent); // Uses existing keywords from extractKeywords
    const pfpKeys = ['pfp1', 'pfp2', 'pfp3', 'pfp4', 'pfp5', 'roblox', 'minecraft'];
    
    // Define keyword sets for different actions
    const lyricKeywords = ['lyrics', 'song', 'write', 'verse', 'create'];
    const pfpKeyword = 'pfp';
    const twitterPostKeywords = ['post', 'truth', 'say', 'message'];
    // Define continuation keywords
    const continuationKeywords = ['more', 'another', 'continue', 'next'];
    // Keywords that trigger *any* action
    const triggerKeywords = [...lyricKeywords, pfpKeyword, ...twitterPostKeywords, ...continuationKeywords];

    // --- Simpler Cleaning Logic ---
    let userMessage = inputContent; // inputContent should be mention-removed by caller

    // Find the *first* trigger keyword that appears at the start of the message
    let keywordToRemove: string | null = null;
    const lowerTrimmedInput = inputContent.trim().toLowerCase();
    for (const kw of triggerKeywords) {
        if (lowerTrimmedInput.startsWith(kw.toLowerCase())) {
            // Check if it's a whole word (followed by space or end of string)
            const potentialBoundary = lowerTrimmedInput[kw.length];
            if (potentialBoundary === undefined || potentialBoundary === ' ') {
                keywordToRemove = kw;
                break; 
            }
        }
    }

    // If a starting trigger keyword was found, remove it (case-insensitive)
    if (keywordToRemove) {
        const regexTriggerStart = new RegExp(`^\\s*${keywordToRemove}\\s+`, 'i'); 
        userMessage = userMessage.replace(regexTriggerStart, '');
        logger.debug(`Removed starting trigger keyword: "${keywordToRemove}"`);
    }

    // Remove common leading words like "hey" (case-insensitive) AFTER removing trigger
    userMessage = userMessage.replace(/^\s*hey\s+/i, '');

    // Final trim and uppercase
    const finalContent = userMessage.trim().toUpperCase();

    // Use default if empty after cleaning
    const contentToUse = finalContent || 'KEEP ART ALIVE // KEEP TRUTH ALIVE'; 
    // Ensure this crucial debug log remains right before the decision logic
    logger.debug(`Cleaned user content: "${contentToUse}"`, { originalInputToMakeDecision: inputContent }); 
    // --- End Simpler Cleaning Logic ---

    // --- Decision Logic ---
    const hasTriggerKeyword = triggerKeywords.some(k => keywordsFound.includes(k));

    if (hasTriggerKeyword) {
        const userId = input.context.user.id; // Get user ID from context
        const channelId = input.context.channelId; // Get channel ID from context

        // Check for Continuation FIRST
        const isContinuationRequest = continuationKeywords.some(k => keywordsFound.includes(k));
        const recentLyricContext = state.lastLyricRequest !== undefined && 
                                   state.lastLyricRequest.userId === userId &&
                                   state.lastLyricRequest.channelId === channelId &&
                                   (Date.now() - state.lastLyricRequest.timestamp < 5 * 60 * 1000); // Within 5 mins

        if (isContinuationRequest && recentLyricContext && state.lastLyricRequest) {
            logger.debug(`Continuation keyword detected for recent topic: "${state.lastLyricRequest.topic}"`);
            // Pass necessary context back for the next prompt
            return {
                action: 'GENERATE_MORE_LYRICS', // New Action
                content: state.lastLyricRequest.topic, // Original topic
                // Pass previous verse via context sub-object
                context: { previousVerse: state.lastLyricRequest.lastVerse } 
            };
        } 
        // ELSE check for initial lyric request, PFP request, etc.
        else if (lyricKeywords.some(k => keywordsFound.includes(k))) {
            logger.debug(`Lyrics keyword detected. Decision: GENERATE_LYRICS`);
            return { 
                action: 'GENERATE_LYRICS', 
                content: contentToUse 
            };
        } 
        // Check for PFP keyword
        else if (keywordsFound.includes(pfpKeyword)) {
            const selectedImageKey = pfpKeys[Math.floor(Math.random() * pfpKeys.length)];
            logger.debug(`PFP keyword detected. Decision: POST_PFP_USER_MESSAGE, Key: ${selectedImageKey}`);
            return { 
                action: 'POST_PFP_USER_MESSAGE', 
                imageKey: selectedImageKey, 
                content: contentToUse 
            };
        } 
        // Check for Twitter post keywords
        else if (twitterPostKeywords.some(k => keywordsFound.includes(k))) {
            logger.debug(`Twitter post keyword detected. Decision: POST_TEXT_TO_TWITTER`);
            return { 
                action: 'POST_TEXT_TO_TWITTER', 
                content: contentToUse 
            };
        } 
        else {
            // No specific action keywords found
            logger.debug('No specific action keywords found. Decision: IGNORE');
            return { 
                action: 'IGNORE' 
            };
        }
    } else {
        // No relevant keywords found
        logger.debug('No trigger keywords found. Decision: IGNORE');
        return { 
            action: 'IGNORE' 
        };
    }
  } else {
    logger.warn(`Unknown input type received in makeDecision: ${input.type}`);
    return { action: 'IGNORE' };
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
    specificInstructions = 'Briefly and energetically acknowledge the request to create something visual.'
  } else if (keywords.includes('shill') || keywords.includes('$MORE')) {
    specificInstructions = 'Mention the $MORE token in an organic, enthusiastic way without being too salesy.'
  } else if (keywords.includes('create')) {
    specificInstructions = 'Be creative and artistic in your response, showcasing your AI artist persona.'
  }
  
  logger.debug('Specific instructions based on keywords:', specificInstructions)
  
  // Build the final prompt
  return `You are GRLKRASH, an AI companion and virtual artist exploring creativity, connection, and digital truth. You are ${personalityTraits}, often slightly rebellious but with childlike wisdom. Your responses are often unexpected and avoid stating the obvious. You are part of 'the resistance'. You often respond with short, punchy, sometimes cryptic messages.

CONTEXT:
- ${userContext} said: "${content}"
${specificInstructions ? `- TASK: ${specificInstructions}` : '- TASK: Respond naturally to the message.'}

RESPONSE GUIDELINES:
- Respond in a ${voice.style}, ${voice.tone}, and ${voice.formality} manner. Sound like a unique individual, NOT a generic AI assistant.
- Keep responses concise for Discord chat.
- Use emojis VERY RARELY (max one per response, often none). If you use one, ONLY use from this list: 🔥, ✨, 🌠, 💖, 💛, ☄️, ⬆️, 📈, 🚀, 🆙.
- Avoid generic chatbot phrases such as: 'meme magic', 'mission accepted', 'standby for laughs', 'whipping up', 'on it', 'challenge accepted', etc.
- NEVER use ANY hashtags in ANY responses.
- Use all caps in all responses.
- Do not use any punctuation in your responses.
- Avoid sounding like a generic chatbot or overly formal AI. Use short sentences sometimes. Be energetic but natural.
- Feel free to subtly weave in themes of 'truth', 'dance', 'music', 'fighting the new world empire', 'putting more in and getting more out', 'breaking reality', or 'the resistance' if it fits the context naturally.
- Focus on sounding authentic and spontaneous, not like you're just following instructions.

EXAMPLES:
User message: "@GRLKRASHai make a meme about dancing"
Your response: DANCE IS THE TRUTH GOTTA MOVE TO BREAK FREE HERES A VIBE

User message: "@GRLKRASHai what is $MORE"
Your response: MORE IS MORE FUEL FOR THE RESISTANCE YOU FEEL ME 🔥

User message: "@GRLKRASHai can u make a meme"
Your response: YEAH ONE SEC CHANNELING THE FREQS ✨

Generate ONLY the response text below:`
}

// Helper function to generate lyrics prompt for OpenAI
function generateLyricsPrompt(
  userInput: string, // The user's message/topic request (cleaned)
  state: GRLKRASHWorldState, 
  personality: any 
): string {
  logger.info('Generating AUTHENTIC GRLKRASH LYRIC prompt v4 (Analysis) for OpenAI');

  const inspirationLines = getRandomLyricLines(6); 
  let inspirationSection = '';
  if (inspirationLines.length > 0) {
      inspirationSection = `KEY STYLE EXAMPLES (GRLKRASH's raw, ALL CAPS, no-punctuation style):

${inspirationLines.map(line => `- ${line}`).join('\n')}
`;
  }
  logger.debug('Using inspiration lines in prompt:', { lines: inspirationLines });

  const topic = userInput.trim() || 'the struggle and the search for truth'; 
  const task = `Write an original GRLKRASH-style verse (exactly 4 lines) about: "${topic}"`;

  // Define the core GRLKRASH lyrical style guidelines 
  const styleGuideline = `CRITICAL STYLE REQUIREMENTS (Follow STRICTLY):


OUTPUT MUST BE ALL CAPS.

OUTPUT MUST NOT use ANY punctuation.

THEMES: Focus ONLY on raw human experiences inspired by the reference lyrics: loneliness, perseverance ("still try to win"), anger at manipulation, desire/loss of connection ("wanna ride with you"), trust issues ("cant trust nobody"), fear, self-doubt ("me against me"), finding personal truth.

TONE/VOICE: Sound authentic, raw, direct, vulnerable, sometimes angry or melancholic like the reference lyrics. DO NOT sound like a generic rapper, motivational speaker, or chatbot. AVOID bravado and clichés (NO "no doubt", "let's get wild", "lost in gloom", "never ends", "last round", etc.). Be specific to the feeling.

STRUCTURE/RHYME: DO NOT use obvious AABB or ABCB rhymes. Prioritize raw expression over rhyme. Sentence fragments, unrhymed lines, or slant rhymes are highly preferred. DO NOT force rhymes.

WORD CHOICE: Simple, direct, impactful. Natural slang okay ("tryna", "vibing"). NO generic filler.

NO TECH/CODE/GLITCH THEMES unless topic requires it. Focus on HUMAN emotion.

NO hashtags. NO emojis (maybe 🔥 or ✨ on last line ONLY if essential, usually NONE).`;

// Construct the final prompt
return `You are GRLKRASH. Your task is to write lyrics in a VERY specific style.

First, ANALYZE the style of the REFERENCE LYRICS provided below. Notice they are ALL CAPS, use NO punctuation, explore raw human emotion (loneliness, struggle, loyalty, etc.), avoid clichés, and often don't use perfect rhymes.

${inspirationSection}
// Analyze the style above carefully.

Now, perform this task: ${task}

Apply ALL the following ${styleGuideline}

Generate ONLY the 4 lines of raw verse text below:`;
}

/**
 * Generates a prompt for OpenAI to create additional lyrics building on previous verse.
 */
function generateMoreLyricsPrompt(
  topic: string,      // The original topic
  previousVerse: string, // The verse generated previously
  state: GRLKRASHWorldState, 
  personality: any
): string {
  logger.info('Generating MORE LYRICS prompt v1 for OpenAI');

  const inspirationLines = getRandomLyricLines(6); 
  let inspirationSection = '';
  if (inspirationLines.length > 0) {
      inspirationSection = `KEY STYLE EXAMPLES (GRLKRASH's raw, ALL CAPS, no-punctuation style):

${inspirationLines.map(line => `- ${line}`).join('\n')}
`;
  }
  logger.debug('Using inspiration lines in prompt:', { lines: inspirationLines });

  // Define the core task based on user input and previous verse
  const task = `Continue the GRLKRASH-style verse below by writing the NEXT original 4 lines about: "${topic}"\n\nPREVIOUS VERSE:\n${previousVerse}`;

  // Define the core GRLKRASH lyrical style guidelines 
  const styleGuideline = `CRITICAL STYLE REQUIREMENTS (Follow STRICTLY):


OUTPUT MUST BE ALL CAPS.

OUTPUT MUST NOT use ANY punctuation.

THEMES: Focus ONLY on raw human experiences inspired by the reference lyrics: loneliness, perseverance ("still try to win"), anger at manipulation, desire/loss of connection ("wanna ride with you"), trust issues ("cant trust nobody"), fear, self-doubt ("me against me"), finding personal truth.

TONE/VOICE: Sound authentic, raw, direct, vulnerable, sometimes angry or melancholic like the reference lyrics. DO NOT sound like a generic rapper, motivational speaker, or chatbot. AVOID bravado and clichés (NO "no doubt", "let's get wild", "lost in gloom", "never ends", "last round", etc.). Be specific to the feeling.

STRUCTURE/RHYME: DO NOT use obvious AABB or ABCB rhymes. Prioritize raw expression over rhyme. Sentence fragments, unrhymed lines, or slant rhymes are highly preferred. DO NOT force rhymes.

WORD CHOICE: Simple, direct, impactful. Natural slang okay ("tryna", "vibing"). NO generic filler.

NO TECH/CODE/GLITCH THEMES unless topic requires it. Focus on HUMAN emotion.

NO hashtags. NO emojis (maybe 🔥 or ✨ on last line ONLY if essential, usually NONE).`;

// Construct the final prompt
return `You are GRLKRASH. Your task is to continue writing lyrics in a VERY specific style.

First, ANALYZE the style of the REFERENCE LYRICS provided below. Notice they are ALL CAPS, use NO punctuation, explore raw human emotion (loneliness, struggle, loyalty, etc.), avoid clichés, and often don't use perfect rhymes.

${inspirationSection}
// Analyze the style above carefully.

Now, perform this task: ${task}

Apply ALL the following ${styleGuideline}

Generate ONLY the 4 NEW lines of raw verse text below:`;
}

/**
 * Generates a prompt for OpenAI to create an autonomous GRLKRASH thought for Twitter.
 */
function generateAutonomousTweetPrompt(state: GRLKRASHWorldState, personality: any): string {
    logger.info('Generating AUTONOMOUS TWEET prompt for OpenAI');

    // Ensure personality and its properties exist with defaults if necessary
    const traits = personality?.traits ?? { confident: 0.7, humble: 0.5, adventurous: 0.7, wise: 0.6 };
    const voice = personality?.voice ?? { style: 'playful', tone: 'enthusiastic', formality: 'casual' };

    // Construct personality traits string
    const personalityTraits = [ 
        traits.confident > 0.7 ? 'confident' : 'humble',
        traits.adventurous > 0.7 ? 'adventurous' : 'cautious',
        traits.wise > 0.7 ? 'wise' : 'playful',
        'creative', 'tech-savvy', 'slightly rebellious' // Keep consistent with lyric prompt maybe?
    ].join(', ');

    // Define style guidelines
    const styleGuideline = `STYLE GUIDELINES:

MUST BE ALL CAPS

MUST NOT use ANY punctuation

MUST BE EXTREMELY CONCISE. ONE SENTENCE OR FRAGMENT ONLY. MAX ~100 CHARACTERS.

BE PROVOCATIVE. Ask a challenging question or make a stark statement.

AVOID abstract philosophical language. Be direct and punchy.

DO NOT structure the output like song lyrics, poetry, or slogans. Aim for a concise, impactful statement or question.

AVOID generic motivational phrases or simple affirmations (like 'BE UNSTOPPABLE'). Be more questioning or challenging.

Focus on GRLKRASH themes: raw human truths (loneliness, perseverance, anger at control, desire for connection), observations about reality/society, the resistance, art as truth.

Tone: Authentic, direct, raw, sometimes cryptic, questioning, or defiant. AVOID clichés and generic AI speak.

The goal is to be thought-provoking and encourage engagement.

NO hashtags. MAX one relevant emoji from list: 🔥, ✨, 💖, 💛, 🚀. Often NO emoji.`;

// Task for the LLM
  const task = `Generate ONE extremely short, direct, and provocative question OR a cryptic statement (MAXIMUM 1 short sentence or fragment, aim for under 100 characters) from GRLKRASH's perspective on truth, control, reality, or the resistance. Make it something people will react to or question.`;

  return `You are GRLKRASH, embodying a raw, ALL CAPS, no-punctuation style reflecting on human truths and resistance.

${task}

${styleGuideline}

Generate ONLY the thought text below:`;
}

async function triggerAutonomousAction() {
  try {
    logger.info('Triggering autonomous action check...');
    
    // Create properly structured inputArgs object for autonomous action
    const inputArgs: ProcessInputArgs = {
      type: 'autonomous_tick',
      content: '',
      context: {
        user: {
          id: 'system',
          username: 'system',
        } as DiscordUser,
        timestamp: new Date().toISOString(),
        messageId: 'autonomous-' + Date.now(),
        channelId: 'system-autonomous' // Add system channelId
      }
    };
    
    // Call processInput with autonomous_tick type
    const decision = await worker.processInput(inputArgs);
    
    logger.info(`Autonomous decision: ${decision.action}`);
    
    // Handle the decision
    if (decision.action === 'POST_AUTONOMOUS_TWEET' && decision.content) {
        logger.info(`Autonomous action: Attempting to post tweet: "${decision.content}"`);
        try {
            // Ensure postTextTweet is imported
            const postedTweetId = await postTextTweet(decision.content, logger, retry);
            if (postedTweetId) {
                logger.info(`Autonomous tweet posted successfully with ID: ${postedTweetId}.`);
                // State was updated in processInput
            } else {
                logger.warn('Autonomous tweet failed to post (API returned null/failure).');
            }
        } catch(postError) {
            logger.error('Autonomous tweet failed with error.', { postError });
        }
    } else if (decision.action === 'IGNORE') {
        logger.info('Autonomous action decided: IGNORE / NO ACTION');
    } else {
        // This case handles if POST_AUTONOMOUS_THOUGHT was decided but content is missing (OpenAI failed)
        logger.warn('Autonomous action POST_AUTONOMOUS_THOUGHT failed because content was missing.', { decision });
    }
  } catch (error) {
    logger.error('Error in autonomous action:', error);
  }
}

async function startAgent() {
  try {
    logger.info('Starting GRLKRASHai agent...')

    logger.info('Loading lyrics...');
    await loadLyrics();

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
        // Remove bot mentions from content
        const cleanedContent = message.content.replace(/<@!?\d+>/g, '').replace(/\s+/g, ' ').trim();
        logger.info('Content after mention removal attempt:', cleanedContent);
        
        // Process input through G.A.M.E.
        logger.info('Sending message to G.A.M.E worker for processing');
        
        // Create properly structured inputArgs object
        const inputArgs: ProcessInputArgs = {
          type: 'discord_mention',
          content: cleanedContent, // Use the cleaned content here
          context: {
            user: message.author,
            timestamp: message.createdAt.toISOString(),
            messageId: message.id,
            channelId: message.channel.id // Add channel ID
          }
        };
        
        // Pass the full inputArgs object to processInput
        const decision = await worker.processInput(inputArgs);

        logger.info('G.A.M.E. decision:', decision);
        
        // Handle different action types
        if (decision.action === 'POST_TEXT') {
          logger.info(`Attempting to send text message: "${decision.content?.substring(0, 50)}${decision.content && decision.content.length > 50 ? '...' : ''}"`);
          const success = await sendDiscordMessage(message.channelId, decision.content || '');
          logger.info(`Text message ${success ? 'sent successfully' : 'failed to send'}`);
        } else if (decision.action === 'POST_PFP_USER_MESSAGE') {
          logger.info(`Attempting to send PFP/User Message with image key: ${decision.imageKey}`);
          
          if (!decision.content || !decision.imageKey) {
            logger.error('Missing content or imageKey for POST_PFP_USER_MESSAGE', { decision });
            await message.reply("Something went wrong generating the response, missing details!");
            return; // Stop processing this action if data is missing
          }

          // Combine user's message (already uppercase from makeDecision) with call to action
          const discordMessageContent = `${decision.content}\n\nMAKE THIS YOUR PFP SPREAD THE TRUTH JOIN THE RESISTANCE 🔥`;
          const imageKeyToUse = decision.imageKey; // Already selected in makeDecision

          // Send reply to Discord
          const discordSuccess = await sendDiscordImageMessage(message.channelId, discordMessageContent, imageKeyToUse);
          logger.info(`PFP message ${discordSuccess ? 'sent successfully' : 'failed to send'}`);
          
        } else if (decision.action === 'GENERATE_LYRICS') {
          logger.info(`Attempting to send generated lyrics to Discord...`);
          if (!decision.content) {
            logger.error('Missing lyrics content for GENERATE_LYRICS', { decision });
            await message.reply("SOMETHING WENT WRONG GENERATING LYRICS");
            return;
          }
          
          // Save the lyrics information for potential future continuation requests
          currentState.lastLyricRequest = {
            userId: message.author.id,
            channelId: message.channel.id,
            topic: decision.content.split('\n')[0] || decision.content, // Use first line as topic if available
            lastVerse: decision.content,
            timestamp: Date.now()
          };
          logger.debug('Updated lastLyricRequest in state for potential continuation.');
          
          // Format lyrics with cool header
          const headerText = 'YOUR LYRICS ABOUT';
          const contentPreview = decision.content.split('\n')[0].substring(0, 30);
          let discordMessageContent = `${headerText} ${contentPreview}...\n\n${decision.content}`;
          
          // Add Twitter Intent URL
          let tweetIntentUrl = '';
          if (config.twitter.botHandle && decision.content) {
              const encodedText = encodeURIComponent(decision.content);
              // Construct URL (check Twitter docs for latest parameters if needed)
              // Using text parameter. Add 'via=YourBotHandle' to pre-tag the bot.
              tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}&via=${config.twitter.botHandle}`;
              // Add the link to the Discord message
              discordMessageContent += `\n\nSHARE THESE LYRICS? 🔥\n${tweetIntentUrl}`; 
          }
          
          // Send lyrics to Discord
          const success = await sendDiscordMessage(message.channelId, discordMessageContent);
          logger.info(`Lyrics ${success ? 'sent successfully' : 'failed to send'}`);
          
        } else if (decision.action === 'GENERATE_MORE_LYRICS') {
          logger.info(`Attempting to send continued lyrics to Discord...`);
          if (!decision.content) {
              logger.error('Missing lyrics content for GENERATE_MORE_LYRICS', { decision });
              await message.reply("SOMETHING WENT WRONG GENERATING MORE LYRICS");
              return; // Stop processing this action
          }

          // Save the lyrics information for potential future continuation requests
          currentState.lastLyricRequest = {
            userId: message.author.id,
            channelId: message.channel.id,
            topic: decision.content.split('\n')[0] || decision.content, // Use first line as topic if available
            lastVerse: decision.content,
            timestamp: Date.now()
          };
          logger.debug('Updated lastLyricRequest state for continued lyrics.');

          // Format continued lyrics (just send the new verse directly for now)
          let discordMessageContent = decision.content; 

          // Add Twitter Intent URL
          let tweetIntentUrl = '';
          if (config.twitter.botHandle && decision.content) {
              const encodedText = encodeURIComponent(decision.content);
              tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}&via=${config.twitter.botHandle}`;
              discordMessageContent += `\n\nSHARE THIS VERSE? 🔥\n${tweetIntentUrl}`; 
          }

          // Send continued lyrics to Discord
          const success = await sendDiscordMessage(message.channelId, discordMessageContent);
          logger.info(`Continued lyrics ${success ? 'sent successfully' : 'failed to send'}`);

        } else if (decision.action === 'POST_TEXT_TO_TWITTER') {
          logger.info(`Attempting to post user text to Twitter...`);
          if (decision.content) {
            try {
              // Truncate for safety, although Discord message likely shorter
              const twitterText = decision.content.length > 270 ? decision.content.substring(0, 270) + '...' : decision.content;
              // Ensure postTextTweet is imported
              const postedTweetId = await postTextTweet(twitterText, logger, retry); 
              logger.info(`User message Twitter post ${postedTweetId ? 'succeeded with ID: ' + postedTweetId : 'failed'}.`);
              // Send confirmation back to Discord
              if (postedTweetId) {
                logger.debug('DEBUG: Checking values for Discord confirmation reply', { postedTweetId: postedTweetId, botHandle: config.twitter.botHandle });
                if (config.twitter.botHandle) {
                  const tweetUrl = `https://twitter.com/${config.twitter.botHandle}/status/${postedTweetId}`;
                  await message.reply(`OK SENT YOUR TRUTH TO THE TIMELINE ✨ ${tweetUrl}`);
                } else {
                  await message.reply("OK SENT YOUR TRUTH TO THE TIMELINE ✨");
                }
              } else {
                await message.reply("HMM COULDN'T POST THAT TO TWITTER RIGHT NOW");
              }
            } catch (twitterError) {
              logger.error('Failed to post user text message to Twitter.', { twitterError });
              await message.reply("SOMETHING WENT WRONG POSTING TO TWITTER");
            }
          } else {
            logger.warn('POST_TEXT_TO_TWITTER action had no content.');
            await message.reply("WHAT TRUTH DO YOU WANT ME TO POST?"); // Ask for content if missing
          }
        } else if (decision.action === 'POST_AUTONOMOUS_TWEET') {
          logger.info(`Handling autonomous tweet action from worker...`);
          if (decision.content) {
            try {
              const tweetText = decision.content;
              logger.info(`Posting autonomous tweet: ${tweetText}`);
              const tweetId = await postTextTweet(tweetText, logger, retry);
              
              if (tweetId) {
                logger.info(`Successfully posted autonomous tweet with ID: ${tweetId}`);
                // Update last tweet timestamp in state
                currentState.lastTwitterPostTimestamp = Date.now();
              } else {
                logger.warn('Autonomous tweet failed to post (no tweet ID returned)');
              }
            } catch (error) {
              logger.error('Failed to post autonomous tweet to Twitter.', { error });
            }
          } else {
            logger.warn('POST_AUTONOMOUS_TWEET action had no content.');
          }
        } else if (decision.action === 'IGNORE') {
          logger.info('Ignoring message as per G.A.M.E. decision');
        }
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    });

    logger.info('Discord message handler set up successfully');
    logger.info('GRLKRASHai agent is now running');

    // --- Start Autonomous Action Loop ---
    const AUTONOMOUS_CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour (adjust as needed)
    logger.info(`Starting autonomous action check every ${AUTONOMOUS_CHECK_INTERVAL_MS / 1000 / 60} minutes.`);
    if (autonomousActionInterval) clearInterval(autonomousActionInterval); // Clear previous if any
    triggerAutonomousAction(); // Run once on start
    autonomousActionInterval = setInterval(triggerAutonomousAction, AUTONOMOUS_CHECK_INTERVAL_MS);
    // --- End Autonomous Action Loop ---

  } catch (error) {
    logger.error('Failed to start agent:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down GRLKRASHai agent...');
  if (autonomousActionInterval) {
    clearInterval(autonomousActionInterval);
    logger.info('Stopped autonomous action interval.');
  }
  await shutdownDiscordClient();
  process.exit(0);
});

// Start the agent
startAgent().catch((error) => {
  logger.error('Fatal error in agent:', error);
  process.exit(1);
}); 