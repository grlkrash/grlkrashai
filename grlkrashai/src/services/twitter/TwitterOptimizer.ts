import { IAgentRuntime } from '@elizaos/core';
import { TwitterUploadMetadata } from './TwitterContentService';
import { BaseOptimizer, TrendingDataBase, OptimizationResultBase, OptimizationOptions } from '../optimization/BaseOptimizer';

interface TwitterTrendingData extends TrendingDataBase {
    spaces: {
        title: string;
        participants: number;
        category: string;
    }[];
    conversations: {
        topic: string;
        engagement: number;
        sentiment: number;
    }[];
}

interface TwitterOptimizationResult extends OptimizationResultBase {
    text: string;
    mediaRecommendation?: {
        type: 'image' | 'video' | 'gif' | 'poll';
        count?: number;
        aspectRatio?: string;
    };
    threadRecommendation?: {
        shouldThread: boolean;
        recommendedParts: number;
        topicBreakdown?: string[];
    };
    engagement: {
        recommendedAccounts: string[];
        conversationStarters: string[];
        relevantCommunities: string[];
    };
    spaceRecommendation?: {
        shouldHost: boolean;
        topic: string;
        bestTime: Date;
        targetDuration: number;
    };
}

interface TwitterOptimizationOptions extends OptimizationOptions {
    contentType?: 'tweet' | 'thread' | 'space';
    mediaType?: 'image' | 'video' | 'gif' | 'poll';
    isPromotionalContent?: boolean;
    prediction?: {
        score: number;
        confidence: number;
        factors: { factor: string; weight: number }[];
    };
}

export class TwitterOptimizer extends BaseOptimizer<
    TwitterUploadMetadata,
    TwitterTrendingData,
    TwitterOptimizationResult
