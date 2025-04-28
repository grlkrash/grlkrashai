export interface GRLKRASHWorldState {
  lastMentionReceived?: {
    userId: string
    userName: string
    tweetId: string
    text: string
    timestamp: number
    keywordsFound: string[]
  }
  agentStatus: 'IDLE' | 'PROCESSING' | 'RESPONDING'
  lastActionTimestamp?: number
  currentTime: Date
}

export const initialWorldState: GRLKRASHWorldState = {
  agentStatus: 'IDLE',
  currentTime: new Date(),
  lastMentionReceived: undefined,
  lastActionTimestamp: undefined
} 