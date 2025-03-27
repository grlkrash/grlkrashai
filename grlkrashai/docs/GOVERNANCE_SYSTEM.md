# Governance System Documentation

## Overview
The governance system enables token holders to participate in decision-making through proposals and voting. The system includes anti-manipulation measures, rewards for participation, and integration with social platforms.

## Proposal Creation

### Eligibility Requirements
- Minimum token holding: 1000 MORE tokens
- Account verification required
- No suspicious activity flags

### Proposal Types
1. Standard Proposals
   - Title and description
   - Optional execution data
   - 7-day voting period

2. Natural Language Proposals
   - AI-processed text input
   - Automatic formatting
   - Same validation rules as standard proposals

## Voting System

### Eligibility
- Minimum token holding: 100 MORE tokens
- Account verification required
- Minimum holding period: 7 days

### Voting Power Calculation
Base voting power is modified by:
- Token balance (1:1)
- Social verification bonus (+20%)
- KYC verification bonus (+30%)
- Holding time bonus (up to +50%)
- NFT bonus (varies by NFT type)

### Voting Methods
1. Standard Voting
   ```
   /vote <proposal_id> <yes/no>
   ```

2. Natural Language Voting
   ```
   /vote_natural "I support proposal #123 because..."
   ```

## Security Measures

### Identity Verification
1. Wallet Verification
   - Signature-based ownership proof
   - One wallet per user account

2. Social Account Verification
   - Discord/Telegram account age check
   - Activity level verification
   - Optional KYC integration

### Anti-Manipulation
1. Vote Restrictions
   - One vote per proposal
   - No self-voting on own proposals
   - Rate limiting (max 3 votes/5 minutes)

2. Suspicious Activity Detection
   - Pattern analysis
   - Automated flagging
   - Progressive penalties

## Integration Points

### Social Platforms
1. Discord Commands
   ```
   /governance propose
   /governance vote
   /governance list
   /governance view
   ```

2. Telegram Commands
   ```
   /propose
   /vote
   /proposals
   /proposal <id>
   ```

### Event System
- proposalCreated
- voteCast
- proposalFinalized
- proposalExecuted
- suspiciousActivityDetected

## Rewards and Incentives

### Proposal Creation
- Base reward: 100 points
- Bonus for successful proposals
- Achievement tracking

### Voting Participation
- Base reward: 10 points
- Streak bonuses
- Special achievements

## Technical Implementation

### Smart Contract Integration
- Proposal storage
- Vote recording
- Execution handling
- Token balance checks

### Data Storage
- Proposal details
- Voting history
- User verification status
- Activity tracking

### Security Features
- Rate limiting
- Duplicate prevention
- Sybil resistance
- Activity verification

## Example Workflows

### Creating a Proposal
1. User initiates proposal command
2. System checks eligibility
3. Proposal is created and stored
4. Event is emitted
5. Notifications are sent

### Casting a Vote
1. User initiates vote command
2. System verifies eligibility
3. Calculates voting power
4. Records vote
5. Updates proposal status
6. Awards points

### Proposal Execution
1. Voting period ends
2. System calculates results
3. If passed, executes proposal
4. Emits completion event
5. Distributes rewards 