> {
    private readonly MAX_TWEET_LENGTH = 280;
    private readonly MAX_THREAD_PARTS = 10;
    private readonly OPTIMAL_LENGTHS = {
        tweet: 180,
        threadPart: 250,
        spaceTitle: 50
    };
    private readonly MEDIA_LIMITS = {
        images: 4,
        videoLength: 140, // seconds
        gif: 1
    };

    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }

    protected async generateOptimization(
        metadata: TwitterUploadMetadata,
        options?: TwitterOptimizationOptions
    ): Promise<TwitterOptimizationResult> {
        const trending = this.trendingCache.get('global') || {
            hashtags: [],
            topics: [],
            spaces: [],
            conversations: []
        };

        // Get relevant hashtags based on content and audience
        const relevantHashtags = this.getRelevantHashtags(
            trending.hashtags,
            options?.contentType,
            options?.targetAudience
        );

        // Use learning predictions to adjust optimization
        const prediction = options?.prediction;
        if (prediction && prediction.confidence > 0.7) {
            // Adjust optimization based on learned factors
            const importantFactors = prediction.factors;
            
            // Adjust hashtag selection based on learned importance
            const hashtagFactor = importantFactors.find(f => f.factor.includes('hashtags'));
            if (hashtagFactor && hashtagFactor.weight > 0.5) {
                // Prioritize hashtags more heavily
                relevantHashtags.push(...this.getAdditionalHashtags(trending.hashtags));
            }
        }

        // Determine if content should be threaded
        const threadAnalysis = this.analyzeThreadPotential(
            metadata.text || '',
            trending.conversations,
            prediction
        );

        // Analyze space potential with learning insights
        const spaceAnalysis = options?.contentType === 'space'
            ? this.analyzeSpacePotential(trending.spaces, options?.targetAudience, prediction)
            : undefined;

        const timing = await this.calculateOptimalTiming(
            options?.targetAudience,
            options?.contentType,
            prediction
        );

        return {
            text: metadata.text || '',
            hashtags: relevantHashtags,
            timing,
            mediaRecommendation: this.generateMediaRecommendation(
                options?.mediaType,
                options?.isPromotionalContent,
                prediction
            ),
            threadRecommendation: threadAnalysis,
            engagement: this.generateEngagementStrategy(
                trending.conversations,
                options?.targetAudience,
                prediction
            ),
            spaceRecommendation: spaceAnalysis
        };
    }

    protected async applyOptimization(
        metadata: TwitterUploadMetadata,
        optimization: TwitterOptimizationResult
    ): Promise<TwitterUploadMetadata> {
        return {
            ...metadata,
            text: this.optimizeText(metadata.text || '', optimization),
            hashtags: this.optimizeHashtags(metadata.hashtags || [], optimization),
            mediaSettings: this.optimizeMediaSettings(metadata.mediaSettings, optimization),
            threadSettings: optimization.threadRecommendation,
            spaceSettings: optimization.spaceRecommendation,
            timing: optimization.timing,
            engagementStrategy: optimization.engagement
        };
    }

    protected async updateTrendingCache(): Promise<void> {
        try {
            // Fetch trending data from Twitter API
            const trending: TwitterTrendingData = {
                hashtags: [],
                topics: [],
                spaces: [],
                conversations: []
            };

            this.trendingCache.clear();
            this.trendingCache.set('global', trending);
            this.lastCacheUpdate = new Date();
        } catch (error) {
            console.error('Error updating trending cache:', error);
        }
    }

    private optimizeText(text: string, optimization: TwitterOptimizationResult): string {
        let optimizedText = text;

        // Ensure text fits within limits
        if (optimization.threadRecommendation?.shouldThread) {
            optimizedText = this.optimizeThreadText(text, optimization);
        } else {
            optimizedText = this.optimizeSingleTweet(text, optimization);
        }

        return optimizedText;
    }

    private optimizeThreadText(text: string, optimization: TwitterOptimizationResult): string {
        // Implement thread-specific text optimization
        return text;
    }

    private optimizeSingleTweet(text: string, optimization: TwitterOptimizationResult): string {
        // Keep tweets concise and engaging
        const maxLength = this.MAX_TWEET_LENGTH;
        let optimizedText = text.slice(0, maxLength);

        // Add call to action if promotional
        if (text.length < maxLength - 30) {
            optimizedText = this.addCallToAction(optimizedText, 'twitter');
        }

        return optimizedText;
    }

    private optimizeHashtags(
        originalHashtags: string[],
        optimization: TwitterOptimizationResult
    ): string[] {
        // Combine original hashtags with trending ones
        const combined = new Set([...originalHashtags, ...optimization.hashtags]);
        
        // Keep only the most relevant ones
        // Twitter best practice: 1-2 hashtags per tweet
        return Array.from(combined).slice(0, 2);
    }

    private optimizeMediaSettings(
        currentSettings: any,
        optimization: TwitterOptimizationResult
    ): any {
        return {
            ...currentSettings,
            type: optimization.mediaRecommendation?.type,
            count: optimization.mediaRecommendation?.count,
            aspectRatio: optimization.mediaRecommendation?.aspectRatio
        };
    }

    private generateMediaRecommendation(
        mediaType?: string,
        isPromotional?: boolean,
        prediction?: TwitterOptimizationOptions['prediction']
    ): TwitterOptimizationResult['mediaRecommendation'] {
        if (!mediaType) return undefined;

        return {
            type: mediaType as 'image' | 'video' | 'gif' | 'poll',
            count: mediaType === 'image' ? this.MEDIA_LIMITS.images : 1,
            aspectRatio: '16:9'
        };
    }

    private analyzeThreadPotential(
        text: string,
        conversations: TwitterTrendingData['conversations'],
        prediction?: TwitterOptimizationOptions['prediction']
    ): TwitterOptimizationResult['threadRecommendation'] {
        const shouldThread = text.length > this.MAX_TWEET_LENGTH;
        if (!shouldThread) return undefined;

        // Use learning insights to adjust thread structure
        const recommendedParts = prediction?.factors.some(f => 
            f.factor.includes('content.length') && f.weight > 0.6
        )
            ? Math.ceil(text.length / (this.OPTIMAL_LENGTHS.threadPart * 0.8)) // Shorter threads if length is important
            : Math.ceil(text.length / this.OPTIMAL_LENGTHS.threadPart);

        return {
            shouldThread: true,
            recommendedParts,
            topicBreakdown: this.generateTopicBreakdown(text)
        };
    }

    private generateTopicBreakdown(text: string): string[] {
        // Implementation would:
        // - Use NLP to identify main topics
        // - Break down content into logical segments
        return [];
    }

    private analyzeSpacePotential(
        spaces: TwitterTrendingData['spaces'],
        targetAudience?: string[],
        prediction?: TwitterOptimizationOptions['prediction']
    ): TwitterOptimizationResult['spaceRecommendation'] {
        if (!spaces.length) return undefined;

        // Use learning insights to determine space potential
        const audienceFactorWeight = prediction?.factors.find(f => 
            f.factor.includes('audience.size')
        )?.weight || 0;

        return {
            recommended: audienceFactorWeight > 0.4,
            topics: this.getRelevantTopics(spaces, targetAudience),
            duration: this.calculateOptimalSpaceDuration(prediction)
        };
    }

    private calculateOptimalSpaceDuration(
        prediction?: TwitterOptimizationOptions['prediction']
    ): number {
        // Default duration
        let duration = 30; // minutes

        // Adjust based on learning insights
        if (prediction?.factors.some(f => f.factor.includes('engagement') && f.weight > 0.7)) {
            duration = 45; // Longer duration for high engagement potential
        }

        return duration;
    }

    private generateEngagementStrategy(
        conversations: TwitterTrendingData['conversations'],
        targetAudience?: string[],
        prediction?: TwitterOptimizationOptions['prediction']
    ): TwitterOptimizationResult['engagement'] {
        const strategy = {
            recommendedActions: [] as string[],
            targetUsers: [] as string[],
            timing: {} as any
        };

        // Use learning insights to adjust engagement strategy
        if (prediction?.confidence > 0.7) {
            const engagementFactors = prediction.factors.filter(f => 
                f.factor.includes('performance')
            );

            if (engagementFactors.some(f => f.weight > 0.5)) {
                strategy.recommendedActions.push('proactive_engagement');
                strategy.recommendedActions.push('community_building');
            }
        }

        return strategy;
    }

    private addCallToAction(text: string, platform: string): string {
        // Add relevant call-to-action based on content type and platform
        return text;
    }

    private getAdditionalHashtags(trendingHashtags: string[]): string[] {
        // Get more hashtags when learning suggests they're important
        return trendingHashtags
            .filter(tag => this.isHighEngagementHashtag(tag))
            .slice(0, 3);
    }

    private isHighEngagementHashtag(hashtag: string): boolean {
        // Implementation would check historical performance
        return true; // Placeholder
    }
} 
