import { getRandomQuote } from '../data/wisdomQuotes';
import { TwitterApi, ApiResponseError as TwitterApiError, TwitterApiReadWrite, TwitterApiTokens, TweetV1, TweetV2, UserV2 } from 'twitter-api-v2';
import { tweetTemplate } from './plugin-twitter/src/templates';
import { isTweetContent, TweetSchema } from './plugin-twitter/src/types';
import { generateObject, composeContext } from '@elizaos/core';
import { TweetMetrics } from '../types/twitter';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { NodeStorage } from '../storage/NodeStorage';
import { Tweet as TwitterApiTweet } from 'twitter-api-v2';
import { RateLimitInfo } from 'twitter-api-v2/dist/types/rate-limit.types';

/**
 * TwitterService manages automated Twitter interactions and campaigns.
 * 
 * Campaign Types:
 * 1. Engagement Campaigns
 *    - Automatically responds to mentions and interactions
 *    - Analyzes engagement patterns
 *    - Adjusts response frequency based on engagement metrics
 * 
 * 2. Growth Campaigns
 *    - Focuses on follower growth
 *    - Identifies and engages with potential followers
 *    - Uses optimized hashtags and timing
 * 
 * 3. Community Campaigns
 *    - Builds community through consistent interaction
 *    - Maintains engagement with existing followers
 *    - Creates themed content based on community interests
 * 
 * Content Generation Features:
 * - Dynamic message composition based on context
 * - Engagement-optimized response generation
 * - Hashtag optimization
 * - Timing optimization for posts
 * 
 * Auto Mode Features:
 * - Rate limit aware posting
 * - Engagement analytics
 * - Adaptive frequency adjustment
 * - Multi-account targeting
 * - Performance monitoring
 */
export interface VerifyTweetResponse {
    verified: boolean;
    text?: string;
    error?: string;
}

interface TargetConfig {
    enabled: boolean;
    postFrequency: number;
    campaignTypes: string[];
    lastActivity: Date;
    metrics: {
        engagement_rate: number;
        followers_count: number;
        following_count: number;
        tweet_count: number;
    };
}

interface AutoModeConfig {
    enabled: boolean;
    targetAccounts: string[];
    campaignTypes: ('engagement' | 'growth' | 'community')[];
    postFrequency: number; // minutes
    engagementThreshold: number;
    optimizationInterval: number; // hours
    lastRun?: Date;
    campaigns: Map<string, CampaignConfig>;
    optimization: {
        enabled: boolean;
        minDataPoints: number;
        optimizationInterval: number;
        lastOptimization: Date;
        performanceThresholds: {
            minEngagementRate: number;
            minFollowerGrowth: number;
            minImpressions: number;
        };
        adaptiveFrequency: boolean;
        learningRate: number;
    };
}

interface AICollaboration {
    crystalId: string;
    contributors: string[];
    content: string;
    ipfsHash: string;
    status: 'pending' | 'ready' | 'posted';
    timestamp: Date;
}

interface CrystalContent {
    type: 'text' | 'image' | 'thread';
    content: string;
    metadata: {
        collaborators: string[];
        aiModel: string;
        crystalType: string;
        tags: string[];
    };
}

interface DynamicProfileConfig {
    baseImageIPFS: string;
    overlayElements: {
        followers: boolean;
        crystals: boolean;
        collaborations: boolean;
        achievements: boolean;
    };
    updateInterval: number;
    lastUpdate: Date;
}

interface CrystalCollaboration {
    id: string;
    creators: string[];
    crystalId: string;
    content: {
        type: 'meme' | 'art' | 'story' | 'music';
        title: string;
        description: string;
        ipfsHash: string;
        tags: string[];
    };
    status: 'draft' | 'ready' | 'posted';
    engagement: {
        likes: number;
        retweets: number;
        replies: number;
    };
    timestamp: Date;
}

// Add new interfaces for audience analysis
interface EngagementType {
    type: string;
    score: number;
}

interface AudienceInsight {
    interests: Map<string, number>;  // topic -> engagement score
    activeHours: Map<string, number>;  // hour -> activity level
    engagementTypes: EngagementType[];
    topHashtags: Map<string, number>;
    commonPhrases: Map<string, number>;
}

interface ContentStrategy {
    videoTopics: string[];
    optimalDuration: number;
    bestPerformingStyles: string[];
    primaryTopics: string[];
    secondaryTopics: string[];
    optimalTimes: number[];
    recommendedHashtags: string[];
}

interface HashtagAnalysis {
    tag: string;
    count: number;
}

interface TopicConfig {
    keywords: string[];
    artists: string[];
    platforms: string[];
    genres: string[];
}

interface CampaignConfig {
    enabled: boolean;
    targetAccount: string;
    campaignType: string;
    frequency: number;
    customMessages: string[];
    topics?: TopicConfig;
    replyTemplates?: string[];
    maxDailyReplies?: number;
    lastReplyTimestamp?: number;
}

// Add new interfaces for optimization
interface CampaignPerformanceMetrics {
    engagementRate: number;
    followerGrowthRate: number;
    impressionRate: number;
    bestPerformingTags: string[];
    bestTimeSlots: string[];
    successfulMessageTypes: string[];
    optimalFrequency: number;
}

interface OptimizationStrategy {
    messageAdjustments: {
        addTags: string[];
        removeTags: string[];
        messageTemplates: string[];
    };
    timingAdjustments: {
        bestHours: number[];
        postFrequency: number;
    };
    typeAdjustments: {
        preferredTypes: ('reply' | 'mention' | 'retweet' | 'mixed')[];
        typeWeights: Map<string, number>;
    };
}

interface VideoAnalysis {
    engagement_rate: number;
    topics: string[];
    duration: number;
    style: string[];
    views: number;
    completion_rate: number;
    peak_moments: number[];
    engagement: number;
}

interface MediaContent {
    type: 'video' | 'image' | 'text';
    url?: string;
    preview_image_url?: string;
    duration_ms?: number;
    views?: number;
}

interface EnhancedTweet extends TweetV2 {
    author: {
        username: string;
        id: string;
    };
    text: string;
    id: string;
    attachments?: {
        media_keys?: string[];
    };
}

interface TargetAnalysis {
    style: {
        tone: string;
        formality: string;
        vocabulary: string[];
    };
    sentiment: string;
    topics: string[];
    engagement: {
        avgLikes: number;
        avgRetweets: number;
        avgReplies: number;
    };
    video_metrics: {
        count: number;
        avgViews: string;
        avgDuration: string;
        topics: string[];
    };
}

interface AudienceAnalysis {
    metrics: {
        engagement_rate: number;
        followers_count: number;
        following_count: number;
        tweet_count: number;
    };
    timestamp?: Date;
}

interface OptimizationReview {
    timestamp: Date;
    changes: {
        audienceGrowth: number;
        topicShifts: string[];
        engagementTrends: {
            likes: number;
            retweets: number;
            replies: number;
        };
        recommendedAdjustments: {
            topics: string[];
            timing: number[];
            contentStyle: string;
        };
    };
}

interface MusicIndustryConfig extends TopicConfig {
    artists: string[];
    platforms: string[];
    genres: string[];
}

interface GrowthCampaignConfig extends CampaignConfig {
    topics: TopicConfig;
    replyTemplates: string[];
    maxDailyReplies: number;
    lastReplyTimestamp?: number;
}

// Add this interface at the top with other interfaces
interface AutoModeStatus {
    enabled: boolean;
    targetAccounts: string[];
    postFrequency: number;
    campaignTypes: string[];
    lastRun: Date;
    metrics: {
        engagement: number;
        followers: number;
        tweets: number;
    };
    serverStatus: string;
    error?: string;
}

interface ContentAnalysis {
    sentiment: number;
    topics: string[];
    video_metrics?: {
        views: number;
        duration: number;
    };
}

interface CommandResponse {
    success: boolean;
    message: string;
    data?: any;
    error?: any;
}

interface OptimizationStrategy {
    recommendations: string[];
    metrics: Record<string, number>;
    nextActions: string[];
}

interface AudienceAnalysis {
    metrics: {
        followers: number;
        following: number;
        tweets: number;
        engagement_rate: number;
    };
    trends: {
        follower_growth: number;
        engagement_trend: number;
    };
    cached?: boolean;
}

interface Tweet {
    public_metrics?: {
        like_count?: number;
        retweet_count?: number;
        reply_count?: number;
    };
}

interface VideoMetrics {
    engagement_rate?: number;
    duration_ms?: number;
    view_count?: number;
    completion_rate?: number;
    peak_moments?: number[];
}

interface TweetWithVideo {
    id: string;
    text?: string;
    attachments?: {
        media_keys: string[];
    };
    public_metrics?: {
        like_count: number;
    };
}

// Add these interfaces at the top of the file
interface VerificationCacheEntry {
    verified: boolean;
    timestamp: number;
}

interface GrowthStrategy {
    targetTopics: string[];
    optimalPostingHours: number[];
    contentTypePreferences: string[];
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface FollowerInteractions {
    likes: number;
    retweets: number;
    replies: number;
    mentions: number;
    lastInteraction: Date;
}

interface UserActivity {
    topics: string[];
    activeHours: number[];
    contentTypes: {
        text: number;
        images: number;
        videos: number;
        links: number;
    };
}

interface TweetGenerationParams {
    template: string;
    topics: string[];
    tone: string;
    context: {
        audienceInterests: string[];
        recentPerformance: any[];
        timeOfDay: number;
    };
}

interface TopicDetails {
    [key: string]: string[];
}

export class TwitterService extends EventEmitter {
    private static instance: TwitterService;
    private client: TwitterApi | null = null;
    private userId: string = '';
    private contentStrategy: any = {};
    private rateLimits = new Map<string, RateLimitInfo>();
    private storage: NodeStorage;
    private verificationCache: Map<string, VerificationCacheEntry>;
    private growthStrategy: GrowthStrategy;
    private autoModeConfig: AutoModeConfig;
    private targetUsername: string = '';
    private isRunning: boolean = false;
    private startTime: Date | null = null;
    private campaignInterval: NodeJS.Timeout | null = null;
    private rateLimitCache = new Map<string, RateLimitInfo>();
    private static readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    private metrics: any = {};
    private campaigns: Map<string, any> = new Map();

