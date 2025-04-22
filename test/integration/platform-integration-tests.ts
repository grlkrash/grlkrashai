import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { TokenMockGenerator } from '../utils/token-mock-generator';
import { 
    SpotifyService, 
    TwitterService, 
    DiscordService,
    TokenDistributionService,
    ContractService
} from '../../src/services';

describe('Platform Integration Tests', () => {
    let spotifyService: SpotifyService;
    let twitterService: TwitterService;
    let discordService: DiscordService;
    let tokenDistribution: TokenDistributionService;
    let contractService: ContractService;
    let testData: any;

    before(async () => {
        spotifyService = new SpotifyService();
        twitterService = new TwitterService();
        discordService = new DiscordService();
        tokenDistribution = new TokenDistributionService();
        contractService = new ContractService();
        testData = {
            wallet: await TokenMockGenerator.generateWallet(),
            milestone: TokenMockGenerator.generateMilestone(),
            distribution: TokenMockGenerator.generateDistributionEvent()
        };
    });

    describe('Spotify Integration', () => {
        it('should verify listener milestones and trigger rewards', async () => {
            const listenerData = {
                userId: 'test_user',
                monthlyListeners: 15000,
                trackPlays: 50000,
                uniqueListeners: 10000
            };
            
            const result = await spotifyService.verifyAndRewardMilestone(
                listenerData,
                testData.wallet.address
            );
            
            expect(result.verified).to.be.true;
            expect(result.rewardAmount).to.be.gt(0);
            
            const distribution = await tokenDistribution.getDistributionHistory(
                testData.wallet.address
            );
            expect(distribution).to.have.length.gt(0);
        });

        it('should handle playlist addition rewards', async () => {
            const playlistData = {
                playlistId: 'test_playlist',
                followers: 5000,
                trackPosition: 1
            };
            
            const result = await spotifyService.handlePlaylistAddition(
                playlistData,
                testData.wallet.address
            );
            
            expect(result.success).to.be.true;
            expect(result.reward).to.exist;
        });
    });

    describe('Twitter Integration', () => {
        it('should verify viral tweet engagement and distribute rewards', async () => {
            const tweetData = {
                tweetId: 'test_tweet',
                likes: 10000,
                retweets: 5000,
                replies: 1000,
                impressions: 100000
            };
            
            const result = await twitterService.processViralTweet(
                tweetData,
                testData.wallet.address
            );
            
            expect(result.qualified).to.be.true;
            expect(result.rewardTier).to.be.gt(0);
            
            const reward = await tokenDistribution.getRewardForEngagement(
                result.rewardTier
            );
            expect(reward).to.be.gt(0);
        });

        it('should track community engagement streaks', async () => {
            const engagementData = {
                userId: 'test_user',
                dailyTweets: 3,
                weeklyEngagement: 1000,
                streak: 7
            };
            
            const result = await twitterService.processEngagementStreak(
                engagementData,
                testData.wallet.address
            );
            
            expect(result.streakValid).to.be.true;
            expect(result.multiplier).to.be.gt(1);
        });
    });

    describe('Discord Integration', () => {
        it('should process community contributions', async () => {
            const contributionData = {
                userId: 'test_user',
                messageCount: 100,
                helpfulResponses: 20,
                reactions: 500
            };
            
            const result = await discordService.processContributions(
                contributionData,
                testData.wallet.address
            );
            
            expect(result.score).to.be.gt(0);
            expect(result.rewards).to.exist;
        });

        it('should handle role-based achievements', async () => {
            const roleData = {
                userId: 'test_user',
                role: 'community_leader',
                duration: 30, // days
                activity: 0.8 // 80% active
            };
            
            const result = await discordService.processRoleAchievement(
                roleData,
                testData.wallet.address
            );
            
            expect(result.qualified).to.be.true;
            expect(result.bonus).to.be.gt(0);
        });
    });

    describe('Cross-Platform Synergy', () => {
        it('should calculate combined engagement multiplier', async () => {
            const platformData = {
                spotify: { monthlyListeners: 10000 },
                twitter: { followers: 5000 },
                discord: { contributionScore: 800 }
            };
            
            const result = await tokenDistribution.calculatePlatformMultiplier(
                platformData,
                testData.wallet.address
            );
            
            expect(result.multiplier).to.be.gt(1);
            expect(result.bonusFactors).to.have.length.gt(0);
        });

        it('should handle multi-platform milestone achievements', async () => {
            const milestoneData = {
                spotify: { achieved: true, value: 12000 },
                twitter: { achieved: true, value: 6000 },
                discord: { achieved: true, value: 1000 }
            };
            
            const result = await tokenDistribution.processCrossPlatformMilestone(
                milestoneData,
                testData.wallet.address
            );
            
            expect(result.allAchieved).to.be.true;
            expect(result.bonusReward).to.be.gt(0);
        });
    });

    describe('Platform Data Validation', () => {
        it('should detect and prevent reward gaming', async () => {
            const suspiciousData = {
                spotify: { suddenIncrease: 50000 },
                twitter: { botLikeActivity: true },
                discord: { spamScore: 0.8 }
            };
            
            const result = await tokenDistribution.validateEngagementAuthenticity(
                suspiciousData,
                testData.wallet.address
            );
            
            expect(result.valid).to.be.false;
            expect(result.flags).to.have.length.gt(0);
        });

        it('should validate cross-platform consistency', async () => {
            const userData = {
                spotify: { username: 'test_user', followers: 5000 },
                twitter: { handle: '@test_user', followers: 5200 },
                discord: { id: 'test_user#1234', reputation: 800 }
            };
            
            const result = await tokenDistribution.validateUserConsistency(
                userData,
                testData.wallet.address
            );
            
            expect(result.consistent).to.be.true;
            expect(result.confidenceScore).to.be.gt(0.8);
        });
    });
}); 