import { DexScreenerPlugin } from '@elizaos/plugin-dexscreener';
import { IAgentRuntime } from '@elizaos/core';

export interface TokenMetrics {
    price: number;
    marketCap: number;
    volume24h: number;
    liquidity: number;
    priceChange24h: number;
    holders: number;
}

export interface MarketTrend {
    direction: 'up' | 'down' | 'stable';
    strength: number; // 0-1
    confidence: number; // 0-1
    timeframe: '1h' | '24h' | '7d';
}

export class TokenAnalyticsService {
    private dexscreener: any; // Will be initialized with DexScreenerPlugin
    private runtime: IAgentRuntime;
    private tokenAddress: string;
    private chainId: string;
    private lastAnalysis: Date | null = null;
    private cachedMetrics: TokenMetrics | null = null;

    constructor(runtime: IAgentRuntime, tokenAddress: string, chainId: string) {
        this.runtime = runtime;
        this.tokenAddress = tokenAddress;
        this.chainId = chainId;
    }

    async initialize() {
        this.dexscreener = await DexScreenerPlugin.start(this.runtime);
    }

    async getTokenMetrics(forceRefresh = false): Promise<TokenMetrics> {
        if (!this.dexscreener) {
            throw new Error('DexScreener plugin not initialized');
        }

        // Cache metrics for 5 minutes unless force refresh
        if (!forceRefresh && this.cachedMetrics && this.lastAnalysis 
            && (new Date().getTime() - this.lastAnalysis.getTime() < 5 * 60 * 1000)) {
            return this.cachedMetrics;
        }

        const pairData = await this.dexscreener.getPairData(this.chainId, this.tokenAddress);
        
        this.cachedMetrics = {
            price: pairData.priceUsd,
            marketCap: pairData.marketCap,
            volume24h: pairData.volume24h,
            liquidity: pairData.liquidity.usd,
            priceChange24h: pairData.priceChange.h24,
            holders: pairData.holders || 0
        };

        this.lastAnalysis = new Date();
        return this.cachedMetrics;
    }

    async analyzeMarketTrend(timeframe: '1h' | '24h' | '7d'): Promise<MarketTrend> {
        const metrics = await this.getTokenMetrics(true);
        const priceHistory = await this.dexscreener.getPriceHistory(
            this.chainId,
            this.tokenAddress,
            timeframe
        );

        // Analyze price movement and volume
        const trend = this.calculateTrend(priceHistory, metrics);
        return trend;
    }

    async shouldExecutePromotionalCampaign(): Promise<{
        should: boolean;
        reason: string;
        suggestedBudget?: number;
    }> {
        const metrics = await this.getTokenMetrics();
        const trend = await this.analyzeMarketTrend('24h');

        // Decision matrix for promotional campaigns
        if (trend.direction === 'up' && trend.strength > 0.7) {
            return {
                should: true,
                reason: 'Strong upward momentum - capitalize on positive sentiment',
                suggestedBudget: Math.min(metrics.volume24h * 0.01, 1000) // 1% of 24h volume, max $1000
            };
        }

        if (trend.direction === 'down' && trend.strength > 0.5) {
            return {
                should: true,
                reason: 'Market correction - increase visibility to stabilize price',
                suggestedBudget: Math.min(metrics.volume24h * 0.02, 1500) // 2% of 24h volume, max $1500
            };
        }

        return {
            should: false,
            reason: 'Market conditions don\'t warrant promotional campaign at this time'
        };
    }

    async monitorMilestones(): Promise<{
        reached: string[];
        next: { milestone: string; remaining: number; }
    }> {
        const metrics = await this.getTokenMetrics();
        const reached = [];
        let nextMilestone = { milestone: '', remaining: Infinity };

        // Market cap milestones
        const marketCapMilestones = [100000, 500000, 1000000, 5000000];
        for (const milestone of marketCapMilestones) {
            if (metrics.marketCap >= milestone) {
                reached.push(`Market cap $${milestone.toLocaleString()}`);
            } else if (metrics.marketCap < milestone && milestone - metrics.marketCap < nextMilestone.remaining) {
                nextMilestone = {
                    milestone: `Market cap $${milestone.toLocaleString()}`,
                    remaining: milestone - metrics.marketCap
                };
                break;
            }
        }

        return { reached, next: nextMilestone };
    }

    private calculateTrend(priceHistory: any[], currentMetrics: TokenMetrics): MarketTrend {
        // Implement trend analysis using price history data
        // This is a simplified example - you would want more sophisticated analysis
        const lastPrice = priceHistory[priceHistory.length - 1].price;
        const firstPrice = priceHistory[0].price;
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

        const direction = priceChange > 1 ? 'up' : priceChange < -1 ? 'down' : 'stable';
        const strength = Math.min(Math.abs(priceChange) / 10, 1); // Normalize to 0-1
        const confidence = 0.8; // Would be calculated based on volume, liquidity, etc.

        return {
            direction,
            strength,
            confidence,
            timeframe: '24h'
        };
    }

    async cleanup() {
        if (this.dexscreener) {
            await DexScreenerPlugin.stop(this.runtime);
        }
    }
} 