import { OpenAI } from 'openai'
import 'dotenv/config'
import logger from '../../utils/logger.js'
import { retry } from '../../utils/retry.js'

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
})

// Validate API key
if (!process.env.OPENAI_API_KEY) {
  logger.error('OpenAI API Key not found in environment variables!')
  throw new Error('OpenAI API Key missing')
}

logger.info('OpenAI client initialized successfully')

export async function generateTextResponse(prompt: string): Promise<string> {
  logger.info('Generating text response', { 
    prompt: prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt 
  })

  try {
    return await retry(3, async () => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      })

      const resultText = completion.choices[0]?.message?.content
      
      if (!resultText) {
        throw new Error('OpenAI returned an empty response')
      }

      logger.info('Successfully generated text response')
      return resultText
    }, 1000)
  } catch (error) {
    logger.error('Error generating text response from OpenAI', { error })
    return '// Unable to generate response //'
  }
} 