import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { AnalyticsService } from '../analytics/AnalyticsService';
import { ContentService } from '../content/ContentService';
import { BaseOptimizer } from './BaseOptimizer';
import { OptimizationOptions } from './BaseOptimizer';
import { LearningOptimizer } from './LearningOptimizer';
import { optimizationConfig } from '../../config/optimization.config';
import { ApprovalWorkflow } from './ApprovalWorkflow';

interface OptimizationMetrics {
    engagement: number;
    reach: number;
    conversion: number;
    performance: {
        score: number;
        factors: {
            factor: string;
            weight: number;
        }[];
    };
}

interface CrossPlatformInsights {
    bestPerformingPlatforms: string[];
    commonAudience: string[];
    contentAdaptations: {
        sourcePlatform: string;
        targetPlatform: string;
        adaptationScore: number;
    }[];
    globalTrends: {
        hashtags: string[];
        topics: string[];
        timing: {
            bestTimes: Date[];
            timeZones: string[];
        };
    };
}

interface AutoOptimizationResult {
    platform: string;
    contentId: string;
    metrics: OptimizationMetrics;
    changes: {
        type: string;
        before: any;
        after: any;
        impact: number;
    }[];
    confidence: number;
    timestamp: Date;
}

export class OptimizationManager extends EventEmitter {
    private runtime: IAgentRuntime;
    private optimizers: Map<string, BaseOptimizer<any, any, any>>;
    private analyticsService: AnalyticsService;
    private contentService: ContentService;
    private optimizationHistory: Map<string, OptimizationMetrics>;
    private crossPlatformInsights: CrossPlatformInsights;
    private learningOptimizer: LearningOptimizer;
    private autoOptimizationHistory: Map<string, AutoOptimizationResult[]>;
    private approvalWorkflow: ApprovalWorkflow;
    private readonly OPTIMIZATION_INTERVAL = 60 * 60 * 1000; // 1 hour
    private optimizationTimer: NodeJS.Timeout | null = null;

    constructor(
        runtime: IAgentRuntime,
        analyticsService: AnalyticsService,
        contentService: ContentService
    ) {
        super();
        this.runtime = runtime;
        this.analyticsService = analyticsService;
        this.contentService = contentService;
        this.optimizers = new Map();
        this.optimizationHistory = new Map();
        this.autoOptimizationHistory = new Map();
        this.crossPlatformInsights = this.initializeCrossPlatformInsights();
        this.learningOptimizer = new LearningOptimizer(runtime);
        this.approvalWorkflow = new ApprovalWorkflow(
            analyticsService,
            contentService,
            {
                minConfidence: optimizationConfig.globalSettings.minPerformanceScore,
                maxRiskLevel: 'medium',
                minPredictedImprovement: 0.1
            }
        );
    }

    registerOptimizer(platform: string, optimizer: BaseOptimizer<any, any, any>): void {
        this.optimizers.set(platform, optimizer);
        
        // Listen for optimization events
        optimizer.on('optimizationError', (error) => {
            this.emit('optimizerError', { platform, error });
        });
    }

    async optimizeContent(
        platform: string,
        contentId: string,
        metadata: any,
        options?: OptimizationOptions
    ): Promise<any> {
        const optimizer = this.optimizers.get(platform);
        if (!optimizer) {
            throw new Error(`No optimizer registered for platform: ${platform}`);
        }

        // Get analytics insights
        const metrics = await this.analyticsService.getContentMetrics(contentId);
        const insights = await this.generateOptimizationInsights(platform, contentId, metrics);

        // Extract features for learning
        const features = await this.extractFeatures(platform, contentId, metadata, metrics);

        // Get performance prediction
        const prediction = await this.learningOptimizer.predictPerformance(
            platform,
            contentId,
            features
        );

        // Enhance options with insights and prediction
        const enhancedOptions = {
            ...options,
            insights,
            crossPlatformData: this.crossPlatformInsights,
            prediction
        };

        // Perform optimization
        const optimizedContent = await optimizer.optimizeContent(metadata, enhancedOptions);

        // Track optimization and train model
        await this.trackOptimization(platform, contentId, optimizedContent, metrics);
        await this.learningOptimizer.trainModel(platform, contentId, features, metrics);

        return optimizedContent;
    }

    private async generateOptimizationInsights(
        platform: string,
        contentId: string,
        metrics: any
    ): Promise<any> {
        // Get platform-specific insights
        const platformInsights = await this.analyticsService.getPlatformInsights(platform);
        
        // Get content-specific insights
        const contentInsights = await this.contentService.getContentInsights(contentId);

        // Combine insights
        return {
            platform: platformInsights,
            content: contentInsights,
            historical: this.optimizationHistory.get(contentId)
        };
    }

