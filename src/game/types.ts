export interface GRLKRASHWorldState {
  lastMentionReceived?: {
    userId: string
    userName: string
    messageId: string
    text: string
    timestamp: number
    keywordsFound: string[]
  }
  lastLyricRequest?: {
    userId: string;
    channelId: string;
    topic: string;
    lastVerse: string;
    timestamp: number;
  };
  agentStatus: 'IDLE' | 'PROCESSING' | 'RESPONDING'
  lastActionTimestamp?: number
  lastTwitterPostTimestamp?: number
  lastAutonomousActionType?: string | null
  lastFarcasterNotificationCursor?: string | null
  processedFarcasterMentionHashes: string[]
  currentTime: Date
}

export const initialWorldState: GRLKRASHWorldState = {
  agentStatus: 'IDLE',
  currentTime: new Date(),
  lastMentionReceived: undefined,
  lastLyricRequest: undefined,
  lastActionTimestamp: undefined,
  lastTwitterPostTimestamp: undefined,
  lastAutonomousActionType: null,
  lastFarcasterNotificationCursor: null,
  processedFarcasterMentionHashes: []
} 