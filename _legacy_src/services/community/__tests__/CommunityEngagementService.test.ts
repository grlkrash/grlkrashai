import { IAgentRuntime } from '@elizaos/core';
import { CommunityEngagementService } from '../CommunityEngagementService';
import { ContentMetrics } from '../IPFSContentService';
import { MarketingInsights } from '../MarketingStrategyAnalyzer';

describe('CommunityEngagementService', () => {
    let service: CommunityEngagementService;
    let mockRuntime: jest.Mocked<IAgentRuntime>;

    beforeEach(() => {
        mockRuntime = {
            // Add mock implementation
        } as unknown as jest.Mocked<IAgentRuntime>;

        service = new CommunityEngagementService(mockRuntime);
    });

    afterEach(() => {
        service.cleanup();
    });

    describe('Action Queue Management', () => {
        test('should queue community action with correct priority', async () => {
            const actionQueuedHandler = jest.fn();
            service.on('actionQueued', actionQueuedHandler);

            await service.queueCommunityAction('instagram', 'like', 'post123');

            expect(actionQueuedHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'like',
                    platform: 'instagram',
                    targetId: 'post123'
                })
            );
        });

        test('should maintain max queue size', async () => {
            const MAX_QUEUE_SIZE = 100;
            for (let i = 0; i < MAX_QUEUE_SIZE + 10; i++) {
                await service.queueCommunityAction('instagram', 'like', `post${i}`);
            }

            // Implementation detail: we need to access private property for testing
            const queue = (service as any).actionQueue;
            expect(queue.length).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
        });

        test('should process queue in priority order', async () => {
            const actionExecutedHandler = jest.fn();
            service.on('actionExecuted', actionExecutedHandler);

            // Queue actions with different priorities
            await service.queueCommunityAction('instagram', 'challenge', 'post1'); // Higher priority
            await service.queueCommunityAction('instagram', 'like', 'post2'); // Lower priority

            await service.processActionQueue();

            expect(actionExecutedHandler).toHaveBeenCalledTimes(2);
            expect(actionExecutedHandler.mock.calls[0][0].type).toBe('challenge');
        });
    });

    describe('Metrics Management', () => {
        test('should update metrics on successful action', async () => {
            const metricsUpdatedHandler = jest.fn();
            service.on('metricsUpdated', metricsUpdatedHandler);

            await service.updateMetrics('instagram', true);

            expect(metricsUpdatedHandler).toHaveBeenCalledWith(
                'instagram',
                expect.objectContaining({
                    interactions: expect.any(Number),
                    responseRate: expect.any(Number),
                    sentiment: expect.any(Number)
                })
            );
        });

        test('should handle failed actions in metrics', async () => {
            const metricsUpdatedHandler = jest.fn();
            service.on('metricsUpdated', metricsUpdatedHandler);

            await service.updateMetrics('instagram', false);

            expect(metricsUpdatedHandler).toHaveBeenCalledWith(
                'instagram',
                expect.objectContaining({
                    sentiment: expect.any(Number)
                })
            );
            
            const metrics = metricsUpdatedHandler.mock.calls[0][1];
            expect(metrics.sentiment).toBeLessThan(0.5); // Default sentiment is 0.5
        });
    });

    describe('Challenge Generation', () => {
        test('should generate appropriate challenge prompts', async () => {
            const challengeGeneratedHandler = jest.fn();
            service.on('challengeGenerated', challengeGeneratedHandler);

            const mockMetrics: ContentMetrics = {
                views: 1000,
                shares: 500,
                engagement: 0.8,
                lastUpdated: new Date()
            };

            const mockInsights: MarketingInsights = {
                targetAudience: ['music-lovers'],
                optimalTiming: [12, 15, 18],
                recommendedHashtags: ['#music', '#viral'],
                contentTypes: ['video', 'image']
            };

            const prompt = await service.generateChallengePrompt(
                'instagram',
                mockMetrics,
                mockInsights
            );

            expect(prompt).toContain('MORE');
            expect(challengeGeneratedHandler).toHaveBeenCalledWith(
                'instagram',
                expect.any(String)
            );
        });
    });

    describe('Error Handling', () => {
        test('should emit error events when action execution fails', async () => {
            const errorHandler = jest.fn();
            const actionExecutedHandler = jest.fn();
            
            service.on('error', errorHandler);
            service.on('actionExecuted', actionExecutedHandler);

            // Mock executeAction to throw
            (service as any).executeAction = jest.fn().mockRejectedValue(
                new Error('Action failed')
            );

            await service.queueCommunityAction('instagram', 'like', 'post1');
            await service.processActionQueue();

            expect(errorHandler).toHaveBeenCalledWith(
                expect.any(Error),
                'processActionQueue'
            );
            expect(actionExecutedHandler).toHaveBeenCalledWith(
                expect.any(Object),
                false
            );
        });
    });

    describe('Cleanup', () => {
        test('should properly clean up resources', async () => {
            const handler = jest.fn();
            service.on('actionQueued', handler);

            await service.queueCommunityAction('instagram', 'like', 'post1');
            await service.cleanup();

            // Queue another action after cleanup
            await service.queueCommunityAction('instagram', 'like', 'post2');

            // Handler should not be called after cleanup
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });
}); 