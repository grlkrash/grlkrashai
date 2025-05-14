/**
 * Neynar Service for Farcaster API interactions
 * 
 * This service provides functions to interact with the Farcaster network
 * through the Neynar API using the official Node.js SDK.
 */

import { NeynarAPIClient, Configuration, isApiErrorResponse } from '@neynar/nodejs-sdk'
import { FeedType, FilterType } from '@neynar/nodejs-sdk/build/api/index.js'
import { config } from '../../config.js'
import logger from '../../utils/logger.js'

// Configuration validation
if (!config.farcaster?.neynarApiKey) {
  logger.error('Missing Neynar API key in config. Farcaster features will fail.')
}

if (!config.farcaster?.signerUuid) {
  logger.error('Missing signer UUID in config. Farcaster posting will fail.')
}

// Initialize client only if API key is available
const client = config.farcaster?.neynarApiKey
  ? new NeynarAPIClient(new Configuration({ apiKey: config.farcaster.neynarApiKey }))
  : null

const neynarSignerUuid = config.farcaster?.signerUuid

// Farcaster byte limits
const MAX_CAST_LENGTH_BYTES = 320

interface Embed {
  url: string
}

interface CastOptions {
  channelId?: string
  replyToHash?: string
  replyToFid?: number
  embeds?: Embed[]
}

interface RequestSummary {
  signerUuidPrefix: string
  textLength: number
  options: string[]
}

interface Mention {
  hash: string
  text: string
  authorFid: number
  authorUsername: string
  timestamp: number
}

/**
 * Post a new cast to Farcaster
 * @param text - Cast text content
 * @param options - Additional options for the cast
 * @returns Cast hash if successful, null otherwise
 */
