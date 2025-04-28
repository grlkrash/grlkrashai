import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';

export interface TrendingDataBase {
    hashtags: string[];
    topics: string[];
}

export interface OptimizationResultBase {
    hashtags: string[];
    timing: {
        bestPostingTimes: Date[];
        recommendedTimeZones: string[];
    };
}

export interface OptimizationOptions {
    targetAudience?: string[];
    contentType?: string;
    isPromotionalContent?: boolean;
}

export abstract class BaseOptimizer<
    TMetadata,
    TTrendingData extends TrendingDataBase,
    TOptimizationResult extends OptimizationResultBase
> extends EventEmitter {
    protected runtime: IAgentRuntime;
    protected trendingCache: Map<string, TTrendingData>;
    protected readonly CACHE_DURATION: number = 30 * 60 * 1000; // 30 minutes
    protected lastCacheUpdate: Date;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.trendingCache = new Map();
        this.lastCacheUpdate = new Date(0);
    }

    async initialize(): Promise<void> {
        await this.updateTrendingCache();
    }

    async optimizeContent(
        metadata: TMetadata,
        options?: OptimizationOptions
    ): Promise<TMetadata> {
        try {
            if (this.shouldUpdateCache()) {
                await this.updateTrendingCache();
            }

            const optimization = await this.generateOptimization(metadata, options);
            return this.applyOptimization(metadata, optimization);
        } catch (error) {
            console.error(`Error optimizing content: ${error}`);
            this.emit('optimizationError', { error, metadata });
            return metadata;
        }
    }

    protected abstract generateOptimization(
        metadata: TMetadata,
        options?: OptimizationOptions
    ): Promise<TOptimizationResult>;

    protected abstract applyOptimization(
        metadata: TMetadata,
        optimization: TOptimizationResult
    ): Promise<TMetadata>;

    protected abstract updateTrendingCache(): Promise<void>;

    protected shouldUpdateCache(): boolean {
        return Date.now() - this.lastCacheUpdate.getTime() > this.CACHE_DURATION;
    }

    protected getRelevantHashtags(
        trendingHashtags: string[],
        contentType?: string,
        targetAudience?: string[]
    ): string[] {
        const relevant = new Set<string>();

        if (contentType) {
            relevant.add(contentType.toLowerCase());
        }

        if (targetAudience) {
            targetAudience.forEach(audience => relevant.add(audience.toLowerCase()));
        }

        trendingHashtags.forEach(tag => {
            if (this.isHashtagRelevant(tag, contentType, targetAudience)) {
                relevant.add(tag);
            }
        });

        return Array.from(relevant);
    }

    protected isHashtagRelevant(
        hashtag: string,
        contentType?: string,
        targetAudience?: string[]
    ): boolean {
        const tag = hashtag.toLowerCase();
        
        if (contentType && tag.includes(contentType.toLowerCase())) {
            return true;
        }

        if (targetAudience) {
            return targetAudience.some(audience => 
                tag.includes(audience.toLowerCase())
            );
        }

        return false;
    }

    protected async calculateOptimalTiming(
        targetAudience?: string[],
        contentType?: string
    ): Promise<OptimizationResultBase['timing']> {
        // Base implementation for optimal timing calculation
        return {
            bestPostingTimes: [new Date()],
            recommendedTimeZones: ['UTC']
        };
    }

    protected addCallToAction(text: string, platform: string): string {
        // Base implementation for adding call-to-action
        return text;
    }

    async cleanup(): Promise<void> {
        this.trendingCache.clear();
        this.removeAllListeners();
    }
} 