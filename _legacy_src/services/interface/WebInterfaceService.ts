import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { MetricsService } from '../analytics/MetricsService';
import { SpotifyAnalyticsService } from '../analytics/SpotifyAnalyticsService';
import { TokenAnalyticsService } from '../analytics/TokenAnalyticsService';
import { AutoEngagementService } from '../engagement/AutoEngagementService';

interface MetricsData {
    streaming: {
        total: number;
        daily: number;
        growth: number;
    };
    token: {
        price: number;
        volume: number;
        liquidity: number;
    };
    engagement: {
        users: number;
        interactions: number;
        rewards: number;
    };
}

export class WebInterfaceService extends EventEmitter {
    private static instance: WebInterfaceService;
    private readonly rateLimiter: any;
    private readonly metricsService: MetricsService;
    private metrics: MetricsData = {
        streaming: { total: 0, daily: 0, growth: 0 },
        token: { price: 0, volume: 0, liquidity: 0 },
        engagement: { users: 0, interactions: 0, rewards: 0 }
    };

    constructor(
        spotifyAnalytics: SpotifyAnalyticsService,
        tokenAnalytics: TokenAnalyticsService,
        autoEngagement: AutoEngagementService
    ) {
        super();
        this.metricsService = MetricsService.getInstance(
            spotifyAnalytics,
            tokenAnalytics,
            autoEngagement
        );
        this.setupRateLimiting();
        this.startMetricsUpdate();
    }

    static getInstance(
        spotifyAnalytics: SpotifyAnalyticsService,
        tokenAnalytics: TokenAnalyticsService,
        autoEngagement: AutoEngagementService
    ): WebInterfaceService {
        if (!WebInterfaceService.instance) {
            WebInterfaceService.instance = new WebInterfaceService(
                spotifyAnalytics,
                tokenAnalytics,
                autoEngagement
            );
        }
        return WebInterfaceService.instance;
    }

    private setupRateLimiting() {
        this.rateLimiter = rateLimit({
            windowMs: parseInt(process.env.API_RATE_WINDOW || '900000'),
            max: parseInt(process.env.API_RATE_LIMIT || '100')
        });
    }

    private async startMetricsUpdate() {
        setInterval(async () => {
            try {
                await this.updateMetrics();
            } catch (error) {
                console.error('Failed to update metrics:', error);
            }
        }, 60000); // Update every minute
    }

    private async updateMetrics() {
        const [streaming, token, engagement] = await Promise.all([
            this.metricsService.getStreamingMetrics(),
            this.metricsService.getTokenMetrics(),
            this.metricsService.getEngagementMetrics()
        ]);

        this.metrics = {
            streaming,
            token,
            engagement
        };

        this.emit('metricsUpdated', this.metrics);
    }

    // Public API endpoints
    async getPublicMetrics(): Promise<MetricsData> {
        return this.metrics;
    }

    async getUserEngagement(address: string): Promise<any> {
        const [rewards, rank] = await Promise.all([
            this.calculateRewards(address),
            this.calculateRank(address)
        ]);

        return {
            rewards,
            rank,
            achievements: await this.getAchievements(address)
        };
    }

    async getMilestones(): Promise<any[]> {
        const { streaming, engagement } = this.metrics;
        return [
            {
                type: 'streaming',
                target: 10000,
                current: streaming.total,
                reward: ethers.parseEther('100')
            },
            {
                type: 'engagement',
                target: 1000,
                current: engagement.interactions,
                reward: ethers.parseEther('50')
            }
        ];
    }

    private async calculateRewards(address: string): Promise<number> {
        // TODO: Implement actual reward calculation based on user engagement
        return 0;
    }

    private async calculateRank(address: string): Promise<number> {
        // TODO: Implement actual rank calculation based on user metrics
        return 0;
    }

    private async getAchievements(address: string): Promise<any[]> {
        // TODO: Implement achievements system
        return [];
    }

    // Rate-limited request helper
    async makeRequest(endpoint: string, data?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.rateLimiter(
                { path: endpoint },
                { json: () => resolve(data) },
                (error: any) => error ? reject(error) : resolve(data)
            );
        });
    }
} 