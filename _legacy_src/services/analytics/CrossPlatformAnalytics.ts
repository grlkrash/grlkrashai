import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { TwitterService } from './TwitterService';
import { YouTubeService } from './YouTubeService';
import { SpotifyService } from './SpotifyService';
import { IPFSContentService } from './IPFSContentService';

export interface CrossPlatformMetrics {
    totalEngagement: number;
    platformMetrics: {
        [platform: string]: {
            views: number;
            engagement: number;
            growth: number;
            performance: number;
        };
    };
    contentPerformance: {
        [contentId: string]: {
            crossPlatformScore: number;
            trending: boolean;
            recommendations: string[];
        };
    };
    audienceInsights: {
        demographics: any;
        interests: string[];
        peakEngagementTimes: number[];
        topRegions: string[];
    };
}

export interface CampaignPerformance {
    campaignId: string;
    startDate: Date;
    platforms: string[];
    metrics: CrossPlatformMetrics;
    roi: number;
    status: 'active' | 'completed' | 'paused';
}

export class CrossPlatformAnalytics extends EventEmitter {
    private runtime: IAgentRuntime;
    private twitterService: TwitterService;
    private youtubeService: YouTubeService;
    private spotifyService: SpotifyService;
    private ipfsService: IPFSContentService;
    
    private campaignMetrics: Map<string, CampaignPerformance>;
    private contentMapping: Map<string, Set<string>>; // IPFS hash to platform content IDs

    constructor(
        runtime: IAgentRuntime,
        twitterService: TwitterService,
        youtubeService: YouTubeService,
        spotifyService: SpotifyService,
        ipfsService: IPFSContentService
    ) {
        super();
        this.runtime = runtime;
        this.twitterService = twitterService;
        this.youtubeService = youtubeService;
        this.spotifyService = spotifyService;
        this.ipfsService = ipfsService;
        
        this.campaignMetrics = new Map();
        this.contentMapping = new Map();

        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        // Listen for metrics updates from each service
        this.twitterService.on('metricsUpdate', this.handleTwitterMetrics.bind(this));
        this.youtubeService.on('metricsUpdate', this.handleYouTubeMetrics.bind(this));
        this.spotifyService.on('metricsUpdate', this.handleSpotifyMetrics.bind(this));
    }

    async trackContent(
        ipfsHash: string,
        platformContentIds: { [platform: string]: string }
    ): Promise<void> {
        // Store content mapping
        if (!this.contentMapping.has(ipfsHash)) {
            this.contentMapping.set(ipfsHash, new Set());
        }
        
        Object.values(platformContentIds).forEach(id => 
            this.contentMapping.get(ipfsHash)!.add(id)
        );

        // Initialize campaign tracking
        const campaignId = `campaign_${Date.now()}`;
        this.campaignMetrics.set(campaignId, {
            campaignId,
            startDate: new Date(),
            platforms: Object.keys(platformContentIds),
            metrics: this.initializeMetrics(),
            roi: 0,
            status: 'active'
        });

        // Start periodic analysis
        this.scheduleAnalysis(campaignId, ipfsHash);
    }

    private initializeMetrics(): CrossPlatformMetrics {
        return {
            totalEngagement: 0,
            platformMetrics: {},
            contentPerformance: {},
            audienceInsights: {
                demographics: {},
                interests: [],
                peakEngagementTimes: [],
                topRegions: []
            }
        };
    }

    private async scheduleAnalysis(campaignId: string, ipfsHash: string): Promise<void> {
        const analysisInterval = setInterval(async () => {
            try {
                const metrics = await this.aggregateMetrics(ipfsHash);
                await this.updateCampaignMetrics(campaignId, metrics);
                
                // Check for optimization opportunities
                const recommendations = await this.generateOptimizationRecommendations(
                    campaignId,
                    metrics
                );

                // Emit analysis results
                this.emit('analysisUpdate', {
                    campaignId,
                    metrics,
                    recommendations
                });

                // Auto-optimize if enabled
                if (metrics.totalEngagement > 1000) {
                    await this.autoOptimizeCampaign(campaignId, recommendations);
                }
            } catch (error) {
                console.error('Error in cross-platform analysis:', error);
            }
        }, 3600000); // Analyze every hour

        // Stop analysis after 90 days
        setTimeout(() => {
            clearInterval(analysisInterval);
            const campaign = this.campaignMetrics.get(campaignId);
            if (campaign) {
                campaign.status = 'completed';
                this.emit('campaignComplete', {
                    campaignId,
                    finalMetrics: campaign.metrics
                });
            }
        }, 90 * 24 * 3600000);
    }

