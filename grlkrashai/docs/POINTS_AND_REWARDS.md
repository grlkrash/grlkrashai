# Points and Rewards System Documentation

## Overview
The Points and Rewards system tracks user engagement and achievements across the platform, providing incentives for active participation and quality contributions.

## Points System

### Point Sources
1. **Governance Activities**
   - Creating proposals: 100 points
   - Voting on proposals: 10 points
   - Successful proposal execution: 200 points
   - Voting streak bonus: +5 points per consecutive vote

2. **Community Engagement**
   - Daily check-in: 5 points
   - Content creation: 20-50 points
   - Quality comments: 5-15 points
   - Community support: 10-30 points

3. **Holder Challenges**
   - Easy challenges: 50 points
   - Medium challenges: 100 points
   - Hard challenges: 200 points
   - Expert challenges: 500 points
   - Challenge streak bonus: +10% per day

4. **Social Integration**
   - Discord activity: 5-20 points
   - Telegram participation: 5-20 points
   - Cross-platform engagement: 2x multiplier
   - Community event participation: 50-100 points

### Point Multipliers
1. **Token Holding Multipliers**
   - 1,000+ tokens: 1.2x
   - 5,000+ tokens: 1.5x
   - 10,000+ tokens: 2.0x

2. **Activity Streaks**
   - 7 days: 1.1x
   - 30 days: 1.3x
   - 90 days: 1.5x
   - 180 days: 2.0x

3. **Quality Multipliers**
   - Verified content creator: 1.5x
   - Community moderator: 1.3x
   - Expert contributor: 1.4x

## Rewards System

### Token Rewards
1. **Airdrop Eligibility**
   - Engagement path: Based on points
   - Challenge path: Based on completions
   - Dual participation bonus: 50%

2. **Special Rewards**
   - Achievement unlocks
   - Milestone rewards
   - Competition prizes
   - Community recognition rewards

### NFT Rewards
1. **Achievement NFTs**
   - Challenge completion badges
   - Governance participation tokens
   - Community contribution medals
   - Special event commemoratives

2. **NFT Benefits**
   - Voting power boost
   - Point multipliers
   - Access to exclusive challenges
   - Special governance rights

## Achievement System

### Achievement Categories
1. **Governance Master**
   - Proposal Creator
   - Active Voter
   - Community Leader
   - Decision Maker

2. **Challenge Champion**
   - Challenge Starter
   - Streak Maintainer
   - Difficulty Conqueror
   - Challenge Master

3. **Community Builder**
   - Content Creator
   - Helpful Member
   - Event Participant
   - Social Connector

### Achievement Levels
- Bronze: Entry level
- Silver: Intermediate
- Gold: Advanced
- Platinum: Expert
- Diamond: Master

## Point Economy

### Point Decay
- Inactivity penalty: -5% per week
- Minimum point floor: 100 points
- Activity restoration bonus: 2x for first week back

### Point Caps
- Daily earning cap: 1000 points
- Weekly earning cap: 5000 points
- Special event caps: Varies by event
- Challenge points: Uncapped

## Integration

### Event Tracking
```typescript
interface PointEvent {
    userId: string;
    eventType: string;
    points: number;
    multipliers: number[];
    timestamp: Date;
}
```

### Point Calculation
```typescript
totalPoints = basePoints * 
    activityMultiplier * 
    streakMultiplier * 
    qualityMultiplier
```

### Reward Distribution
```typescript
rewardAmount = (baseReward + 
    pointBonus + 
    achievementBonus) * 
    participationMultiplier
```

## Example Scenarios

### Active Community Member
- Daily activities: 50 points
- Quality content: 100 points
- Challenge completion: 200 points
- Streak bonus: 1.3x
- Token holding bonus: 1.2x
```typescript
totalDaily = (350 * 1.3 * 1.2) = 546 points
```

### Challenge Champion
- Hard challenge: 200 points
- Streak bonus: 1.5x
- Expert status: 1.4x
- Achievement bonus: 100 points
```typescript
totalReward = (300 * 1.5 * 1.4) + 100 = 730 points
``` 