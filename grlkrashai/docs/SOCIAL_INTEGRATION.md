# Social Integration Documentation

## Overview
The social integration system connects Discord and Telegram platforms with the governance and rewards systems, providing seamless interaction and verification capabilities.

## Platform Integration

### Discord Integration
1. **Bot Commands**
   ```
   /verify-wallet <address>
   /governance propose|vote|list|view
   /challenges list|start|submit
   /points balance|history|leaderboard
   /airdrop status|claim
   ```

2. **Role Management**
   - Token holder roles (based on balance)
   - Achievement roles
   - Challenge completion roles
   - Governance participation roles

3. **Automated Notifications**
   - New proposals
   - Voting reminders
   - Challenge updates
   - Airdrop announcements
   - Achievement unlocks

### Telegram Integration
1. **Bot Commands**
   ```
   /verify_wallet <address>
   /propose|vote|proposals
   /challenges|submit
   /points|leaderboard
   /airdrop_status|claim
   ```

2. **Group Features**
   - Automated announcements
   - Voting notifications
   - Challenge updates
   - Community polls
   - Achievement broadcasts

## Account Verification

### Wallet Verification
```typescript
interface VerificationRequest {
    userId: string;
    platform: 'discord' | 'telegram';
    walletAddress: string;
    timestamp: Date;
    signature: string;
}
```

### Verification Process
1. User initiates verification
2. System generates unique message
3. User signs with wallet
4. System verifies signature
5. Account is linked

### Cross-Platform Linking
- One wallet per social account
- Cross-platform activity tracking
- Unified point system
- Shared achievements

## Activity Tracking

### Monitored Activities
1. **Message Activity**
   - Quality contributions
   - Help and support
   - Community engagement
   - Content creation

2. **Command Usage**
   - Governance participation
   - Challenge interactions
   - Point checking
   - Reward claims

3. **Reaction Tracking**
   - Positive engagement
   - Content quality rating
   - Community support
   - Achievement celebrations

### Activity Weights
```typescript
interface ActivityWeight {
    type: string;
    basePoints: number;
    qualityMultiplier: number;
    platformMultiplier: number;
}
```

## Natural Language Processing

### Command Processing
1. **Proposal Creation**
   ```
   "I want to propose we add a new challenge system"
   → Parsed into structured proposal
   ```

2. **Voting**
   ```
   "I support proposal #123 because it improves the system"
   → Translated to formal vote
   ```

3. **Challenge Submission**
   ```
   "I've completed the trading challenge with 5 successful trades"
   → Formatted submission
   ```

### Response Generation
- Context-aware replies
- Multi-language support
- Helpful suggestions
- Error explanations

## Security Measures

### Anti-Spam Protection
- Rate limiting
- Content filtering
- Duplicate detection
- User reputation scoring

### Account Protection
- Two-factor authentication
- Suspicious activity detection
- IP tracking
- Account recovery process

## Event System

### Platform Events
```typescript
interface SocialEvent {
    platform: string;
    eventType: string;
    userId: string;
    content: any;
    metadata: {
        channelId: string;
        timestamp: Date;
        context: any;
    }
}
```

### Event Handlers
1. **Command Events**
   - Command validation
   - Permission checking
   - Execution tracking
   - Response formatting

2. **Activity Events**
   - Point calculation
   - Achievement checking
   - Challenge progress
   - Reward distribution

## Integration Examples

### User Verification Flow
```typescript
async function verifyUser(
    userId: string,
    platform: string,
    walletAddress: string
): Promise<VerificationResult>
```

### Cross-Platform Activity
```typescript
async function trackActivity(
    userId: string,
    platform: string,
    activity: ActivityType
): Promise<void>
```

### Command Processing
```typescript
async function processNaturalCommand(
    text: string,
    context: CommandContext
): Promise<CommandResult>
```

## Error Handling

### Common Errors
1. **Verification Errors**
   - Invalid signature
   - Already verified
   - Rate limited

2. **Command Errors**
   - Invalid format
   - Insufficient permissions
   - Rate limited

3. **Activity Errors**
   - Spam detection
   - Invalid content
   - System overload

### Error Responses
- Clear error messages
- Helpful suggestions
- Recovery instructions
- Support contact info 