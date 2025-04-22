import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { TwitterAuthService } from '../services/TwitterAuthService';
import { TwitterService } from '../services/TwitterService';
import { AdvancedTwitterCommands, TwitterRole } from '../commands/advancedTwitterCommands';
import { TwitterSession } from '../services/TwitterAuthService';

jest.mock('../services/TwitterAuthService');
jest.mock('../services/TwitterService');

describe('Twitter Capabilities Tests', () => {
    let twitterCommands: AdvancedTwitterCommands;
    const mockUserAddress = '0x123...';
    const mockSuperAdmin = '@superadmin';
    const mockAdmin = '@admin';
    const mockBasicUser = '@basicuser';

    beforeEach(() => {
        // Reset environment and instances
        process.env.TWITTER_SUPER_ADMIN = mockSuperAdmin;
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Get instance
        twitterCommands = AdvancedTwitterCommands.getInstance();
        
        // Mock TwitterAuthService methods
        const mockTwitterAuth = TwitterAuthService.getInstance() as jest.Mocked<TwitterAuthService>;
        mockTwitterAuth.getTwitterSession.mockImplementation(async (address) => {
            if (address === mockSuperAdmin) {
                return {
                    userId: 'super_admin_id',
                    username: mockSuperAdmin,
                    accessToken: 'mock_access_token',
                    refreshToken: 'mock_refresh_token',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                } as TwitterSession;
            }
            return null;
        });
    });

    describe('Authorization Tests', () => {
        it('should authorize super admin correctly', async () => {
            const result = await twitterCommands.addAdmin(mockSuperAdmin, mockAdmin, TwitterRole.ADMIN);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Added @admin as admin');
        });

        it('should reject unauthorized users', async () => {
            const result = await twitterCommands.addAdmin(mockBasicUser, mockAdmin, TwitterRole.ADMIN);
            expect(result.success).toBe(false);
            expect(result.message).toContain('Not authorized');
        });
    });

    describe('Basic Twitter Commands', () => {
        it('should compose and post tweet', async () => {
            const result = await twitterCommands.composeTweet(mockSuperAdmin, 'Test tweet');
            expect(result.success).toBe(true);
            expect(result.message).toContain('Tweet posted successfully');
        });

        it('should create thread', async () => {
            const thread = 'Message 1\n\nMessage 2\n\nMessage 3';
            const result = await twitterCommands.createThread(mockSuperAdmin, thread);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Thread posted successfully');
        });
    });

    describe('Analytics Commands', () => {
        it('should analyze followers', async () => {
            const result = await twitterCommands.analyzeFollowers(mockSuperAdmin);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Active Followers');
            expect(result.message).toContain('Engagement Rate');
        });

        it('should analyze engagement', async () => {
            const result = await twitterCommands.analyzeEngagement(mockSuperAdmin, 7);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Likes');
            expect(result.message).toContain('Retweets');
        });
    });

    describe('Auto Mode Tests', () => {
        it('should toggle auto mode', async () => {
            const result = await twitterCommands.toggleAutoMode(mockSuperAdmin, true);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Auto mode enabled');
        });

        it('should configure auto mode', async () => {
            const result = await twitterCommands.configureAutoMode(mockSuperAdmin, {
                replyThreshold: 3,
                autoReplyEnabled: true,
                autoAnalyticsEnabled: true
            });
            expect(result.success).toBe(true);
            expect(result.message).toContain('configuration updated');
        });

        it('should get auto mode status', async () => {
            const result = await twitterCommands.getAutoModeStatus(mockSuperAdmin);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Auto Mode Status');
            expect(result.message).toContain('Reply Threshold');
        });
    });

    describe('Error Handling', () => {
        it('should handle rate limiting', async () => {
            // Mock rate limit error
            const mockTwitterService = TwitterService.getInstance() as jest.Mocked<TwitterService>;
            mockTwitterService.tweet.mockRejectedValueOnce(new Error('Rate limit exceeded'));

            const result = await twitterCommands.composeTweet(mockSuperAdmin, 'Test tweet');
            expect(result.success).toBe(false);
            expect(result.message).toContain('Rate limit');
        });

        it('should handle invalid configurations', async () => {
            const result = await twitterCommands.configureAutoMode(mockSuperAdmin, {
                replyThreshold: -1 // Invalid threshold
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid configuration');
        });
    });
}); 