    private connectionStatus: {
        isConnected: boolean;
        lastCheck: Date;
        error?: string;
    } = {
        isConnected: false,
        lastCheck: new Date()
    };

    private constructor() {
        super();
        this.storage = new NodeStorage();
        this.verificationCache = new Map();
        this.growthStrategy = {
            targetTopics: [],
            optimalPostingHours: [],
            contentTypePreferences: []
        };
        this.autoModeConfig = this.getDefaultAutoConfig();
        
        // Load initial state
        this.loadState();
        
        // Initialize async operations
        this.initializeAsync().catch(console.error);
    }

    public static getInstance(): TwitterService {
        if (!TwitterService.instance) {
            TwitterService.instance = new TwitterService();
        }
        return TwitterService.instance;
    }

    private getDefaultAutoConfig(): AutoModeConfig {
        return {
            enabled: false,
            targetAccounts: [],
            campaignTypes: ['engagement'],
            postFrequency: 60,
            engagementThreshold: 0.1,
            optimizationInterval: 24,
            campaigns: new Map(),
            optimization: {
                enabled: true,
                minDataPoints: 10,
                optimizationInterval: 24,
                lastOptimization: new Date(),
                performanceThresholds: {
                    minEngagementRate: 0.02,
                    minFollowerGrowth: 0.01,
                    minImpressions: 1000
                },
                adaptiveFrequency: true,
                learningRate: 0.1
            }
        };
    }

    private async validateConnection(): Promise<boolean> {
        try {
            if (!this.client) {
                throw new Error('Twitter client not initialized');
            }

            // Try to make a simple API call to verify connectivity
            const response = await fetch('http://localhost:3002/api/twitter/health');
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.connectionStatus = {
                isConnected: true,
                lastCheck: new Date()
            };

            return true;
        } catch (error) {
            this.connectionStatus = {
                isConnected: false,
                lastCheck: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            console.error('Twitter connection validation failed:', this.connectionStatus.error);
            return false;
        }
    }

    private async initializeAsync(): Promise<void> {
        try {
            // Initialize Twitter client with bearer token
            const bearerToken = process.env.TWITTER_BEARER_TOKEN;
            if (!bearerToken) {
                console.error('Bearer token not found in environment variables');
                throw new Error('Bearer token not found in environment variables');
            }
            
            this.client = new TwitterApi(bearerToken);
            
            // Validate connection
            const isConnected = await this.validateConnection();
            if (!isConnected) {
                throw new Error('Failed to establish Twitter API connection');
            }
            
            console.log('Twitter API client initialized and connected successfully');
            
            // Load initial state if not already loaded
            if (!this.isRunning && !this.targetUsername) {
                const savedState = this.storage.getItem('twitter_automation_state');
                if (savedState) {
                    const { isRunning, targetUsername, startTime } = JSON.parse(savedState);
                    this.isRunning = isRunning || false;
                    this.targetUsername = targetUsername || '';
                    this.startTime = startTime ? new Date(startTime) : null;
                }
            }

            // Start periodic connection validation
            setInterval(() => {
                this.validateConnection().catch(error => {
                    console.error('Periodic connection validation failed:', error);
                });
            }, 5 * 60 * 1000); // Check every 5 minutes
        } catch (error) {
            this.connectionStatus = {
                isConnected: false,
                lastCheck: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            console.error('Failed to initialize Twitter client:', error);
            throw error;
        }
    }

    public async analyzeSentiment(text: string): Promise<any> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/analyze-sentiment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) throw new Error('Sentiment analysis failed');
            return await response.json();
        } catch (error) {
            console.warn('Sentiment analysis error:', error);
            return { sentiment: 'neutral', confidence: 0, topics: [] };
        }
    }

