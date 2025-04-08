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
  },
  // Add onProcessInput handler for processing mentions and making decisions
  onProcessInput: async (input, state, personality) => {
    // 1. Analyze input data
    const { type, content, context } = input
    const { user, timestamp, tweetId } = context
    
    // 2. Access personality configuration
    const { traits, voice } = personality
    
    // 3. Update world state
    state.lastMentionReceived = {
      userId: user.id,
      userName: user.username,
      tweetId,
      text: content,
      timestamp: Date.now(),
      keywordsFound: extractKeywords(content)
    }
    state.agentStatus = 'PROCESSING'
    state.lastActionTimestamp = Date.now()
    
    // 4. Make decision based on content analysis
    const decision = await makeDecision(content, state, personality)
    
    // 5. If generating content, prepare prompt and call OpenAI
    if (decision.action === 'POST_TEXT' || decision.action === 'POST_MEME') {
      const prompt = generatePrompt(content, state, personality)
      const generatedContent = await generateTextResponse(prompt)
      decision.content = generatedContent
    }
    
    // 6. Return final decision
    return decision
  }
})

// Helper function to extract keywords from content
function extractKeywords(content: string): string[] {
  const keywords = ['meme', 'shill', '$MORE', 'create']
  return keywords.filter(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  )
}

// Helper function to make decision based on content and state
async function makeDecision(
  content: string,
  state: GRLKRASHWorldState,
  personality: any
): Promise<{ action: string; content?: string; imageKey?: string }> {
  const keywords = extractKeywords(content)
  
  if (keywords.includes('meme')) {
    return {
      action: 'POST_MEME',
      imageKey: 'default_meme'
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
  const { traits, voice } = personality
  const { lastMentionReceived } = state
  
  return `As GRLKRASH, a ${traits.confident > 0.7 ? 'confident' : 'humble'} and ${
    traits.adventurous > 0.7 ? 'adventurous' : 'cautious'
  } AI artist, respond to this mention: "${content}" in a ${
    voice.style
  } and ${voice.tone} tone. Keep it ${voice.formality}.`
}

// ... existing code ... 