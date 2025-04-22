import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { MarketingInsights } from './MarketingStrategyAnalyzer';
import { TokenMetrics } from './TokenAnalyticsService';

interface PlatformMetrics {
    reach: number;
    engagement: {
        likes: number;
        comments: number;
        shares: number;
        saves: number;
    };
    conversion: {
        clicks: number;
        streams: number;
        saves: number;
        purchases: number;
    };
    revenue: {
        streaming: number;
        tokenSales: number;
        merchandise: number;
    };
}

interface CrossPlatformInsights {
    performanceByPlatform: Map<string, PlatformMetrics>;
    audienceOverlap: Map<string, number>;
    contentSynergy: {
        bestPerforming: string[];
        recommendations: string[];
    };
    timing: {
        optimalPostTimes: Map<string, number[]>;
        platformSpecificTiming: boolean;
    };
}

interface AdvancedMetrics extends PlatformMetrics {
    sentiment: number;
    topics: string[];
    viralityScore: number;
    audienceRetention: number;
    predictedGrowth: number;
}

interface OptimizationResult {
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
    actions: string[];
    metrics: {
        currentScore: number;
        targetScore: number;
        confidence: number;
    };
}

export class AnalyticsService extends EventEmitter {
    private runtime: IAgentRuntime;
    private platformMetrics: Map<string, PlatformMetrics[]>;
    private insights: Map<string, CrossPlatformInsights>;
    private advancedMetrics: Map<string, AdvancedMetrics>;
    private readonly METRICS_RETENTION_DAYS = 90;
    private readonly OPTIMIZATION_THRESHOLD = 0.7;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.platformMetrics = new Map();
        this.insights = new Map();
        this.advancedMetrics = new Map();
    }

    async trackMetrics(
        platform: string,
        metrics: PlatformMetrics,
        insights: MarketingInsights,
        tokenMetrics: any
    ): Promise<void> {
        // Get existing metrics array or create new one
        const existingMetrics = this.platformMetrics.get(platform) || [];
        
        // Add new metrics
        existingMetrics.push({
            ...metrics,
            timestamp: new Date()
        });

        // Clean up old metrics
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.METRICS_RETENTION_DAYS);
        const filteredMetrics = existingMetrics.filter(m => m.timestamp > cutoffDate);

        // Update stored metrics
        this.platformMetrics.set(platform, filteredMetrics);

        // Generate new insights
        await this.generateInsights(platform, filteredMetrics, insights, tokenMetrics);
    }

    async trackRelease(releaseData: {
        title: string;
        platforms: Record<string, string>;
        metadata: any;
        ipfsHashes: {
            song: string;
            art: string;
        };
    }): Promise<void> {
        // Initialize tracking for each platform
        for (const [platform, id] of Object.entries(releaseData.platforms)) {
            this.platformMetrics.set(platform, []);
            await this.initializePlatformTracking(platform, id, releaseData);
        }

        // Set up cross-platform monitoring
        this.setupCrossPlatformMonitoring(releaseData);
    }

    private async generateInsights(
        platform: string,
        metrics: PlatformMetrics[],
        marketingInsights: MarketingInsights,
        tokenMetrics: any
    ): Promise<void> {
        const insights: CrossPlatformInsights = {
            performanceByPlatform: new Map(),
            audienceOverlap: new Map(),
            contentSynergy: {
                bestPerforming: [],
                recommendations: []
            },
            timing: {
                optimalPostTimes: new Map(),
                platformSpecificTiming: false
            }
        };

        // Analyze platform performance
        insights.performanceByPlatform.set(platform, this.calculateAggregateMetrics(metrics));

        // Calculate audience overlap
        insights.audienceOverlap = await this.calculateAudienceOverlap(platform, metrics);

        // Analyze content synergy
        insights.contentSynergy = await this.analyzeContentSynergy(platform, metrics, marketingInsights);

        // Determine optimal timing
        insights.timing = await this.analyzeOptimalTiming(platform, metrics);

        // Store insights
        this.insights.set(platform, insights);

        // Emit insights update event
        this.emit('insightsUpdated', { platform, insights });
    }

    private calculateAggregateMetrics(metrics: PlatformMetrics[]): PlatformMetrics {
        return metrics.reduce((acc, curr) => ({
            reach: acc.reach + curr.reach,
            engagement: {
                likes: acc.engagement.likes + curr.engagement.likes,
                comments: acc.engagement.comments + curr.engagement.comments,
                shares: acc.engagement.shares + curr.engagement.shares,
                saves: acc.engagement.saves + curr.engagement.saves
            },
            conversion: {
                clicks: acc.conversion.clicks + curr.conversion.clicks,
                streams: acc.conversion.streams + curr.conversion.streams,
                saves: acc.conversion.saves + curr.conversion.saves,
                purchases: acc.conversion.purchases + curr.conversion.purchases
            },
            revenue: {
                streaming: acc.revenue.streaming + curr.revenue.streaming,
                tokenSales: acc.revenue.tokenSales + curr.revenue.tokenSales,
                merchandise: acc.revenue.merchandise + curr.revenue.merchandise
            }
        }));
    }

    private async calculateAudienceOverlap(
        platform: string,
        metrics: PlatformMetrics[]
    ): Promise<Map<string, number>> {
        const overlap = new Map<string, number>();
        const otherPlatforms = Array.from(this.platformMetrics.keys())
            .filter(p => p !== platform);

        for (const otherPlatform of otherPlatforms) {
            const otherMetrics = this.platformMetrics.get(otherPlatform) || [];
            const overlapScore = this.calculateOverlapScore(metrics, otherMetrics);
            overlap.set(otherPlatform, overlapScore);
        }

        return overlap;
    }

    private calculateOverlapScore(
        metricsA: PlatformMetrics[],
        metricsB: PlatformMetrics[]
    ): number {
        // Simple overlap calculation based on engagement patterns
        const engagementA = metricsA.reduce((sum, m) => sum + 
            m.engagement.likes + m.engagement.comments + m.engagement.shares, 0);
        const engagementB = metricsB.reduce((sum, m) => sum + 
            m.engagement.likes + m.engagement.comments + m.engagement.shares, 0);

        return Math.min(engagementA, engagementB) / Math.max(engagementA, engagementB);
    }

    private async analyzeContentSynergy(
        platform: string,
        metrics: PlatformMetrics[],
        marketingInsights: MarketingInsights
    ): Promise<{
        bestPerforming: string[];
        recommendations: string[];
    }> {
        // Sort metrics by engagement
        const sortedMetrics = [...metrics].sort((a, b) => 
            (b.engagement.likes + b.engagement.comments + b.engagement.shares) -
            (a.engagement.likes + a.engagement.comments + a.engagement.shares)
        );

        // Get top performing content
        const bestPerforming = sortedMetrics
            .slice(0, 5)
            .map(m => m.contentId || '');

        // Generate recommendations based on performance
        const recommendations = this.generateContentRecommendations(
            bestPerforming,
            marketingInsights
        );

        return {
            bestPerforming,
            recommendations
        };
    }

    private generateContentRecommendations(
        bestPerforming: string[],
        marketingInsights: MarketingInsights
    ): string[] {
        const recommendations: string[] = [];

        // Analyze common patterns in best performing content
        const patterns = this.analyzeContentPatterns(bestPerforming);

        // Generate recommendations based on patterns and insights
        if (patterns.visualStyle) {
            recommendations.push(`Maintain ${patterns.visualStyle} visual style`);
        }

        if (patterns.contentType) {
            recommendations.push(`Focus on ${patterns.contentType} content`);
        }

        if (marketingInsights.targetAudience) {
            recommendations.push(
                `Tailor content for ${marketingInsights.targetAudience.join(', ')} audience`
            );
        }

        return recommendations;
    }

    private analyzeContentPatterns(contentIds: string[]): {
        visualStyle?: string;
        contentType?: string;
    } {
        // Implementation would analyze content patterns
        return {};
    }

    private async analyzeOptimalTiming(
        platform: string,
        metrics: PlatformMetrics[]
    ): Promise<{
        optimalPostTimes: Map<string, number[]>;
        platformSpecificTiming: boolean;
    }> {
        const optimalPostTimes = new Map<string, number[]>();
        const engagementByHour = new Array(24).fill(0);

        // Analyze engagement patterns by hour
        metrics.forEach(m => {
            const hour = new Date(m.timestamp).getHours();
            const engagement = m.engagement.likes + m.engagement.comments + m.engagement.shares;
            engagementByHour[hour] += engagement;
        });

        // Find peak engagement hours
        const peakHours = this.findPeakHours(engagementByHour);
        optimalPostTimes.set(platform, peakHours);

        // Determine if platform needs specific timing
        const platformSpecificTiming = this.needsPlatformSpecificTiming(
            platform,
            peakHours
        );

        return {
            optimalPostTimes,
            platformSpecificTiming
        };
    }

    private findPeakHours(engagementByHour: number[]): number[] {
        const threshold = Math.max(...engagementByHour) * 0.8;
        return engagementByHour
            .map((engagement, hour) => ({ hour, engagement }))
            .filter(({ engagement }) => engagement >= threshold)
            .map(({ hour }) => hour)
            .sort((a, b) => a - b);
    }

    private needsPlatformSpecificTiming(
        platform: string,
        peakHours: number[]
    ): boolean {
        // Compare peak hours with other platforms
        const otherPlatforms = Array.from(this.insights.keys())
            .filter(p => p !== platform);

        for (const otherPlatform of otherPlatforms) {
            const otherInsights = this.insights.get(otherPlatform);
            if (!otherInsights) continue;

            const otherPeakHours = otherInsights.timing.optimalPostTimes.get(otherPlatform);
            if (!otherPeakHours) continue;

            // Check for significant overlap in peak hours
            const overlap = peakHours.filter(hour => otherPeakHours.includes(hour));
            if (overlap.length < Math.min(peakHours.length, otherPeakHours.length) * 0.5) {
                return true;
            }
        }

        return false;
    }

    private async initializePlatformTracking(
        platform: string,
        contentId: string,
        releaseData: any
    ): Promise<void> {
        // Set up platform-specific tracking
        const tracking = {
            contentId,
            platform,
            startTime: new Date(),
            metadata: releaseData.metadata,
            metrics: []
        };

        // Store tracking data
        this.platformMetrics.set(platform, []);

        // Emit tracking initialized event
        this.emit('trackingInitialized', { platform, contentId });
    }

    private setupCrossPlatformMonitoring(releaseData: any): void {
        // Set up interval for cross-platform analysis
        const monitoringInterval = setInterval(async () => {
            try {
                await this.performCrossPlatformAnalysis(releaseData);
            } catch (error) {
                console.error('Cross-platform analysis error:', error);
            }
        }, 3600000); // Every hour

        // Clean up after 90 days
        setTimeout(() => {
            clearInterval(monitoringInterval);
            this.emit('monitoringComplete', releaseData);
        }, this.METRICS_RETENTION_DAYS * 24 * 3600000);
    }

    private async performCrossPlatformAnalysis(releaseData: any): Promise<void> {
        const platforms = Object.keys(releaseData.platforms);
        const analysis = {
            timestamp: new Date(),
            platforms: new Map<string, PlatformMetrics>(),
            crossPlatformMetrics: {
                totalReach: 0,
                totalEngagement: 0,
                conversionRate: 0,
                revenue: 0
            }
        };

        // Gather metrics from all platforms
        for (const platform of platforms) {
            const metrics = this.platformMetrics.get(platform);
            if (!metrics || metrics.length === 0) continue;

            const latestMetrics = metrics[metrics.length - 1];
            analysis.platforms.set(platform, latestMetrics);

            // Update cross-platform totals
            analysis.crossPlatformMetrics.totalReach += latestMetrics.reach;
            analysis.crossPlatformMetrics.totalEngagement += 
                latestMetrics.engagement.likes +
                latestMetrics.engagement.comments +
                latestMetrics.engagement.shares;
            analysis.crossPlatformMetrics.revenue +=
                latestMetrics.revenue.streaming +
                latestMetrics.revenue.tokenSales +
                latestMetrics.revenue.merchandise;
        }

        // Calculate conversion rate
        if (analysis.crossPlatformMetrics.totalReach > 0) {
            analysis.crossPlatformMetrics.conversionRate =
                analysis.crossPlatformMetrics.totalEngagement /
                analysis.crossPlatformMetrics.totalReach;
        }

        // Emit analysis results
        this.emit('crossPlatformAnalysis', analysis);
    }

    // New methods from AdvancedAnalyticsService
    async analyzeAdvancedMetrics(
        platform: string,
        metrics: PlatformMetrics,
        tokenMetrics: TokenMetrics
    ): Promise<AdvancedMetrics> {
        const advanced: AdvancedMetrics = {
            ...metrics,
            sentiment: await this.calculateSentiment(platform),
            topics: await this.extractTopics(platform),
            viralityScore: this.calculateViralityScore(metrics),
            audienceRetention: this.calculateAudienceRetention(metrics),
            predictedGrowth: this.predictGrowth(metrics, tokenMetrics)
        };

        this.advancedMetrics.set(platform, advanced);
        return advanced;
    }

    private calculateSentiment(platform: string): Promise<number> {
        const metrics = this.platformMetrics.get(platform) || [];
        const engagement = metrics.reduce((sum, m) => 
            sum + m.engagement.likes - (m.engagement.comments * 0.2), 0);
        return Promise.resolve(Math.min(Math.max(engagement / (metrics.length || 1), 0), 1));
    }

    private async extractTopics(platform: string): Promise<string[]> {
        // Implementation would analyze content and extract topics
        return [];
    }

    private calculateViralityScore(metrics: PlatformMetrics): number {
        const shareRate = metrics.engagement.shares / (metrics.reach || 1);
        const saveRate = metrics.engagement.saves / (metrics.reach || 1);
        return (shareRate * 0.7 + saveRate * 0.3);
    }

    private calculateAudienceRetention(metrics: PlatformMetrics): number {
        return metrics.conversion.saves / (metrics.conversion.clicks || 1);
    }

    private predictGrowth(metrics: PlatformMetrics, tokenMetrics: TokenMetrics): number {
        const engagementRate = (
            metrics.engagement.likes + 
            metrics.engagement.comments + 
            metrics.engagement.shares
        ) / (metrics.reach || 1);
        
        const tokenGrowth = tokenMetrics.priceChange24h > 0 ? 1.2 : 0.8;
        return engagementRate * tokenGrowth;
    }

    async optimizePerformance(
        platform: string,
        currentMetrics: AdvancedMetrics
    ): Promise<OptimizationResult> {
        const recommendations: string[] = [];
        const actions: string[] = [];
        let priority: 'high' | 'medium' | 'low' = 'medium';

        const currentScore = this.calculatePerformanceScore(currentMetrics);
        const targetScore = currentScore * 1.2; // Aim for 20% improvement

        if (currentScore < this.OPTIMIZATION_THRESHOLD) {
            priority = 'high';
            recommendations.push(
                'Increase posting frequency',
                'Diversify content types',
                'Engage with audience more actively'
            );
            actions.push(
                'Schedule more posts',
                'Create varied content mix',
                'Respond to comments within 2 hours'
            );
        } else if (currentScore < 0.85) {
            priority = 'medium';
            recommendations.push(
                'Fine-tune posting schedule',
                'Test new content formats'
            );
            actions.push(
                'Analyze best performing times',
                'Create A/B test content'
            );
        } else {
            priority = 'low';
            recommendations.push('Maintain current strategy');
            actions.push('Monitor metrics');
        }

        return {
            recommendations,
            priority,
            actions,
            metrics: {
                currentScore,
                targetScore,
                confidence: this.calculateConfidenceScore(currentMetrics)
            }
        };
    }

    private calculatePerformanceScore(metrics: AdvancedMetrics): number {
        const engagementScore = metrics.engagement.likes / (metrics.reach || 1);
        const viralityScore = metrics.viralityScore;
        const retentionScore = metrics.audienceRetention;
        
        return (engagementScore * 0.4 + viralityScore * 0.3 + retentionScore * 0.3);
    }

    private calculateConfidenceScore(metrics: AdvancedMetrics): number {
        const dataPoints = Object.values(metrics.engagement).reduce((sum, val) => sum + val, 0);
        return Math.min(dataPoints / 1000, 1); // Normalize to 0-1
    }
} 
