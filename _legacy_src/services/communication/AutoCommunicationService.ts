import { EventEmitter } from 'events';
import { AutoEngagementService } from '../engagement/AutoEngagementService';
import { TokenAnalyticsService } from '../analytics/TokenAnalyticsService';
import { SpotifyAnalyticsService } from '../analytics/SpotifyAnalyticsService';

interface EngagementStrategy {
    type: 'milestone' | 'incentive' | 'update' | 'alert';
    platforms: string[];
    frequency: number;
    conditions: {
        minStreams?: number;
        maxStreams?: number;
        minVolume?: number;
        maxVolume?: number;
        timeOfDay?: number[];
    };
}

export class AutoCommunicationService extends EventEmitter {
    private strategies: EngagementStrategy[] = [
        {
            type: 'milestone',
            platforms: ['twitter', 'discord', 'telegram'],
            frequency: 3600 * 4, // Every 4 hours
            conditions: {
                timeOfDay: [9, 12, 15, 18, 21] // Prime engagement hours
            }
        },
        {
            type: 'incentive',
            platforms: ['twitter', 'discord'],
            frequency: 3600 * 6, // Every 6 hours
            conditions: {
                minStreams: 1000,
                maxStreams: 100000
            }
        },
        {
            type: 'update',
            platforms: ['discord', 'telegram'],
            frequency: 3600 * 12, // Every 12 hours
            conditions: {
                minVolume: 1000
            }
        },
        {
            type: 'alert',
            platforms: ['twitter', 'discord', 'telegram'],
            frequency: 3600, // Every hour
            conditions: {
                maxVolume: 5000 // Low volume alert
            }
        }
    ];

    private lastExecutions: Map<string, number> = new Map();

    constructor(
        private autoEngagement: AutoEngagementService,
        private tokenAnalytics: TokenAnalyticsService,
        private spotifyAnalytics: SpotifyAnalyticsService
    ) {
        super();
    }

    async startAutonomousCommunication() {
        setInterval(async () => {
            try {
                const metrics = await this.gatherMetrics();
                await this.executeStrategies(metrics);
            } catch (error) {
                console.error('Error in autonomous communication:', error);
            }
        }, 900000); // Check every 15 minutes
    }

    private async gatherMetrics() {
        const [streamingMetrics, tokenMetrics] = await Promise.all([
            this.spotifyAnalytics.getTrackMetrics('MORE'),
            this.tokenAnalytics.getTradingMetrics()
        ]);

        return {
            streams: streamingMetrics.totalStreams,
            volume24h: tokenMetrics.volume24h,
            holders: tokenMetrics.uniqueHolders,
            price: tokenMetrics.price,
            hour: new Date().getHours()
        };
    }

    private async executeStrategies(metrics: any) {
        for (const strategy of this.strategies) {
            const lastExec = this.lastExecutions.get(strategy.type) || 0;
            const now = Date.now();

            if (now - lastExec < strategy.frequency * 1000) continue;
            if (!this.checkConditions(strategy.conditions, metrics)) continue;

            await this.executeStrategy(strategy, metrics);
            this.lastExecutions.set(strategy.type, now);
        }
    }

    private checkConditions(conditions: any, metrics: any): boolean {
        if (conditions.minStreams && metrics.streams < conditions.minStreams) return false;
        if (conditions.maxStreams && metrics.streams > conditions.maxStreams) return false;
        if (conditions.minVolume && metrics.volume24h < conditions.minVolume) return false;
        if (conditions.maxVolume && metrics.volume24h > conditions.maxVolume) return false;
        if (conditions.timeOfDay && !conditions.timeOfDay.includes(metrics.hour)) return false;
        return true;
    }

    private async executeStrategy(strategy: EngagementStrategy, metrics: any) {
        const message = this.generateMessage(strategy.type, metrics);
        
        await this.autoEngagement.createCampaign({
            message,
            platforms: strategy.platforms,
            type: strategy.type,
            metrics: {
                streams: metrics.streams,
                volume: metrics.volume24h,
                holders: metrics.holders,
                price: metrics.price
            }
        });
    }

    private generateMessage(type: string, metrics: any): string {
        const nextMilestone = this.getNextMilestone(metrics.streams);
        
        switch (type) {
            case 'milestone':
                return `🎵 $MORE Progress Update:\n` +
                    `${metrics.streams.toLocaleString()} total streams!\n` +
                    `Next milestone: ${nextMilestone} streams\n\n` +
                    `🎯 Rewards at next milestone:\n` +
                    `- Higher liquidity multiplier\n` +
                    `- Exclusive NFT access\n` +
                    `- Increased staking rewards\n\n` +
                    `Stream MORE now to earn rewards! 🚀`;

            case 'incentive':
                return `💰 $MORE Rewards Alert:\n` +
                    `Current stream count: ${metrics.streams.toLocaleString()}\n` +
                    `Streaming rewards: ${this.calculateRewards(metrics.streams)}x\n\n` +
                    `🎯 How to earn:\n` +
                    `1. Stream MORE on Spotify\n` +
                    `2. Add liquidity to earn ${(this.calculateRewards(metrics.streams) * 1.5).toFixed(2)}x rewards\n` +
                    `3. Stake $MORE tokens\n\n` +
                    `Start earning now! 🔥`;

            case 'update':
                return `📊 $MORE Stats Update:\n` +
                    `Price: $${metrics.price.toFixed(6)}\n` +
                    `24h Volume: $${metrics.volume24h.toLocaleString()}\n` +
                    `Holders: ${metrics.holders.toLocaleString()}\n` +
                    `Streams: ${metrics.streams.toLocaleString()}\n\n` +
                    `Next milestone: ${nextMilestone} streams 🎯`;

            case 'alert':
                return `🚨 Low Volume Alert!\n` +
                    `24h Volume: $${metrics.volume24h.toLocaleString()}\n\n` +
                    `💡 Opportunities:\n` +
                    `- Add liquidity for ${(this.calculateRewards(metrics.streams) * 1.5).toFixed(2)}x rewards\n` +
                    `- Stream MORE for passive rewards\n` +
                    `- Stake tokens for ${(this.calculateRewards(metrics.streams)).toFixed(2)}x APY\n\n` +
                    `Don't miss out! 🎵`;

            default:
                return '';
        }
    }

    private getNextMilestone(streams: number): string {
        const milestones = [10000, 50000, 100000, 500000, 1000000];
        const next = milestones.find(m => m > streams);
        return next ? next.toLocaleString() : '1M+';
    }

    private calculateRewards(streams: number): number {
        // Parabolic growth: base^(streams/10000)
        return Math.pow(1.00005, streams / 10000);
    }
} 