    private async aggregateMetrics(ipfsHash: string): Promise<CrossPlatformMetrics> {
        const contentIds = this.contentMapping.get(ipfsHash);
        if (!contentIds) return this.initializeMetrics();

        const metrics = this.initializeMetrics();
        
        // Aggregate metrics from each platform
        for (const contentId of contentIds) {
            try {
                if (contentId.startsWith('tw_')) {
                    const twitterMetrics = await this.twitterService.getTweetMetrics(contentId);
                    this.aggregateTwitterMetrics(metrics, twitterMetrics);
                } else if (contentId.startsWith('yt_')) {
                    const youtubeMetrics = await this.youtubeService.getVideoMetrics(contentId);
                    this.aggregateYouTubeMetrics(metrics, youtubeMetrics);
                } else if (contentId.startsWith('sp_')) {
                    const spotifyMetrics = await this.spotifyService.getTrackMetrics(contentId);
                    this.aggregateSpotifyMetrics(metrics, spotifyMetrics);
                }
            } catch (error) {
                console.error(`Error aggregating metrics for ${contentId}:`, error);
            }
        }

        return metrics;
    }

    private aggregateTwitterMetrics(metrics: CrossPlatformMetrics, twitterMetrics: any): void {
        metrics.platformMetrics.twitter = {
            views: twitterMetrics.impressions || 0,
            engagement: (twitterMetrics.likes + twitterMetrics.retweets + twitterMetrics.replies) || 0,
            growth: twitterMetrics.followerGrowth || 0,
            performance: twitterMetrics.engagementRate || 0
        };
    }

    private aggregateYouTubeMetrics(metrics: CrossPlatformMetrics, youtubeMetrics: any): void {
        metrics.platformMetrics.youtube = {
            views: youtubeMetrics.views || 0,
            engagement: (youtubeMetrics.likes + youtubeMetrics.comments) || 0,
            growth: youtubeMetrics.subscriberGain || 0,
            performance: youtubeMetrics.retentionRate || 0
        };
    }

    private aggregateSpotifyMetrics(metrics: CrossPlatformMetrics, spotifyMetrics: any): void {
        metrics.platformMetrics.spotify = {
            views: spotifyMetrics.streams || 0,
            engagement: spotifyMetrics.saves || 0,
            growth: spotifyMetrics.playlistAdds || 0,
            performance: (1 - spotifyMetrics.skipRate) || 0
        };
    }

    private async updateCampaignMetrics(
        campaignId: string,
        metrics: CrossPlatformMetrics
    ): Promise<void> {
        const campaign = this.campaignMetrics.get(campaignId);
        if (!campaign) return;

        // Calculate total engagement across platforms
        metrics.totalEngagement = Object.values(metrics.platformMetrics)
            .reduce((total, platform) => total + platform.engagement, 0);

        // Update campaign metrics
        campaign.metrics = metrics;
        
        // Calculate ROI (example calculation)
        campaign.roi = this.calculateROI(metrics);
    }

    private calculateROI(metrics: CrossPlatformMetrics): number {
        // Implement ROI calculation based on platform performance
        return 0;
    }

    private async generateOptimizationRecommendations(
        campaignId: string,
        metrics: CrossPlatformMetrics
    ): Promise<string[]> {
        const recommendations: string[] = [];
        const campaign = this.campaignMetrics.get(campaignId);
        if (!campaign) return recommendations;

        // Analyze platform performance
        for (const [platform, platformMetrics] of Object.entries(metrics.platformMetrics)) {
            if (platformMetrics.performance < 0.3) {
                recommendations.push(`Optimize ${platform} content - low performance`);
            }
            if (platformMetrics.growth < 0) {
                recommendations.push(`Increase ${platform} engagement activities`);
            }
        }

        // Cross-platform recommendations
        if (metrics.totalEngagement < 1000) {
            recommendations.push('Increase cross-platform promotion');
        }

        return recommendations;
    }

    private async autoOptimizeCampaign(
        campaignId: string,
        recommendations: string[]
    ): Promise<void> {
        const campaign = this.campaignMetrics.get(campaignId);
        if (!campaign) return;

        for (const recommendation of recommendations) {
            try {
                if (recommendation.includes('twitter')) {
                    await this.twitterService.optimizeCampaigns();
                }
                if (recommendation.includes('youtube')) {
                    // Implement YouTube optimization
                }
                if (recommendation.includes('spotify')) {
                    // Implement Spotify optimization
                }
            } catch (error) {
                console.error('Error in auto-optimization:', error);
            }
        }
    }

    async cleanup(): Promise<void> {
        this.campaignMetrics.clear();
        this.contentMapping.clear();
        this.removeAllListeners();
    }
} 