    private async extractFeatures(
        platform: string,
        contentId: string,
        metadata: any,
        metrics: OptimizationMetrics
    ): Promise<any> {
        const insights = await this.analyticsService.getContentInsights(contentId);
        const audience = await this.analyticsService.getAudienceInsights(platform);
        const recentTrends = await this.analyticsService.getRecentTrends(platform);

        return {
            // Content features
            contentLength: this.calculateContentLength(metadata),
            hasMedia: this.hasMediaContent(metadata),
            mediaType: this.getMediaType(metadata),
            hashtagCount: this.getHashtagCount(metadata),
            mentionCount: this.getMentionCount(metadata),
            
            // Performance metrics
            engagement: metrics.engagement,
            reach: metrics.reach,
            conversion: metrics.conversion,
            
            // Audience insights
            audienceSize: audience.size,
            audienceInterests: audience.interests,
            audienceActivity: audience.activityPattern,
            
            // Trend alignment
            trendAlignment: this.calculateTrendAlignment(metadata, recentTrends),
            contentFreshness: this.calculateContentFreshness(metadata),
            
            // Historical performance
            volatility: this.calculatePerformanceVolatility(metrics),
            improvement: this.calculateHistoricalImprovement(contentId),
            
            // Platform-specific features
            ...this.getPlatformSpecificFeatures(platform, metadata)
        };
    }

    private calculateContentLength(metadata: any): number {
        if (typeof metadata.text === 'string') return metadata.text.length;
        if (typeof metadata.caption === 'string') return metadata.caption.length;
        if (metadata.duration) return metadata.duration;
        return 0;
    }

    private hasMediaContent(metadata: any): boolean {
        return !!(metadata.mediaUrls?.length || metadata.videoUrl || metadata.imageUrl);
    }

    private getMediaType(metadata: any): string {
        if (metadata.videoUrl) return 'video';
        if (metadata.imageUrl) return 'image';
        if (metadata.mediaUrls?.length > 1) return 'carousel';
        if (metadata.mediaUrls?.length === 1) {
            return metadata.mediaUrls[0].includes('video') ? 'video' : 'image';
        }
        return 'text';
    }

