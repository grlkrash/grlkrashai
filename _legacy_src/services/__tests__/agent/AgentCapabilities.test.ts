import { IAgentRuntime } from '@elizaos/core';
import { ContentService } from '../../content/ContentService';
import { MusicPromotionService } from '../../promotion/MusicPromotionService';
import { TokenDistributionService } from '../../rewards/TokenDistributionService';
import { WalletVerificationService } from '../../auth/WalletVerificationService';

describe('Agent Capabilities Tests', () => {
    let mockRuntime: jest.Mocked<IAgentRuntime>;
    let contentService: ContentService;
    let promotionService: MusicPromotionService;
    let tokenService: TokenDistributionService;
    let walletService: WalletVerificationService;

    beforeEach(() => {
        mockRuntime = {
            // Add mock implementation
        } as unknown as jest.Mocked<IAgentRuntime>;

        contentService = new ContentService(mockRuntime);
        promotionService = new MusicPromotionService(mockRuntime);
        tokenService = new TokenDistributionService(mockRuntime);
        walletService = new WalletVerificationService('redis://localhost:6379', 'test-jwt-secret');
    });

    describe('Content Creation and Promotion', () => {
        test('should create and promote content across platforms', async () => {
            // Test content creation
            const content = await contentService.generateContent({
                type: 'music',
                platform: 'all',
                requirements: {
                    length: 'short',
                    style: 'viral'
                }
            });

            expect(content).toBeDefined();

            // Test promotion strategy
            const strategy = await promotionService.generateStrategy(content);
            expect(strategy).toHaveProperty('platforms');
            expect(strategy).toHaveProperty('schedule');
        });

        test('should track content performance', async () => {
            const metrics = await contentService.analyzeContent('test-content', ['instagram', 'tiktok']);
            expect(metrics).toBeDefined();
            expect(metrics).toHaveProperty('engagement');
        });
    });

    describe('Token Distribution', () => {
        test('should calculate rewards based on engagement', async () => {
            const userActivity = {
                contentCreated: 5,
                engagementRate: 0.8,
                challengesCompleted: 3
            };

            const rewards = await tokenService.calculateRewards('test-user', userActivity);
            expect(rewards).toBeGreaterThan(0);
        });

        test('should handle airdrop distribution', async () => {
            const eligibleUsers = [
                { id: 'user1', score: 100 },
                { id: 'user2', score: 150 }
            ];

            const distribution = await tokenService.processAirdrop(eligibleUsers);
            expect(distribution).toHaveLength(2);
            expect(distribution[0]).toHaveProperty('amount');
        });
    });

    describe('Challenge System', () => {
        test('should verify challenge completion', async () => {
            const challengeData = {
                userId: 'test-user',
                challengeId: 'test-challenge',
                proof: {
                    type: 'social',
                    data: { postId: '123', engagement: 500 }
                }
            };

            const verification = await tokenService.verifyChallengeCompletion(challengeData);
            expect(verification.success).toBe(true);
        });
    });

    describe('Cross-Platform Integration', () => {
        test('should coordinate actions across platforms', async () => {
            const campaign = {
                content: 'test content',
                platforms: ['instagram', 'tiktok', 'twitter'],
                schedule: new Date()
            };

            const results = await promotionService.executeCampaign(campaign);
            expect(results).toHaveProperty('posts');
            expect(results.posts).toHaveLength(3);
        });

        test('should aggregate analytics across platforms', async () => {
            const analytics = await promotionService.aggregateAnalytics('test-campaign');
            expect(analytics).toHaveProperty('totalEngagement');
            expect(analytics).toHaveProperty('platformBreakdown');
        });
    });

    describe('Error Handling', () => {
        test('should handle platform API failures gracefully', async () => {
            // Simulate API failure
            mockRuntime.executeAction = jest.fn().mockRejectedValue(new Error('API Error'));

            await expect(
                promotionService.postContent('test-content', 'instagram')
            ).rejects.toThrow('API Error');
        });

        test('should retry failed operations', async () => {
            const mockExecute = jest.fn()
                .mockRejectedValueOnce(new Error('Temporary Error'))
                .mockResolvedValueOnce({ success: true });

            mockRuntime.executeAction = mockExecute;

            const result = await promotionService.postContent('test-content', 'instagram');
            expect(mockExecute).toHaveBeenCalledTimes(2);
            expect(result).toHaveProperty('success', true);
        });
    });

    afterEach(async () => {
        await contentService.cleanup();
        await promotionService.cleanup();
        await tokenService.cleanup();
    });
}); 