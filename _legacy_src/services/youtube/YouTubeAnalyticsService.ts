import { IAgentRuntime } from '@elizaos/core';
import { google } from 'googleapis';
import { YouTubeAuthService } from './YouTubeAuthService';
import { YouTubeCampaignMetrics, YouTubeVideoMetrics } from './index';
import { EventEmitter } from 'events';

interface AnalyticsConfig {
    trackingInterval?: number; // milliseconds
    campaignDuration?: number; // milliseconds
    retentionThreshold?: number; // percentage
    engagementThreshold?: number; // number of interactions
}

export class YouTubeAnalyticsService extends EventEmitter {
    private youtube: any;
    private youtubeAnalytics: any;
    private runtime: IAgentRuntime;
    private authService: YouTubeAuthService;
    private campaignMetrics: Map<string, YouTubeCampaignMetrics>;
    private trackingIntervals: Map<string, NodeJS.Timeout>;
    private readonly config: AnalyticsConfig;

    constructor(runtime: IAgentRuntime, config: Partial<AnalyticsConfig> = {}) {
        super();
        this.runtime = runtime;
        this.authService = YouTubeAuthService.getInstance(runtime);
        this.campaignMetrics = new Map();
        this.trackingIntervals = new Map();
        this.config = {
            trackingInterval: config.trackingInterval || 3600000, // 1 hour
            campaignDuration: config.campaignDuration || 30 * 24 * 3600000, // 30 days
            retentionThreshold: config.retentionThreshold || 70, // 70%
            engagementThreshold: config.engagementThreshold || 1000
        };
    }

    async initialize(): Promise<void> {
        this.youtube = google.youtube({
            version: 'v3',
            auth: this.authService.getOAuth2Client()
        });

        this.youtubeAnalytics = google.youtubeAnalytics({
            version: 'v2',
            auth: this.authService.getOAuth2Client()
        });
    }

    async startCampaignTracking(videoId: string): Promise<void> {
        // Initialize campaign metrics
        this.campaignMetrics.set(videoId, {
            totalViews: 0,
            averageRetention: 0,
            subscriberGain: 0,
            topTrafficSources: [],
            audienceRetention: []
        });

        // Set up periodic tracking
        const interval = setInterval(async () => {
            try {
                await this.updateCampaignMetrics(videoId);
            } catch (error) {
                console.error('Error updating campaign metrics:', error);
                this.emit('trackingError', { videoId, error });
            }
        }, this.config.trackingInterval);

        this.trackingIntervals.set(videoId, interval);

        // Schedule campaign end
        setTimeout(() => {
            this.endCampaignTracking(videoId);
        }, this.config.campaignDuration);
    }

    private async updateCampaignMetrics(videoId: string): Promise<void> {
        try {
            const [basicMetrics, analyticsData] = await Promise.all([
                this.getBasicMetrics(videoId),
                this.getDetailedAnalytics(videoId)
            ]);

            const currentMetrics = this.campaignMetrics.get(videoId);
            if (!currentMetrics) return;

            const updatedMetrics = {
                ...currentMetrics,
                totalViews: basicMetrics.views,
                averageRetention: analyticsData.averageViewPercentage || 0,
                subscriberGain: analyticsData.subscriberGain || 0,
                topTrafficSources: analyticsData.topTrafficSources || [],
                audienceRetention: [
                    ...currentMetrics.audienceRetention,
                    {
                        timeStamp: Date.now(),
                        retentionPercentage: analyticsData.averageViewPercentage || 0
                    }
                ]
            };

            this.campaignMetrics.set(videoId, updatedMetrics);
            this.emit('metricsUpdate', { videoId, metrics: updatedMetrics });

            // Check for optimization opportunities
            await this.analyzeAndOptimize(videoId, updatedMetrics);

        } catch (error) {
            console.error('Error updating metrics:', error);
            this.emit('updateError', { videoId, error });
        }
    }

    private async getBasicMetrics(videoId: string): Promise<YouTubeVideoMetrics> {
        const response = await this.youtube.videos.list({
            part: 'statistics',
            id: videoId
        });

        const stats = response.data.items[0].statistics;
        return {
            views: parseInt(stats.viewCount) || 0,
            likes: parseInt(stats.likeCount) || 0,
            comments: parseInt(stats.commentCount) || 0,
            shares: 0,
            watchTime: 0,
            retentionRate: 0
        };
    }

    private async getDetailedAnalytics(videoId: string): Promise<any> {
        try {
            const endDate = new Date().toISOString();
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const response = await this.youtubeAnalytics.reports.query({
                ids: 'channel==MINE',
                startDate,
                endDate,
                metrics: 'estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
                dimensions: 'video',
                filters: `video==${videoId}`
            });

            return {
                averageViewPercentage: response.data.rows?.[0]?.[3] || 0,
                subscriberGain: response.data.rows?.[0]?.[4] || 0,
                watchTime: response.data.rows?.[0]?.[1] || 0,
                topTrafficSources: [] // Would require additional API call
            };
        } catch (error) {
            console.error('Error fetching detailed analytics:', error);
            return {};
        }
    }

    private async analyzeAndOptimize(
        videoId: string,
        metrics: YouTubeCampaignMetrics
    ): Promise<void> {
        // Check retention rate
        if (metrics.averageRetention < this.config.retentionThreshold) {
            this.emit('optimizationNeeded', {
                videoId,
                type: 'retention',
                currentValue: metrics.averageRetention,
                threshold: this.config.retentionThreshold
            });
        }

        // Check engagement
        if (metrics.totalViews < this.config.engagementThreshold) {
            this.emit('optimizationNeeded', {
                videoId,
                type: 'engagement',
                currentValue: metrics.totalViews,
                threshold: this.config.engagementThreshold
            });
        }
    }

    async endCampaignTracking(videoId: string): Promise<void> {
        const interval = this.trackingIntervals.get(videoId);
        if (interval) {
            clearInterval(interval);
            this.trackingIntervals.delete(videoId);
        }

        const finalMetrics = this.campaignMetrics.get(videoId);
        if (finalMetrics) {
            this.emit('campaignEnd', { videoId, metrics: finalMetrics });
            this.campaignMetrics.delete(videoId);
        }
    }

    async getCampaignMetrics(videoId: string): Promise<YouTubeCampaignMetrics | null> {
        return this.campaignMetrics.get(videoId) || null;
    }

    async cleanup(): Promise<void> {
        // Clear all tracking intervals
        for (const [videoId, interval] of this.trackingIntervals.entries()) {
            clearInterval(interval);
            this.trackingIntervals.delete(videoId);
        }

        this.campaignMetrics.clear();
        this.removeAllListeners();
    }
} 