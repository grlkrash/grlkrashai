# API Documentation

## Overview
This documentation covers all available API endpoints and services for the platform, including authentication, rate limiting, and integration guidelines.

## Authentication

### Wallet Authentication
```typescript
POST /api/auth/wallet
{
    "address": string,
    "signature": string,
    "message": string,
    "nonce": string
}
```

### Social Authentication
```typescript
POST /api/auth/social
{
    "platform": "discord" | "telegram",
    "userId": string,
    "accessToken": string
}
```

## Governance API

### Proposals
```typescript
// Create proposal
POST /api/governance/proposals
{
    "title": string,
    "description": string,
    "executionData": string
}

// Get proposals
GET /api/governance/proposals
?status=active|passed|failed
&page=number
&limit=number

// Get proposal details
GET /api/governance/proposals/:id

// Cast vote
POST /api/governance/proposals/:id/vote
{
    "support": boolean,
    "reason": string
}
```

### Voting Power
```typescript
// Get voting power
GET /api/governance/voting-power/:address

// Get voting history
GET /api/governance/voting-history/:address
```

## Challenge API

### Challenge Management
```typescript
// Get available challenges
GET /api/challenges
?difficulty=easy|medium|hard|expert
&type=trading|holder|community
&status=active|completed

// Start challenge
POST /api/challenges/:id/start

// Submit challenge completion
POST /api/challenges/:id/complete
{
    "proof": ProofData,
    "metrics": MetricsData
}

// Get challenge progress
GET /api/challenges/:id/progress
```

### Challenge Verification
```typescript
// Verify challenge proof
POST /api/challenges/verify
{
    "challengeId": string,
    "proofData": ProofData
}

// Get verification status
GET /api/challenges/verify/:verificationId
```

## Airdrop API

### Distribution
```typescript
// Get airdrop eligibility
GET /api/airdrops/eligibility/:address

// Claim airdrop
POST /api/airdrops/claim
{
    "proof": MerkleProof,
    "amount": number
}

// Get airdrop history
GET /api/airdrops/history/:address
```

### Merkle Proofs
```typescript
// Get merkle proof
GET /api/airdrops/proof/:address

// Verify merkle proof
POST /api/airdrops/verify-proof
{
    "address": string,
    "amount": number,
    "proof": string[]
}
```

## Points and Rewards API

### Points
```typescript
// Get user points
GET /api/points/:userId

// Get points history
GET /api/points/:userId/history
?type=earned|spent
&page=number

// Get leaderboard
GET /api/points/leaderboard
?timeframe=daily|weekly|monthly|all-time
```

### Rewards
```typescript
// Get available rewards
GET /api/rewards
?type=token|nft|achievement

// Claim reward
POST /api/rewards/:id/claim

// Get reward history
GET /api/rewards/history/:userId
```

## Social Integration API

### Discord
```typescript
// Link Discord account
POST /api/social/discord/link
{
    "discordId": string,
    "accessToken": string
}

// Get Discord activity
GET /api/social/discord/activity/:userId
```

### Telegram
```typescript
// Link Telegram account
POST /api/social/telegram/link
{
    "telegramId": string,
    "accessToken": string
}

// Get Telegram activity
GET /api/social/telegram/activity/:userId
```

## Content API

### Content Management
```typescript
// Create content
POST /api/content
{
    "type": ContentType,
    "title": string,
    "body": string,
    "tags": string[]
}

// Get content
GET /api/content/:id

// Update content
PUT /api/content/:id

// Delete content
DELETE /api/content/:id
```

### Content Interaction
```typescript
// Rate content
POST /api/content/:id/rate
{
    "rating": number,
    "feedback": string
}

// Get content stats
GET /api/content/:id/stats
```

## WebSocket API

### Real-time Updates
```typescript
// Connect to WebSocket
ws://api/websocket?token=JWT

// Subscribe to events
{
    "type": "subscribe",
    "channels": [
        "governance",
        "challenges",
        "airdrops",
        "points"
    ]
}
```

### Event Types
```typescript
interface WebSocketEvent {
    type: EventType;
    data: any;
    timestamp: number;
}

type EventType =
    | 'proposal_created'
    | 'vote_cast'
    | 'challenge_completed'
    | 'airdrop_claimed'
    | 'points_earned';
```

## Rate Limiting

### Limits
- Authentication: 5 requests/minute
- Governance: 10 requests/minute
- Challenges: 20 requests/minute
- Content: 30 requests/minute
- Points: 30 requests/minute

### Headers
```
X-RateLimit-Limit: max requests
X-RateLimit-Remaining: remaining requests
X-RateLimit-Reset: reset timestamp
```

## Error Handling

### Error Format
```typescript
interface ApiError {
    code: number;
    message: string;
    details?: any;
    timestamp: number;
}
```

### Common Error Codes
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

## Integration Guidelines

### Authentication Flow
1. Generate nonce
2. Sign message with wallet
3. Verify signature
4. Receive JWT token
5. Use token in Authorization header

### WebSocket Connection
1. Establish connection with JWT
2. Subscribe to relevant channels
3. Handle incoming events
4. Implement reconnection logic
5. Handle errors appropriately

### Best Practices
1. Implement proper error handling
2. Respect rate limits
3. Use pagination for large datasets
4. Cache responses when appropriate
5. Implement retry logic with backoff 