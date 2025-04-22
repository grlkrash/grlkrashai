import { IAgentRuntime } from '@elizaos/core';
import { ContentService } from '../content/ContentService';
import { VideoGenerationPlugin } from '@plugin-video-generation';
import { MarketingInsights } from '../analytics/MarketingStrategyAnalyzer';

describe('ContentService', () => {
    let service: ContentService;
    let mockRuntime: jest.Mocked<IAgentRuntime>;
    let mockVideoPlugin: jest.Mocked<VideoGenerationPlugin>;

    beforeEach(() => {
        mockRuntime = {
            // Add mock implementation
        } as unknown as jest.Mocked<IAgentRuntime>;

        mockVideoPlugin = {
            // Add mock implementation
        } as unknown as jest.Mocked<VideoGenerationPlugin>;

        service = new ContentService(mockRuntime);
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('Content Analysis', () => {
        test('should analyze content across platforms', async () => {
            const analysisHandler = jest.fn();
            service.on('analysisCompleted', analysisHandler);

            const platforms = ['instagram', 'tiktok'];
            const username = 'testuser';

            const results = await service.analyzeContent(username, platforms);

            expect(analysisHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    platforms,
                    results: expect.any(Map)
                })
            );
        });

        test('should cache analysis results', async () => {
            const username = 'testuser';
            const platforms = ['instagram'];

            // First call should perform analysis
            await service.analyzeContent(username, platforms);

            // Mock the internal analysis method to track calls
            const analyzeContentItems = jest.spyOn(service as any, 'analyzeContentItems');

            // Second call should use cache
            await service.analyzeContent(username, platforms);

            expect(analyzeContentItems).not.toHaveBeenCalled();
        });
    });

    describe('Competitor Analysis', () => {
        test('should analyze similar content from competitors', async () => {
            const competitorHandler = jest.fn();
            service.on('competitorAnalysisCompleted', competitorHandler);

            const username = 'testuser';
            const platforms = ['instagram', 'tiktok'];
            const niche = ['music', 'hiphop'];

            const analysis = await service.analyzeSimilarContent(
                username,
                platforms,
                niche
            );

            expect(competitorHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    competitors: expect.any(Array),
                    insights: expect.any(Object)
                })
            );
        });
    });

    describe('Content Generation', () => {
        test('should generate content variations', async () => {
            const generationHandler = jest.fn();
            service.on('contentGenerated', generationHandler);

            const baseContent = 'Test content';
            const platforms = ['instagram', 'tiktok'];
            const insights: MarketingInsights = {
                targetAudience: ['music-lovers'],
                optimalTiming: [12, 15, 18],
                recommendedHashtags: ['#music', '#viral'],
                contentTypes: ['video', 'image']
            };

            const variations = await service.generateVariations(
                baseContent,
                platforms,
                insights
            );

            expect(generationHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    platforms,
                    variations: expect.any(Map)
                })
            );
        });
    });

    describe('Content Tracking', () => {
        test('should track content performance', async () => {
            const trackingHandler = jest.fn();
            service.on('contentTracked', trackingHandler);

            const platform = 'instagram';
            const content = 'Test post';
            const metrics = {
                views: 1000,
                shares: 500,
                engagement: 0.8,
                lastUpdated: new Date()
            };
            const insights = {
                targetAudience: ['music-lovers'],
                optimalTiming: [12, 15, 18],
                recommendedHashtags: ['#music'],
                contentTypes: ['video']
            };

            await service.trackContent(platform, content, metrics, insights);

            expect(trackingHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    platform,
                    metrics,
                    insights
                })
            );
        });

        test('should clean up old tracking data', async () => {
            const cleanupHandler = jest.fn();
            service.on('dataCleanup', cleanupHandler);

            // Add old data
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 100); // 100 days old

            await service.trackContent('instagram', 'old content', {
                views: 100,
                shares: 50,
                engagement: 0.5,
                lastUpdated: oldDate
            }, {
                targetAudience: ['test'],
                optimalTiming: [12],
                recommendedHashtags: ['#test'],
                contentTypes: ['image']
            });

            // Trigger cleanup
            await service.cleanup();

            expect(cleanupHandler).toHaveBeenCalled();
            // Verify old data is removed
            const history = (service as any).contentHistory.get('instagram');
            expect(history?.length).toBe(0);
        });
    });
}); 