async function postCast(
  text: string, 
  { channelId = undefined, replyToHash = undefined, replyToFid = undefined, embeds = [] }: CastOptions = {}
): Promise<string | null> {
  // Early return if client or signerUuid is missing
  if (!client || !neynarSignerUuid) {
    logger.error('Cannot post cast: Neynar client or signer UUID is not available')
    return null
  }

  // Log intent with context
  const logText = text.replace(/\n/g, ' ').slice(0, 50) + (text.length > 50 ? '...' : '')
  const contextInfo = [
    channelId ? `to channel ${channelId}` : '',
    replyToHash ? `as reply to ${replyToHash}` : '',
    replyToFid ? `as reply to FID ${replyToFid}` : ''
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

  try {
    // Prepare parameters for publishCast
    const optionsForNeynar = {
      signerUuid: neynarSignerUuid,
      text: castText,
      ...(replyToHash ? { parent: replyToHash } : {}),
      ...(replyToHash && replyToFid ? { parentAuthorFid: replyToFid } : {}),
      ...(!replyToHash && channelId ? { channelId } : {}),
      ...(embeds && embeds.length > 0 ? { embeds } : {})
    }
    
    logger.debug('[NeynarSDK call] client.publishCast with options:', optionsForNeynar)
    
    const response = await client.publishCast(optionsForNeynar)
    
    // Check for a successful response with hash
    if (response && response.success && response.cast && response.cast.hash) {
      logger.info(`Cast published successfully with hash: ${response.cast.hash}`)
      return response.cast.hash
    } else {
      logger.error(`Cast published but missing hash in response: ${JSON.stringify(response)}`)
      return null
    }
  } catch (error: any) {
    const requestSummary: RequestSummary = {
      signerUuidPrefix: neynarSignerUuid ? `${neynarSignerUuid.substring(0, 6)}...` : 'undefined',
      textLength: text.length,
      options: [
        ...(channelId ? ['channelId'] : []),
        ...(replyToHash ? ['replyTo'] : []),
        ...(replyToFid ? ['replyToFid'] : []),
        ...(embeds && embeds.length > 0 ? ['embeds'] : [])
      ]
    }
    
    if (isApiErrorResponse(error)) {
      logger.error(
        `Failed to post cast (API Error): ${error.message}`,
        {
          status: error.status,
          apiError: error.response?.data,
          requestData: requestSummary
        }
      )
    } else {
      logger.error(
        `Failed to post cast (Generic Error): ${error.message}`,
        { requestData: requestSummary }
      )
    }
    return null
  }
}

/**
 * Fetch a user's profile by their fid or username
 * @param identifier - FID or username of the user
 * @param viewerFid - Optional FID of the viewer for relationship context
 * @returns User profile data or null on error
 */
async function fetchUser(identifier: string | number, viewerFid?: number): Promise<any | null> {
  if (!client) {
    logger.error('Cannot fetch user: Neynar client is not available')
    return null
  }

  try {
    let response
    if (isNaN(Number(identifier))) {
      // If identifier is a username
      response = await client.lookupUserByUsername({ 
        username: identifier.toString(), 
        viewerFid 
      })
      return response.user
    } else {
      // If identifier is an FID, use fetchBulkUsers with a single FID
      response = await client.fetchBulkUsers({ 
        fids: [Number(identifier)],
        viewerFid
      })
      return response.users && response.users.length > 0 ? response.users[0] : null
    }
  } catch (error: any) {
    if (isApiErrorResponse(error)) {
      logger.error(
        `Failed to fetch user ${identifier} (API Error): ${error.message}`,
        {
          status: error.status,
          apiError: error.response?.data
        }
      )
    } else {
      logger.error(`Error fetching user ${identifier}: ${error.message}`)
    }
    return null
  }
}

/**
 * Fetch recent casts from a specific user
 * @param fid - FID of the user
 * @param limit - Number of casts to retrieve (default: 25)
 * @param cursor - Pagination cursor
 * @param viewerFid - Optional FID of the viewer for relationship context
 * @returns Object containing casts and pagination cursor, or null on error
 */
async function fetchUserCasts(
  fid: number, 
  limit: number = 25, 
  cursor?: string, 
  viewerFid?: number
): Promise<{ casts: Array<any>, nextCursor: string | null } | null> {
  if (!client) {
    logger.error('Cannot fetch casts: Neynar client is not available')
    return null
  }

  try {
    const response = await client.fetchFeed({
      feedType: FeedType.Filter,
      filterType: FilterType.Fids,
      fids: fid.toString(), // Convert number to string since the API expects string
      limit,
      cursor,
      viewerFid
    })
    
    if (response && response.casts) {
      return { 
        casts: response.casts, 
        nextCursor: response.next?.cursor || null 
      }
    } else {
      logger.warn(`Fetched casts for user ${fid} but received unexpected response structure`)
      return { casts: [], nextCursor: null }
    }
  } catch (error: any) {
    if (isApiErrorResponse(error)) {
      logger.error(
        `Failed to fetch casts for user ${fid} (API Error): ${error.message}`,
        {
          status: error.status,
          apiError: error.response?.data
        }
      )
    } else {
      logger.error(`Error fetching casts for user ${fid}: ${error.message}`)
    }
    return null
  }
}

/**
 * Fetch new mentions for a specific user's FID
 * @param fid - FID of the user to fetch mentions for
 * @param cursor - Pagination cursor for notifications
 * @returns Object containing mentions and pagination cursor
 */
async function fetchNewMentions(
  fid: number,
  cursor?: string
): Promise<{ mentions: Mention[], nextCursor: string | null }> {
  if (!client) {
    logger.error('Cannot fetch mentions: Neynar client is not available')
    return { mentions: [], nextCursor: null }
  }

  logger.info(`Fetching Farcaster notifications for FID: ${fid} with cursor: ${cursor || 'start'}`)

  try {
    const response = await client.fetchAllNotifications({
      fid,
      limit: 25,
      cursor
    })
    
    const newMentions: Mention[] = []
    
    if (response && response.notifications) {
      for (const notification of response.notifications) {
        // Check if this is a mention notification
        if (notification.type === 'mention' && notification.cast) {
          const cast = notification.cast
          
          if (cast.hash && cast.text && cast.author) {
            newMentions.push({
              hash: cast.hash,
              text: cast.text,
              authorFid: cast.author.fid,
              authorUsername: cast.author.username,
              timestamp: typeof cast.timestamp === 'string' 
                ? Math.floor(Date.parse(cast.timestamp) / 1000) 
                : cast.timestamp
            })
          }
        }
      }
    }
    
    logger.info(`Found ${newMentions.length} new mentions for FID ${fid}`)
    
    return {
      mentions: newMentions,
      nextCursor: response.next?.cursor || null
    }
  } catch (error: any) {
    if (isApiErrorResponse(error)) {
      logger.error(
        `Failed to fetch mentions for FID ${fid} (API Error): ${error.message}`,
        {
          status: error.status,
          apiError: error.response?.data
        }
      )
    } else {
      logger.error(`Error fetching mentions for FID ${fid}: ${error.message}`)
    }
    
    return { mentions: [], nextCursor: cursor || null }
  }
}

export {
  postCast,
  fetchUser,
  fetchUserCasts,
  fetchNewMentions
} 