    private getHashtagCount(metadata: any): number {
        return (metadata.hashtags?.length || 0) + 
               ((metadata.text || metadata.caption || '').match(/#\w+/g) || []).length;
    }

    private getMentionCount(metadata: any): number {
        return (metadata.mentions?.length || 0) + 
               ((metadata.text || metadata.caption || '').match(/@\w+/g) || []).length;
    }

    private calculateTrendAlignment(metadata: any, trends: any): number {
        // Implementation would calculate how well content aligns with current trends
        return 0.5;
    }

    private calculateContentFreshness(metadata: any): number {
        const createdAt = new Date(metadata.createdAt || Date.now());
        const age = Date.now() - createdAt.getTime();
        return Math.max(0, 1 - age / (7 * 24 * 60 * 60 * 1000)); // 1 week decay
    }

    private calculatePerformanceVolatility(metrics: OptimizationMetrics): number {
        // Implementation would calculate performance stability over time
        return 0.3;
    }

    private calculateHistoricalImprovement(contentId: string): number {
        const history = this.optimizationHistory.get(contentId);
        if (!history) return 0;

        // Calculate average improvement from optimizations
        return 0.1;
    }

    private getPlatformSpecificFeatures(platform: string, metadata: any): any {
        switch (platform) {
            case 'twitter':
                return {
                    isThread: Array.isArray(metadata.threadParts),
                    threadLength: metadata.threadParts?.length || 1,
                    hasCard: !!metadata.card
                };
            case 'instagram':
                return {
                    isReel: metadata.format === 'reel',
                    isCarousel: metadata.mediaUrls?.length > 1,
                    filterUsed: !!metadata.filter
                };
            case 'youtube':
                return {
                    isShort: metadata.format === 'short',
                    hasChapters: !!metadata.chapters?.length,
                    hasEndScreen: !!metadata.endScreen
                };
            case 'tiktok':
                return {
                    hasDuet: metadata.allowDuet,
                    hasStitch: metadata.allowStitch,
                    usesEffect: !!metadata.effects?.length
                };
            default:
                return {};
        }
    }

    private async trackOptimization(
        platform: string,
        contentId: string,
        optimizedContent: any,
        metrics: OptimizationMetrics
    ): Promise<void> {
        // Store optimization result
        this.optimizationHistory.set(contentId, metrics);

        // Update cross-platform insights
        await this.updateCrossPlatformInsights(platform, contentId, metrics);

        // Emit optimization event
        this.emit('optimizationComplete', {
            platform,
            contentId,
            metrics,
            optimizedContent
        });
    }

    private async updateCrossPlatformInsights(
        platform: string,
        contentId: string,
        metrics: OptimizationMetrics
    ): Promise<void> {
        // Update best performing platforms
        this.updateBestPerformingPlatforms(platform, metrics);

        // Update common audience
        await this.updateCommonAudience(platform, contentId);

        // Update global trends
        await this.updateGlobalTrends(platform);

        // Calculate content adaptations
        await this.updateContentAdaptations(platform, contentId);
    }

    private updateBestPerformingPlatforms(
        platform: string,
        metrics: OptimizationMetrics
    ): void {
        const platforms = this.crossPlatformInsights.bestPerformingPlatforms;
        const index = platforms.indexOf(platform);

        if (metrics.performance.score > 0.7) {
            if (index === -1) {
                platforms.push(platform);
            }
        } else if (index !== -1) {
            platforms.splice(index, 1);
        }

        // Sort by performance
        platforms.sort((a, b) => {
            const aMetrics = this.optimizationHistory.get(a);
            const bMetrics = this.optimizationHistory.get(b);
            return (bMetrics?.performance.score || 0) - (aMetrics?.performance.score || 0);
        });
    }

    private async updateCommonAudience(platform: string, contentId: string): Promise<void> {
        const audienceInsights = await this.analyticsService.getAudienceInsights(platform, contentId);
        
        // Update common audience across platforms
        this.crossPlatformInsights.commonAudience = audienceInsights.segments;
    }

    private async updateGlobalTrends(platform: string): Promise<void> {
        const trends = await this.analyticsService.getPlatformTrends(platform);
        
        // Merge with existing trends
        this.crossPlatformInsights.globalTrends.hashtags = [
            ...new Set([
                ...this.crossPlatformInsights.globalTrends.hashtags,
                ...trends.hashtags
            ])
        ];

        this.crossPlatformInsights.globalTrends.topics = [
            ...new Set([
                ...this.crossPlatformInsights.globalTrends.topics,
                ...trends.topics
            ])
        ];
    }

    private async updateContentAdaptations(
        platform: string,
        contentId: string
    ): Promise<void> {
        const adaptations = await this.contentService.generateAdaptationStrategy(
            platform,
            contentId,
            this.crossPlatformInsights
        );

        this.crossPlatformInsights.contentAdaptations = adaptations;
    }

    private initializeCrossPlatformInsights(): CrossPlatformInsights {
        return {
            bestPerformingPlatforms: [],
            commonAudience: [],
            contentAdaptations: [],
            globalTrends: {
                hashtags: [],
                topics: [],
                timing: {
                    bestTimes: [],
                    timeZones: []
                }
            }
        };
    }

    async startAutoOptimization(): Promise<void> {
        if (this.optimizationTimer) {
            return;
        }

        await this.runAutoOptimization();
        this.optimizationTimer = setInterval(
            () => this.runAutoOptimization(),
            this.OPTIMIZATION_INTERVAL
        );
    }

    async stopAutoOptimization(): Promise<void> {
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
            this.optimizationTimer = null;
        }
    }

    private async runAutoOptimization(): Promise<void> {
        try {
            for (const [platform, optimizer] of this.optimizers.entries()) {
                const config = optimizationConfig.platforms[platform];
                if (!config?.enabled) continue;

                const contentToOptimize = await this.findContentNeedingOptimization(platform);
                for (const content of contentToOptimize) {
                    if (await this.shouldOptimizeContent(platform, content.id)) {
                        await this.performAutoOptimization(platform, content);
                    }
                }
            }
        } catch (error) {
            console.error('Auto optimization error:', error);
            this.emit('autoOptimizationError', error);
        }
    }

    private async shouldOptimizeContent(platform: string, contentId: string): Promise<boolean> {
        const config = optimizationConfig.platforms[platform];
        const metrics = await this.analyticsService.getContentMetrics(contentId);
        const history = this.autoOptimizationHistory.get(contentId) || [];

        // Check if we've hit the daily optimization limit
        const todayOptimizations = history.filter(
            result => result.timestamp.toDateString() === new Date().toDateString()
        ).length;
        if (todayOptimizations >= optimizationConfig.globalSettings.maxOptimizationsPerDay) {
            return false;
        }

        // Check if metrics are below thresholds
        return (
            metrics.engagement < config.thresholds.engagement ||
            metrics.reach < config.thresholds.reach ||
            metrics.conversion < config.thresholds.conversion
        );
    }

    private async performAutoOptimization(
        platform: string,
        content: any
    ): Promise<void> {
        const originalMetrics = await this.analyticsService.getContentMetrics(content.id);
        const features = await this.extractFeatures(platform, content.id, content, originalMetrics);
        
        // Get performance prediction
        const prediction = await this.learningOptimizer.predictPerformance(
            platform,
            content.id,
            features
        );

        // Only proceed if we're confident enough
        if (prediction.confidence < optimizationConfig.globalSettings.minPerformanceScore) {
            this.emit('optimizationSkipped', {
                platform,
                contentId: content.id,
                reason: 'Low confidence score'
            });
            return;
        }

        // Perform optimization
        const optimizedContent = await this.optimizeContent(
            platform,
            content.id,
            content,
            {
                prediction,
                isAutoOptimization: true
            }
        );

        // Get approval through workflow
        const evaluation = await this.approvalWorkflow.evaluateOptimization(
            platform,
            content.id,
            content,
            optimizedContent
        );

        if (!evaluation.approved) {
            this.emit('optimizationRejected', {
                platform,
                contentId: content.id,
                reason: evaluation.reason,
                proposal: evaluation.proposal
            });
            return;
        }

        // Record optimization
        const result: AutoOptimizationResult = {
            platform,
            contentId: content.id,
            metrics: originalMetrics,
            changes: this.detectChanges(content, optimizedContent),
            confidence: prediction.confidence,
            timestamp: new Date()
        };

        // Update history
        const history = this.autoOptimizationHistory.get(content.id) || [];
        history.push(result);
        this.autoOptimizationHistory.set(content.id, history);

        // Emit event
        this.emit('autoOptimizationComplete', result);

        // Auto-publish if enabled
        if (optimizationConfig.globalSettings.autoPublish && !optimizationConfig.globalSettings.requireApproval) {
            await this.publishOptimization(platform, content.id, optimizedContent);
        }
    }

    private async findContentNeedingOptimization(platform: string): Promise<any[]> {
        const config = optimizationConfig.platforms[platform];
        const schedule = config.schedule;

        // Check if it's time to optimize based on schedule
        const now = new Date();
        const [scheduledHour, scheduledMinute] = schedule.timeOfDay.split(':').map(Number);
        const isScheduledTime = now.getHours() === scheduledHour && now.getMinutes() === scheduledMinute;

        if (!isScheduledTime) {
            return [];
        }

        // For weekly schedule, check day of week
        if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== now.getDay()) {
            return [];
        }

        // Get content that needs optimization
        return this.contentService.getContentForOptimization(platform);
    }