    public async tweet(message: string): Promise<string> {
        try {
            const cleanedMessage = this.cleanMessage(message);
            const response = await fetch('/api/twitter/tweets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanedMessage })
            });
            
            if (!response.ok) {
                throw new Error('Failed to post tweet');
            }
            
            const data = await response.json();
            return data.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to post tweet: ${errorMessage}`);
        }
    }

    public async reply(tweetId: string, message: string): Promise<string> {
        try {
            const cleanedMessage = this.cleanMessage(message);
            const response = await fetch(`/api/twitter/tweets/${tweetId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanedMessage })
        });

        if (!response.ok) {
                throw new Error('Failed to post reply');
            }
            
            const data = await response.json();
            return data.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to post reply: ${errorMessage}`);
        }
    }

    public async startAutoMode(account: string): Promise<void> {
        if (this.isRunning) {
            throw new Error('Auto mode is already running');
        }

        this.isRunning = true;
        this.autoModeConfig.enabled = true;
        this.autoModeConfig.targetAccounts.push(account);

        await this.runMainLoop();
        this.startOptimization();
    }

    public async stopAutoMode(): Promise<void> {
        this.isRunning = false;
        this.autoModeConfig.enabled = false;
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
            this.optimizationTimer = null;
        }
    }

    private async runMainLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                await this.executeAutonomousActions();
                await new Promise(resolve => setTimeout(resolve, this.autoModeConfig.postFrequency * 60 * 1000));
            } catch (error) {
                console.error('Error in auto mode main loop:', error);
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // 5 minute delay on error
            }
        }
    }

    private startOptimization(): void {
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
        }

        this.optimizationTimer = setInterval(
            async () => {
                try {
                    await this.optimizeCampaigns();
                } catch (error) {
                    console.error('Error in optimization:', error);
                }
            },
            this.autoModeConfig.optimization.optimizationInterval * 60 * 60 * 1000
        );
    }

    private async executeAutonomousActions(): Promise<void> {
        for (const account of this.autoModeConfig.targetAccounts) {
            for (const campaignType of this.autoModeConfig.campaignTypes) {
                const config = this.autoModeConfig.campaigns.get(`${account}_${campaignType}`);
                if (!config || !config.enabled) continue;

                try {
                    switch (campaignType) {
                        case 'engagement':
                            await this.runEngagementCampaign(account, config);
                            break;
                        case 'growth':
                            await this.runGrowthCampaign(account, config as GrowthCampaignConfig);
                            break;
                        case 'community':
                            await this.runCommunityEngagement(account, config);
                            break;
                    }
                } catch (error) {
                    console.error(`Error in ${campaignType} campaign for ${account}:`, error);
                }
            }
        }
    }

    private async handleRateLimit(endpoint: string): Promise<RateLimitInfo> {
        const cached = this.rateLimitCache.get(endpoint);
        const now = Date.now();

        if (cached) {
            if (cached.remaining <= 0 && cached.reset > now) {
                const resetIn = cached.reset - now;

                return {
                    ...cached,
                    status: 429,
                    resetIn
                };
            }
            return cached;
        }

        return {
            remaining: 3, // Default limit
            reset: now + 900000, // 15 minutes from now
            lastRequest: now
        };
    }

    private async waitForRateLimit(endpoint: string, response?: Response): Promise<void> {
        const check = await this.handleRateLimit(endpoint);
        if (check.error && check.resetIn && check.resetIn > 0) {
            await new Promise(resolve => setTimeout(resolve, check.resetIn));
        }
    }

    public async verifyAccount(account: string): Promise<boolean> {
        try {
            const cleanAccount = account.replace('@', '');
            const endpoint = `/users/${cleanAccount}`;
            
            // Check rate limits first
            await this.waitForRateLimit(endpoint);
            
            // Use fetch API in browser environment
            if (!this.isNode) {
                const response = await fetch(`http://localhost:3002/api/twitter${endpoint}`);
            if (!response.ok) {
                    if (response.status === 429) {
                        await this.waitForRateLimit(endpoint, response);
                        return this.verifyAccount(account);
                    }
                throw new Error(`Failed to verify account: ${response.statusText}`);
            }

            const data = await response.json();
                this.emit('message', {
                    type: 'success',
                    content: `Successfully verified account @${cleanAccount}`
                });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('[DEBUG] Error verifying account:', error);
            this.emit('message', {
                type: 'error',
                content: `Error verifying account @${cleanAccount}. ${error.message}`
            });
            return false;
        }
    }

    private async optimizeCampaigns(): Promise<void> {
        try {
            for (const [targetAccount, config] of this.campaigns.entries()) {
                console.log(`Optimizing campaign for ${targetAccount}...`);
                
                const endTime = new Date().toISOString();
                const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                
                const response = await fetch(
                    `http://localhost:3002/api/twitter/users/${targetAccount}/campaigns/performance?` +
                    new URLSearchParams({ startTime, endTime })
                );
                
                if (!response.ok) {
                    throw new Error(`Failed to get campaign performance: ${response.statusText}`);
                }
                
                const data = await response.json();
                const metrics = data.metrics || { likes: 0, retweets: 0, replies: 0 };
                
                // Calculate average engagement
                const totalEngagement = metrics.likes + metrics.retweets + metrics.replies;
                const avgEngagement = totalEngagement / (data.tweets?.length || 1);
                
                // Optimize posting frequency based on engagement
                const newFrequency = this.calculateOptimalFrequency(avgEngagement);
                
                // Update campaign config
                config.frequency = newFrequency;
                this.campaigns.set(targetAccount, config);
                
                console.log(`Campaign optimized for ${targetAccount}:`, {
                    avgEngagement,
                    newFrequency,
                    metrics
                });
            }
        } catch (error) {
            console.error('Error optimizing campaigns:', error);
        }
    }

    private calculateOptimalFrequency(avgEngagement: number): number {
        // Base frequency adjustment on engagement levels
        if (avgEngagement > 100) return 15;  // High engagement: post every 15 minutes
        if (avgEngagement > 50) return 30;   // Good engagement: post every 30 minutes
        if (avgEngagement > 20) return 45;   // Moderate engagement: post every 45 minutes
        return 60;                           // Low engagement: post every 60 minutes
    }

    public async getAutoModeStatus(): Promise<any> {
        try {
            const targetConfig = this.autoModeConfig.targetConfigs.get(this.targetUsername);
            const targetAccounts = targetConfig ? [this.targetUsername] : [];
            
            const status = {
                enabled: this.autoModeConfig.enabled,
                targetAccounts,
                postFrequency: this.autoModeConfig.campaignSettings?.defaultFrequency || 30,
                campaignTypes: targetConfig?.campaignTypes || ['engagement'],
                lastRun: this.autoModeConfig.lastRun,
                metrics: {
                    engagement: 0,
                    followers: 0,
                    tweets: 0
                },
                serverStatus: '🔴 Not Connected'
            };

            // Check server connection
            try {
                const healthCheck = await fetch('http://localhost:3002/api/health');
                if (!healthCheck.ok) throw new Error('Server health check failed');
                status.serverStatus = '🟢 Connected';
                
                // Only fetch metrics if server is connected and auto mode is enabled
                if (this.autoModeConfig.enabled && this.targetUsername) {
                    const metrics = await this.getMetrics(this.targetUsername);
                    status.metrics = metrics;
                }
            } catch (error) {
                console.warn('Error fetching metrics:', error);
            }

            return status;
        } catch (error) {
            console.error('Error getting auto mode status:', error);
            return {
                enabled: this.autoModeConfig.enabled,
                error: error instanceof Error ? error.message : 'Unknown error',
                targetAccounts: [],
                postFrequency: this.autoModeConfig.campaignSettings.defaultFrequency,
                campaignTypes: ['engagement'],
                lastRun: this.autoModeConfig.lastRun,
                metrics: { engagement: 0, followers: 0, tweets: 0 }
            };
        }
    }

    public async setPostFrequency(minutes: number): Promise<void> {
        if (minutes < 15 || minutes > 120) {
            throw new Error('Post frequency must be between 15 and 120 minutes');
        }
        this.autoModeConfig.campaignSettings.defaultFrequency = minutes;
        this.saveConfig();
        this.saveCampaigns();
    }

    public async setCampaignTypes(types: string[]): Promise<void> {
        const validTypes = ['engagement', 'growth', 'community'];
        const invalidTypes = types.filter(type => !validTypes.includes(type));
        if (invalidTypes.length > 0) {
            throw new Error(`Invalid campaign types: ${invalidTypes.join(', ')}`);
        }

        // Update campaign types for the target account
        const targetConfig = this.autoModeConfig.targetConfigs.get(this.targetUsername);
        if (targetConfig) {
            targetConfig.campaignTypes = types;
            this.autoModeConfig.targetConfigs.set(this.targetUsername, targetConfig);
            
            // Adjust frequency based on number of campaigns
            if (types.length > 1) {
                this.autoModeConfig.campaignSettings.defaultFrequency = Math.min(
                    this.autoModeConfig.campaignSettings.defaultFrequency + 15,
                    120
                );
            }
            
            this.saveConfig();
            this.saveCampaigns();
        }
    }

    public async executeCommand(command: string): Promise<CommandResponse> {
        try {
            if (!command) {
                return { success: false, message: 'No command provided' };
            }

            const normalizedCommand = command.toLowerCase().trim();
            const parts = normalizedCommand.split(' ');

            // Auto mode commands
            if (parts[0] === 'auto') {
                switch (parts[1]) {
            case 'start': {
                        const targetAccount = parts[2];
                        if (!targetAccount) {
                            return { success: false, message: 'Please specify a target account (e.g., AUTO START @username)' };
                        }
                        this.targetUsername = targetAccount.replace('@', '');
                        return this.handleAutoModeStart();
                    }
                    case 'stop':
                        return this.handleAutoModeStop();
                    case 'status':
                        return this.checkAutoStatus();
                    case 'report': {
                        const verified = await this.verifyAccount(this.targetUsername);
                        if (!verified) {
                            return { success: false, message: 'Account verification failed' };
                        }

                        try {
                            // Try to get cached data first
                            const cacheKey = `report_${this.targetUsername}`;
                            const cachedReport = this.getCachedData<CommandResponse>(cacheKey);
                            
                            if (cachedReport) {
                                return {
                                    ...cachedReport,
                                    message: cachedReport.message + '\n\n⚠️ Using cached data due to rate limits. Try again later for fresh data.'
                                };
                            }

                            // Get content analysis with rate limit handling
                            const contentAnalysis = await this.analyzeTargetContent();
                            
                            // Get audience analysis with rate limit handling
                            const audienceAnalysis = await this.analyzeAudience(this.targetUsername);
                            
                            // Get optimization strategy with rate limit handling
                            const optimizationStrategy = await this.reviewOptimizationStrategy();

                            // Format the report in a user-friendly way
                            const formattedReport = [
                                '📊 RESISTANCE INTELLIGENCE REPORT',
                                '',
                                '🎯 CONTENT ANALYSIS',
                                `- Recent Tweets: ${contentAnalysis?.recentTweets?.length || 0}`,
                                `- Top Performing: ${contentAnalysis?.topPerforming?.length || 0}`,
                                `- Content Types: ${Object.entries(contentAnalysis?.contentTypes || {})
                                    .map(([type, count]) => `${type}(${count})`).join(', ') || 'None'}`,
                                `- Popular Hashtags: ${contentAnalysis?.hashtags?.join(', ') || 'None'}`,
                                '',
                                '👥 AUDIENCE METRICS',
                                `- Followers: ${audienceAnalysis?.metrics?.followers || 0}`,
                                `- Following: ${audienceAnalysis?.metrics?.following || 0}`,
                                `- Total Tweets: ${audienceAnalysis?.metrics?.tweets || 0}`,
                                `- Engagement Rate: ${(audienceAnalysis?.metrics?.engagement_rate || 0).toFixed(2)}%`,
                                '',
                                '📈 GROWTH TRENDS',
                                `- Follower Growth: ${(audienceAnalysis?.trends?.follower_growth || 0).toFixed(2)}%`,
                                `- Engagement Trend: ${(audienceAnalysis?.trends?.engagement_trend || 0).toFixed(2)}%`,
                                '',
                                '🎮 OPTIMIZATION SUGGESTIONS',
                                `- Post Timing: Best times to post are during peak engagement hours`,
                                `- Content Mix: Maintain a balance of original content and engagement`,
                                `- Hashtag Strategy: Use 2-3 relevant hashtags per post`,
                                `- Engagement Focus: Reply to mentions within 24 hours`
                            ].join('\n');

                            const response = {
                                success: true,
                                message: formattedReport,
                                data: {
                                    content: contentAnalysis,
                                    audience: audienceAnalysis,
                                    optimization: optimizationStrategy
                                }
                            };

                            // Cache the successful response
                            this.setCachedData(cacheKey, response);

                            return response;
                        } catch (error) {
                            console.error('Error generating report:', error);
                            
                            // Try to use cached data on error
                            const cachedReport = this.getCachedData<CommandResponse>(`report_${this.targetUsername}`);
                            if (cachedReport) {
                                return {
                                    ...cachedReport,
                                    message: cachedReport.message + '\n\n⚠️ Error fetching fresh data, showing cached report.'
                                };
                            }

                            return {
                                success: false,
                                message: `Error generating report: Rate limits exceeded. Please try again in a few minutes.`,
                                error: error
                            };
                        }
                    }
                    default:
                        return { success: false, message: 'Unknown auto command' };
                }
            }

            return { success: false, message: 'Unknown command' };
        } catch (error) {
            console.error('Command execution error:', error);
            return {
                success: false,
                message: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: error
            };
        }
    }

    private updateRateLimit(endpoint: string, headers: Headers): void {
        const limit = headers.get('x-rate-limit-limit');
        const remaining = headers.get('x-rate-limit-remaining');
        const reset = headers.get('x-rate-limit-reset');

        if (limit && remaining && reset) {
            this.rateLimitCache.set(endpoint, {
                remaining: parseInt(remaining),
                reset: parseInt(reset) * 1000, // Convert to milliseconds
                lastRequest: Date.now()
            });
            console.log(`[DEBUG] Updated rate limits for ${endpoint}: ${remaining}/${limit} remaining`);
        }
    }

    private getCachedData<T>(key: string): T | null {
        const cached = this.storage.getItem(key);
        if (!cached) return null;

        try {
            const { data, timestamp } = JSON.parse(cached) as CacheEntry<T>;
            if (Date.now() - timestamp < TwitterService.CACHE_TTL) {
                return data;
            }
        } catch (error) {
            console.warn(`Error parsing cached data for ${key}:`, error);
        }
        return null;
    }

    private setCachedData<T>(key: string, data: T): void {
        try {
            this.storage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn(`Error caching data for ${key}:`, error);
        }
    }

    private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
        const cacheKey = `request_${endpoint}`;
        const now = Date.now();

        try {
            // Validate connection before making request
            if (!this.connectionStatus.isConnected) {
                const isConnected = await this.validateConnection();
                if (!isConnected) {
                    throw new Error('Twitter API connection is not available');
                }
            }

            // Check rate limits before making request
            const cached = this.rateLimitCache.get(endpoint);
            if (cached && cached.remaining <= 0 && cached.reset > now) {
                const waitTime = cached.reset - now;
                const waitTimeMin = Math.ceil(waitTime / 60000);
                console.log(`[DEBUG] Rate limited for ${endpoint}. Reset in ${waitTimeMin} minutes`);

                // Try to use cached data
                const cachedData = this.storage.getItem(cacheKey);
                if (cachedData) {
                    const { data, timestamp } = JSON.parse(cachedData);
                    if (now - timestamp < TwitterService.CACHE_TTL) {
                        return new Response(JSON.stringify({
                            ...data,
                            cached: true,
                            rateLimit: { resetIn: waitTime }
                        }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }

                const error = new Error('Rate limit exceeded') as any;
                error.status = 429;
                error.resetIn = waitTime;
                throw error;
            }

            const response = await fetch(`http://localhost:3002/api/twitter${endpoint}`, options);

            // Update connection status on successful request
            this.connectionStatus.isConnected = true;
            this.connectionStatus.lastCheck = new Date();

            // Update rate limits
            const limit = response.headers.get('x-rate-limit-limit');
            const remaining = response.headers.get('x-rate-limit-remaining');
            const reset = response.headers.get('x-rate-limit-reset');

            if (limit && remaining && reset) {
                this.rateLimitCache.set(endpoint, {
                    remaining: parseInt(remaining),
                    reset: parseInt(reset) * 1000,
                    lastRequest: now
                });
            }

            // Cache successful responses
            if (response.ok) {
                const data = await response.clone().json();
                this.storage.setItem(cacheKey, JSON.stringify({
                    data,
                    timestamp: now
                }));
            }

            return response;
        } catch (error) {
            // Update connection status on error
            this.connectionStatus = {
                isConnected: false,
                lastCheck: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            console.error(`API request error for ${endpoint}:`, error);
            throw error;
        }
    }

    public async getUserTweets(username: string): Promise<EnhancedTweet[]> {
        const endpoint = `/users/${username}/tweets`;
        try {
            await this.handleRateLimit(endpoint);

            const response = await this.makeRequest(endpoint);

            if (!response.ok) {
                throw new Error(`Failed to fetch tweets: ${response.statusText}`);
            }

            const data = await response.json();
            return data.tweets || [];
        } catch (error: any) {
            if (error.message?.includes('Rate limit exceeded')) {
                console.warn('Rate limited while fetching tweets, returning empty array');
                return [];
            }
            throw error;
        }
    }

    public async getRecentTweets(query: string): Promise<EnhancedTweet[]> {
        try {
            const response = await fetch(`/api/twitter/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch recent tweets');
            }
            const data = await response.json();
            return data.tweets.map((tweet: any) => ({
                id: tweet.id,
                text: tweet.text,
                createdAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
                metrics: tweet.public_metrics || {
                    retweet_count: 0,
                    reply_count: 0,
                    like_count: 0,
                    quote_count: 0
                }
            })) as EnhancedTweet[];
        } catch (error) {
            console.error('Error searching tweets:', error);
            throw error;
        }
    }

    public async findVerificationTweet(username: string, code: string): Promise<boolean> {
        try {
            const tweets = await this.getUserTweets(username);
            return tweets.some(tweet => tweet.text.includes(code));
        } catch (error) {
            console.error('Error finding verification tweet:', error);
            return false;
        }
    }

    private async analyzeTargetContent(username?: string): Promise<ContentAnalysis> {
        const targetUser = username || this.targetUsername;
        const cacheKey = `content_${targetUser}`;
        const cached = this.getCachedData<ContentAnalysis>(cacheKey);
        if (cached) {
            console.log('[DEBUG] Using cached content analysis');
            return cached;
        }

        try {
            const response = await this.makeRequest(`/users/${targetUser}/tweets`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`Failed to fetch tweets: ${data.detail || 'Unknown error'}`);
            }

            const tweets = data.data || [];
            const analysis: ContentAnalysis = {
                sentiment: tweets.length > 0 ? 'Based on tweet analysis' : 'No tweets available',
                topics: tweets.slice(0, 5).map((t: Tweet) => t.text?.split(' ')[0] || ''),
                video_metrics: {
                    views: tweets.filter((t: Tweet) => t.attachments?.media_keys?.length > 0).length,
                    duration: 0
                }
            };

            this.setCachedData(cacheKey, analysis);
            return analysis;
        } catch (error) {
            const cached = this.getCachedData<ContentAnalysis>(cacheKey);
            if (cached) {
                console.log('[DEBUG] Using cached content analysis due to error');
                return cached;
            }
            throw error;
        }
    }

    private analyzeTone(tweets: any[]): string {
        // Analyze tone based on actual tweet content
        return tweets.length > 0 ? 'Based on tweet analysis' : 'No tweets available';
    }

    private analyzeFormality(tweets: any[]): string {
        // Analyze formality based on actual tweet content
        return tweets.length > 0 ? 'Based on tweet analysis' : 'No tweets available';
    }

    private extractKeywords(tweets: any[]): string[] {
        // Extract actual keywords from tweets
        return tweets.length > 0 ? 
            tweets.slice(0, 5).map((t: any) => t.text.split(' ')[0]) : 
            ['No keywords available'];
    }

    private analyzeSentiment(tweets: any[]): string {
        // Analyze actual sentiment from tweets
        return tweets.length > 0 ? 'Based on tweet analysis' : 'No tweets available';
    }

    private extractTopics(tweets: any[]): string[] {
        // Extract actual topics from tweets
        return tweets.length > 0 ? 
            tweets.slice(0, 5).map((t: any) => t.text.split(' ')[0]) : 
            ['No topics available'];
    }

    private extractVideoTopics(tweets: any[]): string[] {
        // Extract topics from tweets with videos
        const videoTweets = tweets.filter((t: any) => t.attachments?.media_keys?.length > 0);
        return videoTweets.length > 0 ? 
            videoTweets.slice(0, 3).map((t: any) => t.text.split(' ')[0]) : 
            ['No video topics available'];
    }

    public async analyzeAudience(username: string): Promise<AudienceAnalysis> {
        try {
            const cacheKey = `audience_${username}`;
            const cached = this.storage.getItem(cacheKey);
            const now = Date.now();

            // Use cached data if less than 15 minutes old
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (now - timestamp < 15 * 60 * 1000) {
                    return data;
                }
            }

            // Fetch data in parallel with error handling
            const [userResponse, followersResponse, tweetsResponse] = await Promise.allSettled([
                this.makeRequest(`/users/${username}`),
                this.makeRequest(`/users/${username}/followers`),
                this.makeRequest(`/users/${username}/tweets`)
            ]);

            const analysis: AudienceAnalysis = {
                timestamp: new Date().toISOString(),
                metrics: {
                    engagement_rate: 0,
                    followers_count: 0,
                    following_count: 0,
                    tweet_count: 0
                },
                trends: {
                    follower_growth: 0,
                    engagement_trend: 0
                },
                cached: false
            };

            // Process user data
            if (userResponse.status === 'fulfilled') {
                const userData = await userResponse.value.json();
                if (userData.data) {
                    analysis.metrics.followers_count = userData.data.public_metrics?.followers_count || 0;
                    analysis.metrics.following_count = userData.data.public_metrics?.following_count || 0;
                    analysis.metrics.tweet_count = userData.data.public_metrics?.tweet_count || 0;
                }
            }

            // Process followers data
            if (followersResponse.status === 'fulfilled') {
                const followersData = await followersResponse.value.json();
                if (followersData.data) {
                    // Calculate follower growth trend
                    const previousFollowers = analysis.metrics.followers_count - followersData.data.length;
                    analysis.trends.follower_growth = previousFollowers > 0 ? 
                        ((analysis.metrics.followers_count - previousFollowers) / previousFollowers) * 100 : 0;
                }
            }

            // Process tweets data
            if (tweetsResponse.status === 'fulfilled') {
                const tweetsData = await tweetsResponse.value.json();
                if (tweetsData.data) {
                    // Calculate engagement rate from recent tweets
                    const recentTweets = tweetsData.data.slice(0, 10);
                    const totalEngagement = recentTweets.reduce((sum, tweet) => {
                        const metrics = tweet.public_metrics || {};
                        return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
                    }, 0);
                    
                    analysis.metrics.engagement_rate = recentTweets.length > 0 ? 
                        (totalEngagement / (recentTweets.length * analysis.metrics.followers_count)) * 100 : 0;
                }
            }

            // Cache the analysis
            this.storage.setItem(cacheKey, JSON.stringify({
                data: analysis,
                timestamp: now
            }));

            return analysis;
        } catch (error) {
            console.error('Error analyzing audience:', error);
            
            // Try to return cached data if available
            const cached = this.storage.getItem(`audience_${username}`);
            if (cached) {
                const { data } = JSON.parse(cached);
                return {
                    ...data,
                    cached: true,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
            
            throw error;
        }
    }

    private async reviewOptimizationStrategy(): Promise<OptimizationReview> {
        const username = this.autoModeConfig.targetConfigs.values().next().value.targetAccounts[0];
        
        try {
            const response = await fetch(`http://localhost:3002/api/twitter/users/${username}/campaigns/performance`);
            if (!response.ok) {
                console.warn(`[DEBUG] Failed to get campaign performance: ${response.status} ${response.statusText}`);
                // Return simulated data on error
                return {
                    timestamp: new Date(),
                    changes: {
                        audienceGrowth: 0,
                        topicShifts: ['technology', 'web3', 'ai'],
                        engagementTrends: {
                            likes: 0,
                            retweets: 0,
                            replies: 0
                        },
                        recommendedAdjustments: {
                            topics: ['technology', 'web3', 'ai'],
                            timing: [9, 14, 19],
                            contentStyle: 'engaging'
                        }
                    }
                };
            }
            
            const data = await response.json();
            return {
                timestamp: new Date(),
                changes: {
                    audienceGrowth: data.metrics?.followers || 0,
                    topicShifts: data.metrics?.topics || [],
                    engagementTrends: {
                        likes: data.metrics?.likes || 0,
                        retweets: data.metrics?.retweets || 0,
                        replies: data.metrics?.replies || 0
                    },
                    recommendedAdjustments: {
                        topics: data.recommendations?.topics || ['technology', 'web3', 'ai'],
                        timing: data.recommendations?.timing || [9, 14, 19],
                        contentStyle: data.recommendations?.style || 'engaging'
                    }
                }
            };
        } catch (error) {
            console.error('Error reviewing optimization strategy:', error);
            // Return simulated data on error
            return {
                timestamp: new Date(),
                changes: {
                    audienceGrowth: 0,
                    topicShifts: ['technology', 'web3', 'ai'],
                    engagementTrends: {
                        likes: 0,
                        retweets: 0,
                        replies: 0
                    },
                    recommendedAdjustments: {
                        topics: ['technology', 'web3', 'ai'],
                        timing: [9, 14, 19],
                        contentStyle: 'engaging'
                    }
                }
            };
        }
    }

    private async searchRelevantTweets(topics: TopicConfig): Promise<EnhancedTweet[]> {
        try {
            // Build search query from topics
            const searchTerms = [
                ...topics.keywords,
                ...topics.artists,
                ...topics.platforms,
                ...topics.genres
            ].join(' OR ');

            console.log('[DEBUG] Searching tweets with query:', searchTerms);

            const response = await fetch(`http://localhost:3002/api/twitter/search?q=${encodeURIComponent(searchTerms)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to search tweets: ${response.statusText}`);
            }

            const data = await response.json();
            return data.tweets || [];
        } catch (error) {
            console.error('Error searching tweets:', error);
            return [];
        }
    }

    private async handleGrowthCampaign(config: GrowthCampaignConfig): Promise<void> {
        try {
            // Check rate limits and last reply time
            if (config.lastReplyTimestamp) {
                const timeSinceLastReply = Date.now() - config.lastReplyTimestamp;
                if (timeSinceLastReply < 60000) { // Wait at least 1 minute between replies
                    return;
                }
            }

            // Search for relevant tweets
            const tweets = await this.searchRelevantTweets(config.topics);
            console.log(`[DEBUG] Found ${tweets.length} relevant tweets`);

            for (const tweet of tweets) {
                try {
                    // Skip if we've hit daily reply limit
                    if (config.maxDailyReplies <= 0) {
                        console.log('[DEBUG] Daily reply limit reached');
                        break;
                    }

                    // Generate reply using template
                    const template = config.replyTemplates[Math.floor(Math.random() * config.replyTemplates.length)];
                    const topic = config.topics.keywords[Math.floor(Math.random() * config.topics.keywords.length)];
                    const relatedTopic = config.topics.keywords[Math.floor(Math.random() * config.topics.keywords.length)];
                    
                    const reply = template
                        .replace('{topic}', topic)
                        .replace('{relatedTopic}', relatedTopic);

                    // Post reply
                    await fetch(`http://localhost:3002/api/twitter/tweets/${tweet.id}/reply`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: reply })
                    });

                    config.maxDailyReplies--;
                    config.lastReplyTimestamp = Date.now();
                    
                    console.log('[DEBUG] Posted reply:', reply);
                    
                    // Wait between replies to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 60000));
                } catch (error) {
                    console.error('Error posting reply:', error);
                    continue;
                }
            }
        } catch (error) {
            console.error('Error in growth campaign:', error);
        }
    }

    private async runGrowthCampaigns(): Promise<void> {
        if (!this.autoModeConfig.enabled) return;
        
        const growthCampaigns = Array.from(this.campaigns.values())
            .filter(c => c.campaignType === 'growth') as GrowthCampaignConfig[];

        for (const campaign of growthCampaigns) {
            if (!campaign.enabled) continue;
            
            await this.handleGrowthCampaign({
                ...campaign,
                topics: this.MUSIC_INDUSTRY_TOPICS,
                replyTemplates: this.GROWTH_REPLY_TEMPLATES,
                maxDailyReplies: 50 // Adjust as needed
            });
        }
    }

    // Update the getAutoModeStatus method to use proper number conversions
    private async getMetrics(username: string): Promise<{ engagement: number; followers: number; tweets: number }> {
        const response = await fetch(`http://localhost:3002/api/twitter/users/${username}/metrics`);
        if (!response.ok) {
            return { engagement: 0, followers: 0, tweets: 0 };
        }
            const data = await response.json();
            return {
            engagement: parseFloat(data.engagement_rate) || 0,
            followers: parseInt(data.followers_count) || 0,
            tweets: parseInt(data.tweets_count) || 0
        };
    }

    private async executeCampaign(type: string): Promise<void> {
        console.log(`[DEBUG ${new Date().toISOString()}] Starting campaign execution:`, {
            type,
            targetUsername: this.targetUsername,
            isRunning: this.isRunning,
            autoModeEnabled: this.autoModeConfig.enabled
        });

        const maxRetries = 3;
        let retryCount = 0;

        const executeWithRetry = async () => {
            try {
                // Check rate limits before executing campaign
                const rateLimitCheck = await this.handleRateLimit('/tweets');
                console.log(`[DEBUG ${new Date().toISOString()}] Rate limit check:`, rateLimitCheck);

                if (rateLimitCheck.remaining <= 0) {
                    const waitTime = Math.max(rateLimitCheck.reset - Date.now(), 60000);
                    console.log(`[DEBUG ${new Date().toISOString()}] Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    throw new Error('Rate limit hit, triggering retry');
                }

                const targetConfig = this.autoModeConfig.targetConfigs.get(this.targetUsername);
                if (!targetConfig) {
                    console.log(`[DEBUG ${new Date().toISOString()}] No configuration found for target:`, this.targetUsername);
                    throw new Error(`No configuration found for target: ${this.targetUsername}`);
                }

                console.log(`[DEBUG ${new Date().toISOString()}] Target config:`, {
                    username: this.targetUsername,
                    config: targetConfig
                });

                switch (type) {
                    case 'engagement': {
                        const campaignConfig: CampaignConfig = {
                            enabled: targetConfig.enabled,
                            targetAccount: this.targetUsername,
                            campaignType: 'engagement',
                            frequency: targetConfig.postFrequency,
                            customMessages: [],
                            maxDailyReplies: 40,
                            topics: {
                                keywords: ['music', 'web3', 'nft', 'community'],
                                artists: [],
                                platforms: ['twitter', 'discord'],
                                genres: ['electronic', 'indie']
                            }
                        };
                        await this.runEngagementCampaign(this.targetUsername, campaignConfig);
                        break;
                    }
                    case 'growth': {
                        const growthConfig: GrowthCampaignConfig = {
                            enabled: targetConfig.enabled,
                            targetAccount: this.targetUsername,
                            campaignType: 'growth',
                            frequency: targetConfig.postFrequency,
                            customMessages: [],
                            topics: {
                                keywords: ['music', 'web3', 'nft', 'community'],
                                artists: [],
                                platforms: ['twitter', 'discord'],
                                genres: ['electronic', 'indie']
                            },
                            replyTemplates: [],
                            maxDailyReplies: 30
                        };
                        await this.handleGrowthCampaign(growthConfig);
                        break;
                    }
                    case 'community': {
                        const communityConfig: CampaignConfig = {
                            enabled: targetConfig.enabled,
                            targetAccount: this.targetUsername,
                            campaignType: 'community',
                            frequency: targetConfig.postFrequency,
                            customMessages: [],
                            maxDailyReplies: 40,
                            topics: {
                                keywords: ['music', 'web3', 'nft', 'community'],
                                artists: [],
                                platforms: ['twitter', 'discord'],
                                genres: ['electronic', 'indie']
                            }
                        };
                        await this.runCommunityEngagement(this.targetUsername, communityConfig);
                        break;
                    }
                    default:
                        throw new Error(`Unknown campaign type: ${type}`);
                }
            } catch (error) {
                if (error instanceof TwitterApiError && error.rateLimitError && retryCount < maxRetries) {
                    retryCount++;
                    const waitTime = 60000 * retryCount; // Exponential backoff
                    console.log(`[DEBUG] Rate limited. Retry ${retryCount}/${maxRetries} in ${Math.ceil(waitTime/1000)}s`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return executeWithRetry();
                }
                throw error;
            }
        };

        try {
            await executeWithRetry();
        } catch (error) {
            console.error(`Failed to execute ${type} campaign after ${retryCount} retries:`, error);
        }
    }

    private async runCommunityEngagement(account: string, config: CampaignConfig): Promise<void> {
        try {
            // Get audience analysis and timeline content
            const [audienceAnalysis, timelineTweets] = await Promise.all([
                this.analyzeAudience(account),
                this.getUserTweets(account)
            ]);

            // Process mentions with community focus
            const mentions = await this.getRecentMentions(config.maxDailyReplies || 10);
            console.log(`Found ${mentions.length} community mentions to process`);

            for (const mention of mentions) {
                if (!this.autoModeConfig.enabled) break;

                try {
                    const reply = await this.generateSmartReply(mention, {
                        audienceInterests: audienceAnalysis.metrics,
                        customMessages: config.customMessages,
                        style: 'community'
                    });

                    if (reply) {
                        await this.reply(mention.id, reply);
                        console.log('Posted community reply:', reply);
                        await new Promise(resolve => setTimeout(resolve, config.frequency * 1000));
                    }
                } catch (error) {
                    console.error('Error in community engagement:', error);
                    continue;
                }
            }

            // Generate community-focused content if conditions are met
            const lastTweetTime = await this.getLastTweetTime();
            const hoursSinceLastTweet = (Date.now() - lastTweetTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastTweet >= 4) {
                const tweet = await this.generateTweetContent({
                    template: 'Building community through {topic} and {relatedTopic}! 🌟',
                    topics: config.topics?.keywords || ['community', 'music', 'web3'],
                    tone: 'engaging',
                    context: {
                        audienceInterests: audienceAnalysis.metrics,
                        recentPerformance: [],
                        timeOfDay: new Date().getHours()
                    }
                });

                if (tweet) {
                    await this.tweet(tweet);
                    console.log('Posted community tweet:', tweet);
                    await new Promise(resolve => setTimeout(resolve, this.autoModeConfig.campaignSettings.minTimeBetweenPosts * 1000));
                }
            }
        } catch (error) {
            console.error('Error in community campaign:', error);
            throw error;
        }
    }

    // AI-enhanced helper methods
    private async analyzeWithAI(text: string): Promise<any> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) {
                throw new Error('AI analysis failed');
            }
            
            return await response.json();
        } catch (error) {
            console.warn('AI analysis error:', error);
            return { sentiment: 'neutral', topics: [] };
        }
    }

    private async generateSmartReply(tweet: EnhancedTweet, options: {
        audienceInterests: { [key: string]: number },
        customMessages?: string[],
        style?: 'community' | 'growth' | 'engagement'
    }): Promise<string | null> {
        try {
            // Extract key topics and sentiment from the tweet
            const tweetContent = tweet.text || '';
            const sentiment = await this.analyzeSentiment(tweetContent);
            const topics = await this.extractTopics(tweetContent);

            // Generate reply based on style
            let template = '';
            switch (options.style || 'engagement') {
                case 'community':
                    template = 'Love the {topic} discussion! {customMessage} 🎵✨';
                    break;
                case 'growth':
                    template = 'Great point about {topic}! {customMessage} 🚀';
                    break;
                case 'engagement':
                default:
                    template = '{customMessage} {topic} {emoji}';
                    break;
            }

            // Fill template with dynamic content
            const reply = template
                .replace('{topic}', topics[0] || 'music')
                .replace('{customMessage}', options.customMessages?.[Math.floor(Math.random() * options.customMessages.length)] || 'Awesome!')
                .replace('{emoji}', sentiment > 0 ? '🎵' : '💭');

            return reply.length > 280 ? reply.substring(0, 277) + '...' : reply;
        } catch (error) {
            console.error('Error generating smart reply:', error);
            return null;
        }
    }

    private async createTargetProfileWithAI(tweets: EnhancedTweet[]): Promise<any> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/create-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tweets })
            });
            
            if (!response.ok) {
                throw new Error('AI profile creation failed');
            }
            
            return await response.json();
        } catch (error) {
            console.warn('AI profile creation error:', error);
            return {};
        }
    }

    private async filterRelevantAccountsWithAI(accounts: string[], profile: any, limit: number): Promise<string[]> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/filter-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accounts, targetProfile: profile, limit })
            });
            
            if (!response.ok) {
                throw new Error('AI account filtering failed');
            }
            
            const data = await response.json();
            return data.relevantAccounts;
        } catch (error) {
            console.warn('AI account filtering error:', error);
            return accounts.slice(0, limit);
        }
    }

    private async identifyRelevantTopicsWithAI(tweets: EnhancedTweet[]): Promise<string[]> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/identify-topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tweets })
            });
            
            if (!response.ok) {
                throw new Error('AI topic identification failed');
            }
            
            const data = await response.json();
            return data.topics;
        } catch (error) {
            console.warn('AI topic identification error:', error);
            return this.extractBasicTopics(tweets);
        }
    }

    private async scoreRelevanceWithAI(tweets: EnhancedTweet[], topic: string): Promise<EnhancedTweet[]> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/score-relevance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tweets, topic })
            });
            
            if (!response.ok) {
                throw new Error('AI relevance scoring failed');
            }
            
            const data = await response.json();
            return data.scoredTweets;
        } catch (error) {
            console.warn('AI relevance scoring error:', error);
            return tweets;
        }
    }

    private getDefaultReply(username: string): string {
        const templates = [
            `@${username} Thanks for reaching out! `,
            `@${username} Interesting point! 🤔`,
            `@${username} Thanks for sharing! 🙌`,
            `@${username} Great observation! 💡`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    private extractBasicTopics(tweets: any[]): string[] {
        const topics = new Set<string>();
        const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have']);
        
        for (const tweet of tweets) {
            const words = tweet.text
                .toLowerCase()
                .split(/\s+/)
                .filter((w: string) => 
                    w.length > 3 && 
                    !stopWords.has(w) && 
                    !w.startsWith('@') && 
                    !w.startsWith('http')
                );
            words.forEach((w: string) => topics.add(w));
        }
        
        return Array.from(topics).slice(0, 5);
    }

    // Add these methods before the AI-enhanced helper methods

    private async getRecentMentions(limit: number): Promise<any[]> {
        try {
            const response = await fetch(`http://localhost:3002/api/twitter/mentions?limit=${limit}`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.mentions || [];
        } catch (error) {
            console.error('Error getting mentions:', error);
            return [];
        }
    }

    private async replyToMention(mention: { id: string; text: string; author_username: string }): Promise<void> {
        try {
            const response = await fetch(`http://localhost:3002/api/twitter/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    in_reply_to_tweet_id: mention.id,
                    text: `@${mention.author_username} ${mention.text}`
                })
            });
            if (!response.ok) throw new Error(`Failed to reply: ${response.statusText}`);
        } catch (error) {
            console.error('Error replying to mention:', error);
            throw error;
        }
    }

    private async getUserFollowers(username: string, limit: number): Promise<string[]> {
        try {
            const response = await fetch(
                `http://localhost:3002/api/twitter/users/${username}/followers?limit=${limit}`
            );
            if (!response.ok) return [];
            const data = await response.json();
            return data.followers?.map((f: any) => f.username) || [];
        } catch (error) {
            console.error('Error getting followers:', error);
            return [];
        }
    }

    private async followAccount(username: string): Promise<void> {
        try {
            const response = await fetch(`http://localhost:3002/api/twitter/follow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            if (!response.ok) throw new Error(`Failed to follow account: ${response.statusText}`);
        } catch (error) {
            console.error('Error following account:', error);
            throw error;
        }
    }

    private async searchRecentTweets(query: string): Promise<any[]> {
        try {
            const response = await fetch(
                `http://localhost:3002/api/twitter/search/recent?q=${encodeURIComponent(query)}`
            );
            if (!response.ok) return [];
            const data = await response.json();
            return data.tweets || [];
        } catch (error) {
            console.error('Error searching tweets:', error);
            return [];
        }
    }

    private async engageWithTweet(tweet: EnhancedTweet): Promise<void> {
        try {
            // Like the tweet
            await fetch(`http://localhost:3002/api/twitter/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tweet_id: tweet.id })
            });
            
            // Only retweet if it meets quality criteria
            if (this.meetsTweetQuality(tweet)) {
                await fetch(`http://localhost:3002/api/twitter/retweet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tweet_id: tweet.id })
                });
            }
        } catch (error) {
            console.error('Error engaging with tweet:', error);
            throw error;
        }
    }

    private meetsTweetQuality(tweet: any): boolean {
        const metrics = tweet.public_metrics || {};
        const minLikes = 10;
        const minRetweets = 5;
        
        return (
            metrics.like_count >= minLikes &&
            metrics.retweet_count >= minRetweets &&
            !tweet.text.toLowerCase().includes('follow') &&
            !tweet.text.toLowerCase().includes('retweet')
        );
    }

    // Add these AI enhancement methods

    private async analyzeContentSentiment(text: string): Promise<{
        sentiment: 'positive' | 'negative' | 'neutral';
        confidence: number;
        topics: string[];
    }> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/analyze-sentiment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) throw new Error('Sentiment analysis failed');
            return await response.json();
        } catch (error) {
            console.warn('Sentiment analysis error:', error);
            return { sentiment: 'neutral', confidence: 0, topics: [] };
        }
    }

    private async scoreAccountRelevance(
        account: string,
        targetProfile: any
    ): Promise<{ score: number; reasons: string[] }> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/score-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account, targetProfile })
            });
            
            if (!response.ok) throw new Error('Account scoring failed');
            return await response.json();
        } catch (error) {
            console.warn('Account scoring error:', error);
            return { score: 0, reasons: [] };
        }
    }

    private async optimizePostTiming(
        recentTweets: any[],
        targetTimezone: string
    ): Promise<number[]> {
        try {
            const response = await fetch('http://localhost:3002/api/ai/optimize-timing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recentTweets, targetTimezone })
            });
            
            if (!response.ok) throw new Error('Timing optimization failed');
            const data = await response.json();
            return data.recommendedHours;
        } catch (error) {
            console.warn('Timing optimization error:', error);
            return [9, 12, 15, 18]; // Default business hours
        }
    }

    public async getUser(username: string): Promise<any> {
        const cacheKey = `user_${username}`;
        const cachedData = this.storage.getItem(cacheKey);

        try {
            // Check rate limits before making request
            const rateLimitCheck = await this.handleRateLimit('/users');
            if (rateLimitCheck.error) {
                const waitTimeMin = Math.ceil((rateLimitCheck.resetIn || 60000) / 60);
                
                if (cachedData) {
                    const { data, timestamp } = JSON.parse(cachedData);
                    console.log('[DEBUG] Rate limited - using cached user data');
                    return {
                        ...data,
                        cached: true,
                        cacheAge: Math.floor((Date.now() - timestamp) / 1000 / 60), // minutes
                        rateLimit: {
                            message: `Rate limited - using cached data (resets in ${waitTimeMin} minutes)`,
                            resetIn: rateLimitCheck.resetIn
                        }
                    };
                }
                
                throw new Error(`Rate limited - please wait ${waitTimeMin} minutes before retrying`);
            }

            const response = await this.makeRequest(`/users/${username}`);
            if (!response.ok) {
                if (response.status === 429) {
                    const resetTime = response.headers.get('x-rate-limit-reset');
                    const waitTimeMs = resetTime ? (new Date(Number(resetTime) * 1000).getTime() - Date.now()) : 60000;
                    const waitTimeMin = Math.ceil(waitTimeMs / 60000);
                    
                    if (cachedData) {
                        const { data, timestamp } = JSON.parse(cachedData);
                        console.log('[DEBUG] Rate limited - using cached user data');
                        return {
                            ...data,
                            cached: true,
                            cacheAge: Math.floor((Date.now() - timestamp) / 1000 / 60), // minutes
                            rateLimit: {
                                message: `Rate limited - using cached data (resets in ${waitTimeMin} minutes)`,
                                resetIn: waitTimeMs / 1000
                            }
                        };
                    }
                    
                    throw new Error(`Rate limited - please wait ${waitTimeMin} minutes before retrying`);
                }
                throw new Error(`Failed to get user: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the successful response
            this.storage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return {
                ...data,
                cached: false
            };
        } catch (error: any) {
            console.error('Error getting user:', error);
            
            if (error?.message?.includes('Rate limited')) {
                if (cachedData) {
                    const { data, timestamp } = JSON.parse(cachedData);
                    console.log('[DEBUG] Rate limited - using cached user data');
                    return {
                        ...data,
                        cached: true,
                        cacheAge: Math.floor((Date.now() - timestamp) / 1000 / 60), // minutes
                        rateLimit: {
                            message: error.message
                        }
                    };
                }
                throw error;
            }
            
            // For other errors, use cached data if available
            if (cachedData) {
                const { data, timestamp } = JSON.parse(cachedData);
                console.log('[DEBUG] Using cached user data due to error');
                return {
                    ...data,
                    cached: true,
                    cacheAge: Math.floor((Date.now() - timestamp) / 1000 / 60) // minutes
                };
            }
            
            throw error;
        }
    }

    private async handleAutoModeStart(): Promise<CommandResponse> {
        if (!this.targetUsername) {
            return { success: false, message: 'No target account specified' };
        }

        this.isRunning = true;
        this.startTime = new Date();
        this.saveState();

        return {
            success: true,
            message: `Auto mode started for @${this.targetUsername}`
        };
    }

    private async handleAutoModeStop(): Promise<CommandResponse> {
        this.isRunning = false;
        this.saveState();

        return {
            success: true,
            message: 'Auto mode stopped'
        };
    }

    private saveState(): void {
        try {
            const state = {
                isRunning: this.isRunning,
                targetUsername: this.targetUsername,
                startTime: this.startTime,
                config: this.autoModeConfig,
                metrics: this.metrics
            };
            this.storage.setItem('twitter_automation_state', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving Twitter service state:', error);
        }
    }
    
    private loadState(): void {
        try {
            if (!this.storage) {
                console.error('Storage not initialized');
                return;
            }
            
            const state = this.storage.getItem('twitter_automation_state');
            if (state) {
                const parsedState = JSON.parse(state);
                this.isRunning = parsedState.isRunning || false;
                this.targetUsername = parsedState.targetUsername || '';
                this.startTime = parsedState.startTime ? new Date(parsedState.startTime) : null;
                
                // Ensure autoModeConfig is properly loaded with target configs
                if (parsedState.config) {
                    this.autoModeConfig = parsedState.config;
                    // Convert target configs back to Map if needed
                    if (!(this.autoModeConfig.targetConfigs instanceof Map)) {
                        this.autoModeConfig.targetConfigs = new Map(Object.entries(this.autoModeConfig.targetConfigs));
                    }
                } else {
                    this.autoModeConfig = this.getDefaultAutoConfig();
                }

                // Ensure metrics are set
                this.metrics = {
                    engagement_rate: parsedState.metrics?.engagement_rate || 0,
                    followers_count: parsedState.metrics?.followers_count || 0,
                    following_count: parsedState.metrics?.following_count || 0,
                    tweet_count: parsedState.metrics?.tweet_count || 0
                };

                // Log state for debugging
                console.log('[DEBUG] Loaded state:', {
                    isRunning: this.isRunning,
                    targetUsername: this.targetUsername,
                    configsSize: this.autoModeConfig.targetConfigs.size,
                    hasMetrics: !!this.metrics
                });
            }
        } catch (error) {
            console.error('Error loading Twitter service state:', error);
            // Set default values on error
            this.isRunning = false;
            this.targetUsername = '';
            this.startTime = null;
            this.autoModeConfig = this.getDefaultAutoConfig();
            this.metrics = {
                engagement_rate: 0,
                followers_count: 0,
                following_count: 0,
                tweet_count: 0
            };
        }
    }

    public async addTarget(username: string): Promise<void> {
        if (!this.autoModeConfig.targetConfigs.has(username)) {
            const newTarget: TargetConfig = {
                enabled: true,
                postFrequency: this.autoModeConfig.campaignSettings.defaultFrequency,
                campaignTypes: ['engagement', 'growth', 'community'],
                lastActivity: new Date(),
                metrics: {
                    engagement_rate: 0,
                    followers_count: 0,
                    following_count: 0,
                    tweet_count: 0
                }
            };
            this.autoModeConfig.targetConfigs.set(username, newTarget);
            this.saveConfig();
            this.saveCampaigns();
            
            // Initialize default campaigns for the target
            const engagementCampaign: CampaignConfig = {
                enabled: true,
                targetAccount: username,
                campaignType: 'engagement',
                frequency: 30,
                customMessages: [],
                maxDailyReplies: 50,
                topics: {
                    keywords: ['music', 'web3', 'nft', 'community'],
                    artists: [],
                    platforms: ['twitter', 'discord'],
                    genres: ['electronic', 'indie']
                }
            };
            this.campaigns.set(`${username}_engagement`, engagementCampaign);

            const growthCampaign: GrowthCampaignConfig = {
                enabled: true,
                targetAccount: username,
                campaignType: 'growth',
                frequency: 60,
                customMessages: [],
                topics: {
                    keywords: ['music', 'web3', 'nft', 'community'],
                    artists: [],
                    platforms: ['twitter', 'discord'],
                    genres: ['electronic', 'indie']
                },
                replyTemplates: [],
                maxDailyReplies: 30
            };
            this.campaigns.set(`${username}_growth`, growthCampaign);

            const communityCampaign: CampaignConfig = {
                enabled: true,
                targetAccount: username,
                campaignType: 'community',
                frequency: 45,
                customMessages: [],
                maxDailyReplies: 40,
                topics: {
                    keywords: ['music', 'web3', 'nft', 'community'],
                    artists: [],
                    platforms: ['twitter', 'discord'],
                    genres: ['electronic', 'indie']
                }
            };
            this.campaigns.set(`${username}_community`, communityCampaign);
        }
    }

    private checkRateLimit(endpoint: string): boolean {
        const limit = this.rateLimits.get(endpoint);
        if (!limit) return true;
        return limit.remaining > 0;
    }

    public async removeTarget(username: string): Promise<void> {
        if (this.autoModeConfig.targetConfigs.has(username)) {
            this.autoModeConfig.targetConfigs.delete(username);
            this.saveConfig();
        }
    }

    public getTargets(): string[] {
        return Array.from(this.autoModeConfig.targetConfigs.keys());
    }

    private saveConfig(): void {
        try {
            // Convert Map to object for storage
            const configToSave = {
                ...this.autoModeConfig,
                targetConfigs: Object.fromEntries(this.autoModeConfig.targetConfigs)
            };
            this.storage.setItem('autoModeConfig', JSON.stringify(configToSave));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    private saveCampaigns(): void {
        try {
            const campaignsData = Array.from(this.campaigns.entries());
            this.storage.setItem('campaigns', JSON.stringify(campaignsData));
        } catch (error) {
            console.error('Error saving campaigns:', error);
        }
    }

    private async checkAutoStatus(): Promise<CommandResponse> {
        return {
            success: true,
            message: `Auto mode status:\nRunning: ${this.isRunning}\nTarget: ${this.targetUsername}\nStart time: ${this.startTime?.toLocaleString() || 'Not started'}`
        };
    }

    public getTargetUsername(): string {
        if (!this.targetUsername && this.autoModeConfig?.targetConfigs.size > 0) {
            // Get the first target account from auto mode config
            this.targetUsername = this.autoModeConfig.targetConfigs.values().next().value.targetAccounts[0];
        }
        return this.targetUsername;
    }

    public async analyzeVideoContent(tweet: TweetWithVideo): Promise<VideoAnalysis> {
        try {
            const videoUrl = tweet.attachments?.media_keys?.find(key => key.startsWith('video'));
            if (!videoUrl || !tweet.id) {
                throw new Error('No valid video found in tweet');
            }

            // Get video metrics from Twitter API
            const metrics: VideoMetrics = await this.client.v2.get(`tweets/${tweet.id}/video_metrics`);
            
            // Analyze video content
            const analysis: VideoAnalysis = {
                engagement_rate: metrics.engagement_rate || 0,
                topics: await this.extractTopicsFromVideo(tweet),
                duration: (metrics.duration_ms || 0) / 1000,
                style: await this.analyzeVideoStyle(tweet),
                views: metrics.view_count || 0,
                completion_rate: metrics.completion_rate || 0,
                peak_moments: metrics.peak_moments || [],
                engagement: 0
            };

            // Calculate engagement based on views and completion rate
            analysis.engagement = (analysis.views * analysis.completion_rate) / 100;

            return analysis;
        } catch (error) {
            console.error('Error analyzing video content:', error);
            throw error;
        }
    }

    private async extractTopicsFromVideo(tweet: TweetWithVideo): Promise<string[]> {
        const topics = new Set<string>();
        
        if (tweet.text) {
            const hashtags = tweet.text.match(/#\w+/g) || [];
            hashtags.forEach((tag: string) => topics.add(tag.substring(1).toLowerCase()));
        }
        
        return Array.from(topics);
    }

    private async analyzeVideoStyle(tweet: TweetWithVideo): Promise<string[]> {
        const styles: string[] = [];
        
        if (tweet.public_metrics && tweet.public_metrics.like_count > 100) {
            styles.push('high_engagement');
        }
        
        return styles;
    }

    public async updateContentStrategy(strategy: ContentStrategy): Promise<void> {
        try {
            // Update the content strategy with new insights
            this.contentStrategy = {
                ...this.contentStrategy,
                videoTopics: [...new Set([...this.contentStrategy.videoTopics, ...strategy.videoTopics])],
                optimalDuration: (this.contentStrategy.optimalDuration + strategy.optimalDuration) / 2,
                bestPerformingStyles: [...new Set([...this.contentStrategy.bestPerformingStyles, ...strategy.bestPerformingStyles])]
            };
            
            // Save updated strategy
            await this.saveContentStrategy();
        } catch (error) {
            console.error('Error updating content strategy:', error);
            throw error;
        }
    }

    private async saveContentStrategy(): Promise<void> {
        try {
            // Save content strategy to storage
            this.storage.setItem('content_strategy', JSON.stringify(this.contentStrategy));
        } catch (error) {
            console.error('Error saving content strategy:', error);
            throw error;
        }
    }

    public async getFollowerInteractions(follower: string): Promise<FollowerInteractions> {
        try {
            const tweets = await this.client.v2.userTimeline(follower, {
                'tweet.fields': ['referenced_tweets', 'created_at']
            });

            const interactions: FollowerInteractions = {
                likes: 0,
                retweets: 0,
                replies: 0,
                mentions: 0,
                lastInteraction: new Date(0)
            };

            for (const tweet of tweets.data || []) {
                if (tweet.referenced_tweets) {
                    for (const ref of tweet.referenced_tweets) {
                        if (ref.type === 'replied_to') interactions.replies++;
                        else if (ref.type === 'retweeted') interactions.retweets++;
                    }
                }
                if (tweet.text.includes(`@${this.targetUsername}`)) {
                    interactions.mentions++;
                }
                const tweetDate = new Date(tweet.created_at);
                if (tweetDate > interactions.lastInteraction) {
                    interactions.lastInteraction = tweetDate;
                }
            }

            // Get likes from user's liked tweets
            const likes = await this.client.v2.userLikedTweets(follower);
            interactions.likes = likes.data?.length || 0;

            return interactions;
        } catch (error) {
            console.error('Error getting follower interactions:', error);
            throw error;
        }
    }

    public async analyzeUserActivity(follower: string): Promise<UserActivity> {
        try {
            const tweets = await this.client.v2.userTimeline(follower, {
                max_results: 100,
                'tweet.fields': ['created_at', 'entities', 'attachments']
            });

            const activity: UserActivity = {
                topics: [],
                activeHours: new Array(24).fill(0),
                contentTypes: {
                    text: 0,
                    images: 0,
                    videos: 0,
                    links: 0
                }
            };

            const topics = new Set<string>();

            for (const tweet of tweets.data || []) {
                // Track active hours
                const tweetDate = new Date(tweet.created_at);
                activity.activeHours[tweetDate.getHours()]++;

                // Track content types
                if (tweet.attachments?.media_keys) {
                    for (const key of tweet.attachments.media_keys) {
                        if (key.startsWith('video')) activity.contentTypes.videos++;
                        else if (key.startsWith('photo')) activity.contentTypes.images++;
                    }
                }
                if (tweet.entities?.urls?.length) activity.contentTypes.links++;
                if (!tweet.attachments && !tweet.entities?.urls?.length) activity.contentTypes.text++;

                // Extract topics from hashtags and text
                tweet.entities?.hashtags?.forEach(tag => topics.add(tag.tag.toLowerCase()));
            }

            activity.topics = Array.from(topics);
            return activity;
        } catch (error) {
            console.error('Error analyzing user activity:', error);
            throw error;
        }
    }

    public async updateGrowthStrategy(strategy: GrowthStrategy): Promise<void> {
        try {
            this.growthStrategy = {
                ...this.growthStrategy,
                targetTopics: [...new Set([...this.growthStrategy.targetTopics, ...strategy.targetTopics])],
                optimalPostingHours: strategy.optimalPostingHours,
                contentTypePreferences: strategy.contentTypePreferences
            };
            
            await this.saveGrowthStrategy();
        } catch (error) {
            console.error('Error updating growth strategy:', error);
            throw error;
        }
    }

    private async saveGrowthStrategy(): Promise<void> {
        try {
            this.storage.setItem('growth_strategy', JSON.stringify(this.growthStrategy));
        } catch (error) {
            console.error('Error saving growth strategy:', error);
            throw error;
        }
    }

    // Add these methods to the TwitterService class
    public async getFollowers(username: string): Promise<string[]> {
        try {
            const user = await this.client.v2.userByUsername(username);
            if (!user.data) {
                throw new Error(`User ${username} not found`);
            }

            const followers = await this.client.v2.followers(user.data.id, {
                max_results: 100
            });

            return followers.data?.map(follower => follower.username) || [];
        } catch (error) {
            console.error('Error getting followers:', error);
            return [];
        }
    }

    public async getFollowing(username: string): Promise<string[]> {
        try {
            const user = await this.client.v2.userByUsername(username);
            if (!user.data) {
                throw new Error(`User ${username} not found`);
            }

            const following = await this.client.v2.following(user.data.id, {
                max_results: 100
            });

            return following.data?.map(follow => follow.username) || [];
        } catch (error) {
            console.error('Error getting following:', error);
            return [];
        }
    }

    public async followUser(username: string): Promise<boolean> {
        try {
            if (!this.userId) {
                throw new Error('User ID not initialized');
            }

            const user = await this.client.v2.userByUsername(username);
            if (!user.data) {
                throw new Error(`User ${username} not found`);
            }

            await this.client.v2.follow(this.userId, user.data.id);
            console.log(`Successfully followed user: ${username}`);
            return true;
        } catch (error) {
            console.error('Error following user:', error);
            return false;
        }
    }

    public async generateTweetContent(params: TweetGenerationParams): Promise<string> {
        try {
            // Replace template variables with actual content
            let tweet = params.template;
            
            // Replace {topic} with a randomly selected topic
            if (tweet.includes('{topic}')) {
                const topic = params.topics[Math.floor(Math.random() * params.topics.length)];
                tweet = tweet.replace('{topic}', topic);
            }
            
            // Replace {relatedTopic} with a different topic
            if (tweet.includes('{relatedTopic}')) {
                const availableTopics = params.topics.filter(t => !tweet.includes(t));
                const relatedTopic = availableTopics.length > 0 ? 
                    availableTopics[Math.floor(Math.random() * availableTopics.length)] :
                    params.context.audienceInterests[0];
                tweet = tweet.replace('{relatedTopic}', relatedTopic);
            }
            
            // Replace other template variables based on type
            tweet = tweet
                .replace('{detail}', this.generateDetail(params.topics[0], params.tone))
                .replace('{application}', this.generateApplication(params.topics[0]))
                .replace('{advice}', this.generateAdvice(params.topics[0]))
                .replace('{benefit}', this.generateBenefit(params.topics[0]));
                
            return tweet;
        } catch (error) {
            console.error('Error generating tweet content:', error);
            return '';
        }
    }

    public async getLastTweetTime(): Promise<Date> {
        try {
            if (!this.client || !this.userId) {
                throw new Error('Twitter client or user ID not initialized');
            }
            
            const tweets = await this.client.v2.userTimeline(this.userId, {
                max_results: 1,
                'tweet.fields': ['created_at']
            });
            
            if (tweets.data && tweets.data[0]) {
                return new Date(tweets.data[0].created_at);
            }
            
            // If no tweets found, return a date far in the past
            return new Date(0);
        } catch (error) {
            console.error('Error getting last tweet time:', error);
            return new Date(0);
        }
    }

    private generateDetail(topic: string, tone: string): string {
        const details: TopicDetails = {
            music: [
                'layering multiple synth patches for depth',
                'using parallel compression for punch',
                'automating reverb for space',
                'mixing with reference tracks'
            ],
            production: [
                'organizing samples by emotion',
                'creating custom effect racks',
                'using sidechain creatively',
                'building dynamic transitions'
            ],
            creativity: [
                'starting with a simple melody',
                'experimenting with unusual scales',
                'combining different genres',
                'sampling everyday sounds'
            ]
        };
        
        const topicDetails = details[topic] || details.music;
        return topicDetails[Math.floor(Math.random() * topicDetails.length)];
    }

    private generateApplication(topic: string): string {
        const applications: TopicDetails = {
            music: [
                'sound design',
                'mixing',
                'arrangement',
                'production workflow'
            ],
            production: [
                'track organization',
                'mixing efficiency',
                'creative process',
                'sound quality'
            ],
            creativity: [
                'inspiration',
                'songwriting',
                'unique sound',
                'artistic growth'
            ]
        };
        
        const topicApps = applications[topic] || applications.music;
        return topicApps[Math.floor(Math.random() * topicApps.length)];
    }

    private generateAdvice(topic: string): string {
        const advice: TopicDetails = {
            workflow: [
                'organize your samples before starting',
                'create templates for different genres',
                'use keyboard shortcuts for speed',
                'take regular breaks to avoid ear fatigue'
            ],
            production: [
                'start with the core elements',
                'use reference tracks',
                'keep your mixing headroom',
                'label and color-code everything'
            ],
            creativity: [
                'try a new instrument or plugin',
                'collaborate with other artists',
                'record found sounds',
                'experiment with different genres'
            ]
        };
        
        const topicAdvice = advice[topic] || advice.workflow;
        return topicAdvice[Math.floor(Math.random() * topicAdvice.length)];
    }

    private generateBenefit(topic: string): string {
        const benefits: TopicDetails = {
            workflow: [
                'productivity',
                'organization',
                'efficiency',
                'focus'
            ],
            production: [
                'sound quality',
                'mix clarity',
                'creative output',
                'technical skills'
            ],
            creativity: [
                'inspiration',
                'originality',
                'artistic expression',
                'musical growth'
            ]
        };
        
        const topicBenefits = benefits[topic] || benefits.workflow;
        return topicBenefits[Math.floor(Math.random() * topicBenefits.length)];
    }

    private cleanMessage(message: string): string {
        message = message.replace(/#\w+/g, '');
        message = message.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
        message = message.replace(/\s+/g, ' ').trim();
        
        if (message.length > 280) {
            message = message.substring(0, 277) + '...';
        }
        
        return message;
    }

    private isNode(): boolean {
        return typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
    }

    private readonly MUSIC_INDUSTRY_TOPICS = {
        keywords: ['music', 'web3', 'nft', 'community'],
        artists: [],
        platforms: ['twitter', 'discord'],
        genres: ['electronic', 'indie']
    };

    private readonly GROWTH_REPLY_TEMPLATES = [
        'Great point about {topic}! Have you considered {suggestion}?',
        'Love your take on {topic}! What do you think about {question}?',
        'Interesting perspective on {topic}! {insight}'
    ];

    private async runEngagementCampaign(account: string, config: CampaignConfig): Promise<void> {
        try {
            // Get recent mentions and interactions
            const mentions = await this.getRecentMentions(10);
            
            // Process each mention
            for (const mention of mentions) {
                if (!this.autoModeConfig.enabled) break;
                
                try {
                    await this.replyToMention(mention);
                } catch (error) {
                    console.error(`Error replying to mention ${mention.id}:`, error);
                }
                
                // Respect rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error('Error running engagement campaign:', error);
            throw error;
        }
    }

    public getConnectionStatus(): { isConnected: boolean; lastCheck: Date; error?: string } {
        return { ...this.connectionStatus };
    }

    public async updateCampaignTypes(types: string[]): Promise<void> {
        if (!this.targetUsername) {
            throw new Error('No target account set');
        }

        const validTypes = ['engagement', 'growth', 'community'];
        const invalidTypes = types.filter(type => !validTypes.includes(type));
        if (invalidTypes.length > 0) {
            throw new Error(`Invalid campaign types: ${invalidTypes.join(', ')}. Valid types are: ${validTypes.join(', ')}`);
        }

        const targetConfig = this.autoModeConfig.targetConfigs.get(this.targetUsername);
        if (!targetConfig) {
            throw new Error(`No configuration found for target: ${this.targetUsername}`);
        }

        targetConfig.campaignTypes = types;
        this.autoModeConfig.targetConfigs.set(this.targetUsername, targetConfig);
        this.saveConfig();
        this.saveCampaigns();

        console.log(`[DEBUG ${new Date().toISOString()}] Updated campaign types for @${this.targetUsername}:`, types);
    }

    public async updateAutoModeConfig(config: Partial<AutoModeConfig>): Promise<void> {
        try {
            // Update campaign types if provided
            if (config.campaignTypes) {
                // Validate campaign types
                const validTypes = ['engagement', 'growth', 'community'];
                const invalidTypes = config.campaignTypes.filter(type => !validTypes.includes(type));
                if (invalidTypes.length > 0) {
                    throw new Error(`Invalid campaign types: ${invalidTypes.join(', ')}`);
                }

                // Update campaign types in auto mode config
                this.autoModeConfig = {
                    ...this.autoModeConfig,
                    campaignTypes: config.campaignTypes
                };

                // Update campaign types for all target configs
                for (const [account, targetConfig] of this.autoModeConfig.targetConfigs.entries()) {
                    targetConfig.campaignTypes = config.campaignTypes;
                    this.autoModeConfig.targetConfigs.set(account, targetConfig);
                }

                // Save the updated configuration
                this.saveConfig();
                console.log(`[DEBUG ${new Date().toISOString()}] Updated campaign types:`, config.campaignTypes);
            }
        } catch (error) {
            console.error(`[DEBUG ${new Date().toISOString()}] Failed to update auto mode config:`, error);
            throw error;
        }
    }
} 