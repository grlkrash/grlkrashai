import { EventEmitter } from 'events';
import { TokenContract } from '../../contracts/TokenContract';
import { SpotifyAnalyticsService } from '../analytics/SpotifyAnalyticsService';
import { TokenAnalyticsService } from '../analytics/TokenAnalyticsService';
import { AutoCommunicationService } from '../communication/AutoCommunicationService';

interface LiquidityConfig {
    minLiquidity: number; // Starting at 0
    maxLiquidity: number; // $1M cap
    streamingCurveBase: number; // Base for exponential growth
    adjustmentThreshold: number; // Minimum % change to trigger adjustment
    cooldownPeriod: number; // Time between adjustments in seconds
}

export class DynamicLiquidityService extends EventEmitter {
    private lastAdjustment: number = 0;
    private config: LiquidityConfig = {
        minLiquidity: 0,
        maxLiquidity: 1000000, // $1M
        streamingCurveBase: 1.00005, // Parabolic growth base
        adjustmentThreshold: 0.05, // 5%
        cooldownPeriod: 3600 // 1 hour
    };

    constructor(
        private token: TokenContract,
        private spotifyAnalytics: SpotifyAnalyticsService,
        private tokenAnalytics: TokenAnalyticsService,
        private communication: AutoCommunicationService
    ) {
        super();
    }

    async startMonitoring() {
        setInterval(async () => {
            try {
                const metrics = await this.gatherMetrics();
                await this.checkAndAdjustLiquidity(metrics);
            } catch (error) {
                console.error('Error in liquidity monitoring:', error);
            }
        }, 300000); // Check every 5 minutes
    }

    private async gatherMetrics() {
        const [streamingMetrics, tokenMetrics] = await Promise.all([
            this.spotifyAnalytics.getTrackMetrics('MORE'),
            this.tokenAnalytics.getTradingMetrics()
        ]);

        return {
            streams: streamingMetrics.totalStreams,
            volume24h: tokenMetrics.volume24h,
            currentLiquidity: tokenMetrics.liquidity
        };
    }

    private async checkAndAdjustLiquidity(metrics: any) {
        const now = Date.now();
        if (now - this.lastAdjustment < this.config.cooldownPeriod * 1000) {
            return;
        }

        const targetLiquidity = this.calculateTargetLiquidity(metrics);
        const currentLiquidity = metrics.currentLiquidity;
        const percentChange = Math.abs(targetLiquidity - currentLiquidity) / currentLiquidity;

        if (percentChange >= this.config.adjustmentThreshold) {
            await this.adjustLiquidity(targetLiquidity, currentLiquidity, metrics);
            this.lastAdjustment = now;
        }
    }

    private calculateTargetLiquidity(metrics: any): number {
        // Calculate streaming-based component with parabolic growth
        const streamingMultiplier = Math.pow(
            this.config.streamingCurveBase,
            metrics.streams / 10000
        );

        // Calculate volume-based component
        const volumeMultiplier = Math.min(metrics.volume24h / 10000, 2);

        // Combine multipliers with base liquidity
        let targetLiquidity = this.config.minLiquidity + 
            (metrics.streams * streamingMultiplier * volumeMultiplier);

        // Cap at maxLiquidity
        return Math.min(targetLiquidity, this.config.maxLiquidity);
    }

    private async adjustLiquidity(targetLiquidity: number, currentLiquidity: number, metrics: any) {
        const difference = targetLiquidity - currentLiquidity;
        
        if (difference > 0) {
            await this.addLiquidity(difference);
            await this.notifyLiquidityIncrease(targetLiquidity, metrics);
        } else if (difference < 0 && currentLiquidity > this.config.minLiquidity) {
            await this.removeLiquidity(Math.abs(difference));
            await this.notifyLiquidityDecrease(targetLiquidity, metrics);
        }
    }

    private async addLiquidity(amount: number) {
        try {
            await this.token.addLiquidity(amount);
            this.emit('liquidityAdded', amount);
        } catch (error) {
            console.error('Error adding liquidity:', error);
            throw error;
        }
    }

    private async removeLiquidity(amount: number) {
        try {
            await this.token.removeLiquidity(amount);
            this.emit('liquidityRemoved', amount);
        } catch (error) {
            console.error('Error removing liquidity:', error);
            throw error;
        }
    }

    private async notifyLiquidityIncrease(targetLiquidity: number, metrics: any) {
        const message = `🌊 Liquidity Increase Alert!\n` +
            `New target: $${targetLiquidity.toLocaleString()}\n` +
            `Based on:\n` +
            `- ${metrics.streams.toLocaleString()} streams\n` +
            `- $${metrics.volume24h.toLocaleString()} 24h volume\n\n` +
            `Keep streaming to unlock more rewards! 🎵`;

        await this.communication.createCampaign({
            message,
            platforms: ['discord', 'telegram'],
            type: 'liquidity',
            metrics
        });
    }

    private async notifyLiquidityDecrease(targetLiquidity: number, metrics: any) {
        const message = `📊 Liquidity Adjustment\n` +
            `New target: $${targetLiquidity.toLocaleString()}\n` +
            `Current stats:\n` +
            `- ${metrics.streams.toLocaleString()} streams\n` +
            `- $${metrics.volume24h.toLocaleString()} 24h volume\n\n` +
            `Stream MORE to increase rewards! 🎯`;

        await this.communication.createCampaign({
            message,
            platforms: ['discord'],
            type: 'liquidity',
            metrics
        });
    }
} 