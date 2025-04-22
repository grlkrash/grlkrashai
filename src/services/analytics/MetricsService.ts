import { ethers } from 'ethers';
import { SpotifyAnalyticsService } from './SpotifyAnalyticsService';
import { TokenAnalyticsService } from './TokenAnalyticsService';
import { AutoEngagementService } from '../engagement/AutoEngagementService';

export class MetricsService {
    private static instance: MetricsService;
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 60000; // 1 minute

    constructor(
        private spotifyAnalytics: SpotifyAnalyticsService,
        private tokenAnalytics: TokenAnalyticsService,
        private autoEngagement: AutoEngagementService
    ) {}

    static getInstance(
        spotifyAnalytics: SpotifyAnalyticsService,
        tokenAnalytics: TokenAnalyticsService,
        autoEngagement: AutoEngagementService
    ): MetricsService {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService(
                spotifyAnalytics,
                tokenAnalytics,
                autoEngagement
            );
        }
        return MetricsService.instance;
    }

    async getStreamingMetrics(): Promise<any> {
        const cached = this.getFromCache('streaming');
        if (cached) return cached;

        const metrics = await this.spotifyAnalytics.getTrackMetrics('MORE');
        const processed = {
            total: metrics.totalStreams,
            daily: metrics.dailyStreams,
            growth: this.calculateGrowth(metrics.historicalStreams)
        };

        this.setCache('streaming', processed);
        return processed;
    }

    async getTokenMetrics(): Promise<any> {
        const cached = this.getFromCache('token');
        if (cached) return cached;

        const [price, volume, liquidity] = await Promise.all([
            this.tokenAnalytics.getTokenPrice(),
            this.tokenAnalytics.getTradingVolume(),
            this.tokenAnalytics.getLiquidityUSD()
        ]);

        const metrics = { price, volume, liquidity };
        this.setCache('token', metrics);
        return metrics;
    }

    async getEngagementMetrics(): Promise<any> {
        const cached = this.getFromCache('engagement');
        if (cached) return cached;

        const metrics = await this.autoEngagement.getGlobalMetrics();
        const processed = {
            users: metrics.activeUsers24h,
            interactions: metrics.totalInteractions24h,
            rewards: ethers.formatEther(metrics.rewardsDistributed24h)
        };

        this.setCache('engagement', processed);
        return processed;
    }

    private calculateGrowth(historicalData: number[]): number {
        if (historicalData.length < 2) return 0;
        const current = historicalData[historicalData.length - 1];
        const previous = historicalData[historicalData.length - 2];
        return ((current - previous) / previous) * 100;
    }

    private getFromCache(key: string): any | null {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    private setCache(key: string, data: any): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
} 