    private detectChanges(original: any, optimized: any): {
        type: string;
        before: any;
        after: any;
        impact: number;
    }[] {
        const changes: {
            type: string;
            before: any;
            after: any;
            impact: number;
        }[] = [];

        // Compare and detect changes
        for (const [key, value] of Object.entries(optimized)) {
            if (JSON.stringify(original[key]) !== JSON.stringify(value)) {
                changes.push({
                    type: key,
                    before: original[key],
                    after: value,
                    impact: this.estimateChangeImpact(key, original[key], value)
                });
            }
        }

        return changes;
    }

    private estimateChangeImpact(type: string, before: any, after: any): number {
        // Implementation would calculate estimated impact based on historical data
        return 0.5; // Placeholder
    }

    private async publishOptimization(
        platform: string,
        contentId: string,
        optimizedContent: any
    ): Promise<void> {
        try {
            await this.contentService.updateContent(platform, contentId, optimizedContent);
            this.emit('optimizationPublished', {
                platform,
                contentId,
                content: optimizedContent
            });
        } catch (error) {
            console.error('Error publishing optimization:', error);
            this.emit('optimizationPublishError', {
                platform,
                contentId,
                error
            });
        }
    }

    async cleanup(): Promise<void> {
        await this.stopAutoOptimization();
        this.optimizers.clear();
        this.optimizationHistory.clear();
        this.autoOptimizationHistory.clear();
        await this.learningOptimizer.cleanup();
        await this.approvalWorkflow.cleanup();
        this.removeAllListeners();
    }
} 
