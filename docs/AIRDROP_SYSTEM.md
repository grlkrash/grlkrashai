# Airdrop System Documentation

## Overview
The airdrop system provides two independent paths for users to earn token rewards:
1. Engagement Activities
2. Holder Challenges

Users can qualify for airdrops through either path independently, with a bonus multiplier for participating in both.

## Engagement Path

### Eligibility
- Minimum points required: 100
- Base airdrop amount: 10 tokens
- Point multiplier: 0.1 tokens per point

### Activity Bonuses
Different activities carry different weights:
- Proposal Creation: 2.0x
- Vote Casting: 1.5x
- Daily Activity: 1.2x
- Community Engagement: 1.3x
- Content Creation: 1.8x

### Calculation
```
engagementScore = Σ(activity_count * activity_weight) + (points * pointMultiplier)
```

## Challenge Path

### Eligibility
- Minimum completed challenges: 1
- Base amount: 15 tokens

### Challenge Bonuses
- Completion Multiplier: 1.5x per challenge
- Streak Bonus: 0.1x per day maintained
- Difficulty Multiplier: 0.5x per difficulty level

### Calculation
```
challengeScore = (completions * 1.5 + streak * 0.1 + difficulty * 0.5) * baseAmount
```

## Dual Participation Bonus
Users who qualify through both paths receive a 50% bonus on their total rewards.

### Total Reward Calculation
```
totalReward = 0
if (isEligibleEngagement)
    totalReward += (baseAmount + engagementScore)
if (isEligibleChallenges)
    totalReward += challengeScore
if (bothPathsEligible)
    totalReward *= 1.5
```

## Distribution Schedule
- Frequency: Daily
- Maximum tokens per period: 1000
- If total calculated rewards exceed the maximum, amounts are scaled proportionally

## Integration Points

### Event Listeners
The system listens for various events:
- Governance actions (proposals, votes)
- Social interactions
- Content creation
- Challenge completions
- Daily check-ins

### Smart Contract Integration
- Uses Merkle trees for efficient distribution
- Gas-optimized batch processing
- Automatic retry mechanism for failed distributions

### Security Features
- Rate limiting
- Duplicate prevention
- Sybil resistance through wallet verification
- Activity verification

## Example Scenarios

### Scenario 1: Engagement Only
User with:
- 200 points
- 2 proposals created
- 5 votes cast
```
engagementScore = (2 * 2.0 + 5 * 1.5) + (200 * 0.1)
reward = 10 + engagementScore
```

### Scenario 2: Challenges Only
User with:
- 3 completed challenges
- 5-day streak
- Average difficulty 2
```
challengeScore = (3 * 1.5 + 5 * 0.1 + 2 * 0.5) * 15
reward = challengeScore
```

### Scenario 3: Both Paths
User qualifying for both paths:
```
totalReward = (engagementReward + challengeReward) * 1.5
``` 