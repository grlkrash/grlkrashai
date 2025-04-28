import { EventEmitter } from 'events';
import { TokenContract } from '../../types/contracts';
import { SpotifyAnalyticsService } from '../analytics/SpotifyAnalyticsService';
import { TokenAnalyticsService } from '../analytics/TokenAnalyticsService';
import { AutoEngagementService } from '../engagement/AutoEngagementService';

interface LiquidityConfig {
    minLiquidity: number;
    adjustmentThreshold: number;
    cooldownPeriod: number;
    streamingCurveBase: number;
    initialPriceRange: { min: number; max: number };
}

export class DynamicLiquidityService extends EventEmitter {
    private lastAdjustment: number = 0;
    private isInitialPhase: boolean = true;

    constructor(
        private tokenContract: TokenContract,
        private spotifyAnalytics: SpotifyAnalyticsService,
        private tokenAnalytics: TokenAnalyticsService,
        private autoEngagement: AutoEngagementService,
        private config: LiquidityConfig = {
            minLiquidity: 0,
            adjustmentThreshold: 0.05,
            cooldownPeriod: 3600 * 24,
            streamingCurveBase: 1.00005,
            initialPriceRange: { min: 0.0001, max: 0.001 }
        }
    ) {
        super();
    }

    private calculateStreamingMultiplier(streams: number): number {
        // Parabolic growth: multiplier = base^(streams/10000)
        return Math.pow(this.config.streamingCurveBase, streams / 10000) - 1;
    }

    private calculateTargetLiquidity(metrics: any): number {
        if (this.isInitialPhase && metrics.tradingVolume24h < 1000) {
            return 0; // Allow natural price discovery
        }

        const streamingMultiplier = Math.pow(this.config.streamingCurveBase, metrics.totalStreams / 10000);
        return metrics.tradingVolume24h * streamingMultiplier;
    }

    async startMonitoring() {
        const checkMetrics = async () => {
            try {
                const now = Date.now();
                if (now - this.lastAdjustment < this.config.cooldownPeriod * 1000) return;

                // Get metrics
                const streamingMetrics = await this.spotifyAnalytics.getTrackMetrics('MORE');
                const tradingMetrics = await this.tokenAnalytics.getTradingMetrics();
                const currentLiquidity = await this.tokenAnalytics.getLiquidityUSD();

                const metrics = {
                    totalStreams: streamingMetrics.totalStreams,
                    tradingVolume24h: tradingMetrics.volume24h
                };
                
                await this.checkAndAdjustLiquidity(metrics, currentLiquidity);

                // Check for low liquidity conditions
                if (currentLiquidity < this.config.minLiquidity) {
                    await this.handleLowLiquidity(metrics);
                }
            } catch (error) {
                console.error('Error monitoring liquidity:', error);
                this.emit('monitoringError', error);
            }
        };

        // Check every hour
        setInterval(checkMetrics, 3600 * 1000);
        await checkMetrics(); // Initial check
    }

    private async handleLowLiquidity(metrics: any) {
        const incentiveMessage = `🚨 $MORE needs more liquidity!\n` +
            `Current streams: ${metrics.totalStreams}\n` +
            `24h Volume: $${metrics.tradingVolume24h.toLocaleString()}\n\n` +
            `🎯 Next milestone unlocks at ${this.getNextMilestone(metrics)} streams!\n` +
            `Add liquidity now to earn higher streaming rewards! 💰`;

        await this.autoEngagement.createCampaign({
            message: incentiveMessage,
            platforms: ['twitter', 'discord', 'telegram'],
            type: 'liquidity_alert',
            incentives: {
                rewardMultiplier: this.calculateStreamingMultiplier(metrics.totalStreams) + 0.5, // 50% bonus
                duration: 24 * 3600 // 24 hours
            }
        });
    }

    private getNextMilestone(metrics: any): string {
        const streamingMilestones = [10000, 50000, 100000, 500000, 1000000];
        const currentStreams = metrics.totalStreams;
        
        const nextMilestone = streamingMilestones.find(m => m > currentStreams);
        return nextMilestone ? nextMilestone.toLocaleString() : '1M+';
    }

    private async checkAndAdjustLiquidity(metrics: any, currentLiquidity: number) {
        const targetLiquidity = this.calculateTargetLiquidity(metrics);
        
        // Handle zero liquidity case
        if (currentLiquidity === 0) {
            if (metrics.tradingVolume24h > 1000) {
                this.isInitialPhase = false;
                await this.adjustLiquidity(targetLiquidity, 0);
            }
            return;
        }

        const percentChange = Math.abs(targetLiquidity - currentLiquidity) / currentLiquidity;
        if (percentChange >= this.config.adjustmentThreshold) {
            await this.adjustLiquidity(targetLiquidity, currentLiquidity);
        }
    }

    private async adjustLiquidity(targetLiquidity: number, currentLiquidity: number) {
        try {
            if (targetLiquidity > currentLiquidity) {
                await this.tokenContract.addLiquidity(targetLiquidity - currentLiquidity);
                this.emit('liquidityAdded', {
                    amount: targetLiquidity - currentLiquidity,
                    newTotal: targetLiquidity
                });
            } else {
                await this.tokenContract.removeLiquidity(currentLiquidity - targetLiquidity);
                this.emit('liquidityRemoved', {
                    amount: currentLiquidity - targetLiquidity,
                    newTotal: targetLiquidity
                });
            }
        } catch (error) {
            console.error('Error adjusting liquidity:', error);
            this.emit('adjustmentError', error);
        }
    }

    private async notifyAdjustment(targetLiquidity: number, currentLiquidity: number, metrics: any) {
        const action = targetLiquidity > currentLiquidity ? 'increased' : 'decreased';
        const changeAmount = Math.abs(targetLiquidity - currentLiquidity);
        const changePercent = (changeAmount / currentLiquidity * 100).toFixed(2);
        const multiplier = this.calculateStreamingMultiplier(metrics.totalStreams);

        const message = `📊 $MORE Liquidity Update:\n` +
            `Liquidity ${action} by ${changePercent}% based on ${metrics.totalStreams.toLocaleString()} streams! 🎵\n` +
            `Current multiplier: ${(multiplier * 100).toFixed(2)}%\n` +
            `New liquidity: $${targetLiquidity.toLocaleString()}\n\n` +
            `🎯 Next milestone: ${this.getNextMilestone(metrics)} streams\n` +
            `Keep streaming to boost the liquidity! 🚀`;

        await this.autoEngagement.createAnnouncement({
            message,
            platforms: ['twitter', 'discord', 'telegram'],
            type: 'liquidity_update',
            metrics: {
                streams: metrics.totalStreams,
                liquidityChange: changeAmount,
                newLiquidity: targetLiquidity,
                multiplier
            }
        });
    }
} 