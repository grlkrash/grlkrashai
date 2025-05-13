/**
 * Neynar Service for Farcaster API interactions
 * 
 * This service provides functions to interact with the Farcaster network
 * through the Neynar API using the official Node.js SDK.
 */

import { NeynarAPIClient } from '@neynar/nodejs-sdk'
import { config } from '../../config.js'
import { logger } from '../../utils/logger.js'

// Configuration validation
if (!config.farcaster?.neynarApiKey) {
  logger.error('Missing Neynar API key in config. Farcaster features will fail.')
}

if (!config.farcaster?.signerUuid) {
  logger.error('Missing signer UUID in config. Farcaster posting will fail.')
}

// Initialize client only if API key is available
const client = config.farcaster?.neynarApiKey
  ? new NeynarAPIClient(config.farcaster.neynarApiKey)
  : null

const signerUuid = config.farcaster?.signerUuid

// Farcaster byte limits
const MAX_CAST_LENGTH_BYTES = 320

/**
 * Post a new cast to Farcaster
 * @param {string} text - Cast text content
 * @param {Object} options - Additional options for the cast
 * @param {string} [options.channelId] - Channel ID to post to
 * @param {string} [options.replyToHash] - Hash of cast to reply to
 * @param {Array} [options.embeds] - Optional embeds for the cast
 * @returns {Promise<string|null>} Cast hash if successful, null otherwise
 */
async function postCast(text, { channelId = undefined, replyToHash = undefined, embeds = [] } = {}) {
  // Early return if client or signerUuid is missing
  if (!client || !signerUuid) {
    logger.error('Cannot post cast: Neynar client or signer UUID is not available')
    return null
  }

  // Log intent with context
  const logText = text.replace(/\n/g, ' ').slice(0, 50) + (text.length > 50 ? '...' : '')
  const contextInfo = [
    channelId ? `to channel ${channelId}` : '',
    replyToHash ? `as reply to ${replyToHash}` : ''
  ].filter(Boolean).join(' ')
  
  logger.info(`Casting: '${logText}'${contextInfo ? ` ${contextInfo}` : ''}`)

  // Handle text truncation for Farcaster's byte limit
  let castText = text
  if (Buffer.byteLength(castText, 'utf8') > MAX_CAST_LENGTH_BYTES) {
    logger.warn(`Cast text exceeds ${MAX_CAST_LENGTH_BYTES} bytes limit, truncating`)
    
    const textBuffer = Buffer.from(castText, 'utf8')
    castText = textBuffer.slice(0, MAX_CAST_LENGTH_BYTES).toString('utf8')
    
    // Ensure we're strictly under the byte limit
    while (Buffer.byteLength(castText, 'utf8') > MAX_CAST_LENGTH_BYTES) {
      castText = castText.slice(0, -1)
    }
    
    logger.warn(`Truncated to ${Buffer.byteLength(castText, 'utf8')} bytes: '${castText.replace(/\n/g, ' ').slice(0, 50)}${castText.length > 50 ? '...' : ''}'`)
  }

  // Prepare cast options
  const neynarCastOptions = {}
  
  if (channelId) neynarCastOptions.channelId = channelId
  if (replyToHash) neynarCastOptions.replyTo = replyToHash
  if (embeds && embeds.length > 0) neynarCastOptions.embeds = embeds

  try {
    const response = await client.publishCast(signerUuid, castText, neynarCastOptions)
    
    if (response.hash) {
      logger.info(`Cast published successfully with hash: ${response.hash}`)
      return response.hash
    } else {
      logger.error(`Cast published but missing hash in response: ${JSON.stringify(response)}`)
      return null
    }
  } catch (error) {
    const requestSummary = {
      signerUuidPrefix: signerUuid ? `${signerUuid.substring(0, 6)}...` : 'undefined',
      textLength: text.length,
      options: Object.keys(neynarCastOptions)
    }
    
    logger.error(
      `Failed to post cast: ${error.message}`,
      {
        status: error.response?.status,
        apiError: error.response?.data,
        requestData: requestSummary
      }
    )
    return null
  }
}

/**
 * Fetch a user's profile by their fid or username
 * @param {string|number} identifier - FID or username of the user
 * @returns {Promise<Object|null>} User profile data or null on error
 */
async function fetchUser(identifier) {
  if (!client) {
    logger.error('Cannot fetch user: Neynar client is not available')
    return null
  }

  try {
    const response = isNaN(identifier)
      ? await client.lookupUserByUsername(identifier)
      : await client.lookupUserByFid(identifier)
    
    return response.user
  } catch (error) {
    logger.error(`Error fetching user ${identifier}: ${error.message}`)
    return null
  }
}

/**
 * Fetch recent casts from a specific user
 * @param {string|number} fid - FID of the user
 * @param {number} [limit=20] - Number of casts to retrieve
 * @returns {Promise<Array|null>} Casts data or null on error
 */
async function fetchUserCasts(fid, limit = 20) {
  if (!client) {
    logger.error('Cannot fetch casts: Neynar client is not available')
    return null
  }

  try {
    const response = await client.fetchAllCastsCreatedByUser(fid, { limit })
    return response.casts
  } catch (error) {
    logger.error(`Error fetching casts for user ${fid}: ${error.message}`)
    return null
  }
}

export {
  postCast,
  fetchUser,
  fetchUserCasts
} 