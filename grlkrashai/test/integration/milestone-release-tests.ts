import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { MilestoneReleaseService } from '../../src/services/automation/MilestoneReleaseService';
import { DynamicLiquidityService } from '../../src/services/liquidity/DynamicLiquidityService';
import { TokenContract } from '../../src/types/contracts';
import { IPFSContentService } from '../../src/services/content/IPFSContentService';
import { SpotifyService } from '../../src/services/promotion/SpotifyService';
import { MusicPromotionService } from '../../src/services/promotion/MusicPromotionService';
import { TokenAnalyticsService } from '../../src/services/analytics/TokenAnalyticsService';
import { AutoEngagementService } from '../../src/services/engagement/AutoEngagementService';
import { SpotifyAnalyticsService } from '../../src/services/analytics/SpotifyAnalyticsService';

describe('Milestone Release Integration Tests', () => {
    let milestoneService: MilestoneReleaseService;
    let liquidityService: DynamicLiquidityService;
    let tokenContract: TokenContract;
    let ipfsContent: IPFSContentService;
    let spotifyService: SpotifyService;
    let promotionService: MusicPromotionService;
    let tokenAnalytics: TokenAnalyticsService;
    let autoEngagement: AutoEngagementService;
    let spotifyAnalytics: SpotifyAnalyticsService;

    before(async () => {
        // Initialize services
        tokenContract = new TokenContract();
        ipfsContent = new IPFSContentService();
        spotifyService = new SpotifyService();
        promotionService = new MusicPromotionService();
        tokenAnalytics = new TokenAnalyticsService();
        autoEngagement = new AutoEngagementService();
        spotifyAnalytics = new SpotifyAnalyticsService();

        milestoneService = new MilestoneReleaseService(
            tokenContract,
            ipfsContent,
            spotifyService,
            promotionService,
            tokenAnalytics,
            autoEngagement
        );

        liquidityService = new DynamicLiquidityService(
            tokenContract,
            spotifyAnalytics,
            tokenAnalytics,
            autoEngagement
        );
    });

    describe('Milestone Release Tests', () => {
        it('should trigger release at $1M market cap', async () => {
            // Mock market cap
            tokenAnalytics.setMarketCap(1_000_000);

            let releaseTriggered = false;
            milestoneService.on('milestoneCompleted', (data) => {
                if (data.type === 'release') releaseTriggered = true;
            });

            await milestoneService.startMonitoring();
            expect(releaseTriggered).to.be.true;
        });

        it('should trigger teaser at $500K market cap', async () => {
            // Mock market cap
            tokenAnalytics.setMarketCap(500_000);

            let teaserTriggered = false;
            milestoneService.on('milestoneCompleted', (data) => {
                if (data.type === 'tease') teaserTriggered = true;
            });

            await milestoneService.startMonitoring();
            expect(teaserTriggered).to.be.true;
        });

        it('should handle IPFS content retrieval', async () => {
            const content = await ipfsContent.getContentMetrics('QmcXG4L9nRQ31jKCViFV5CYXrzDnuWQ4zUrJyeTaF4FKqG');
            expect(content).to.exist;
            expect(content.baseContent.metadata.title).to.equal('MORE');
        });

        it('should upload track to Spotify', async () => {
            const trackId = await spotifyService.uploadTrack(
                'ipfs://QmcXG4L9nRQ31jKCViFV5CYXrzDnuWQ4zUrJyeTaF4FKqG',
                {
                    title: 'MORE',
                    artist: 'GRLKRASH',
                    genre: ['electronic', 'hyperpop'],
                    releaseDate: new Date(),
                    explicit: false,
                    language: 'en'
                }
            );
            expect(trackId).to.match(/^[a-zA-Z0-9]{22}$/);
        });
    });

    describe('Dynamic Liquidity Tests', () => {
        it('should adjust liquidity based on streaming metrics', async () => {
            // Mock streaming data
            spotifyAnalytics.setTrackMetrics('MORE', {
                totalStreams: 10000,
                dailyStreams: 1000,
                uniqueListeners: 5000
            });

            let liquidityAdjusted = false;
            liquidityService.on('liquidityAdded', () => {
                liquidityAdjusted = true;
            });

            await liquidityService.startMonitoring();
            expect(liquidityAdjusted).to.be.true;
        });

        it('should respect liquidity adjustment thresholds', async () => {
            // Mock small streaming change
            spotifyAnalytics.setTrackMetrics('MORE', {
                totalStreams: 10100, // Small increase
                dailyStreams: 1000,
                uniqueListeners: 5000
            });

            let liquidityAdjusted = false;
            liquidityService.on('liquidityAdded', () => {
                liquidityAdjusted = true;
            });

            await liquidityService.startMonitoring();
            expect(liquidityAdjusted).to.be.false;
        });

        it('should enforce cooldown period', async () => {
            // Mock significant streaming increase
            spotifyAnalytics.setTrackMetrics('MORE', {
                totalStreams: 20000,
                dailyStreams: 2000,
                uniqueListeners: 10000
            });

            let adjustmentCount = 0;
            liquidityService.on('liquidityAdded', () => {
                adjustmentCount++;
            });

            // Try multiple adjustments within cooldown
            await liquidityService.startMonitoring();
            await liquidityService.startMonitoring();
            await liquidityService.startMonitoring();

            expect(adjustmentCount).to.equal(1);
        });

        it('should create engagement announcements', async () => {
            let announcementCreated = false;
            autoEngagement.on('announcementCreated', () => {
                announcementCreated = true;
            });

            // Mock streaming increase
            spotifyAnalytics.setTrackMetrics('MORE', {
                totalStreams: 30000,
                dailyStreams: 3000,
                uniqueListeners: 15000
            });

            await liquidityService.startMonitoring();
            expect(announcementCreated).to.be.true;
        });
    });
}); 