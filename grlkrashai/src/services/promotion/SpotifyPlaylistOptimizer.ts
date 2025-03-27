import { IAgentRuntime } from '@elizaos/core';
import { SpotifyMetrics, StreamQualityMetrics } from './SpotifyAnalyticsService';

export interface PlaylistOptimizationStrategy {
    timing: {
        dayOfWeek: string;
        timeOfDay: string;
        timezone: string;
    };
    targetActions: {
        requiredSaves: number;
        requiredCompletePlays: number;
        requiredPlaylistAdds: number;
    };
    contentStrategy: {
        idealDuration: number;
        genreAlignment: string[];
        moodAlignment: string[];
        targetAudience: {
            primaryGenres: string[];
            similarArtists: string[];
            audienceSize: {
                min: number;
                max: number;
            };
        };
        promotionChannels: {
            type: 'playlist' | 'influencer' | 'community' | 'streamer';
            name: string;
            platform: string;
            audienceMatch: number;
            engagementRate: number;
            submissionType: string;
            submissionWindow: string;
            averageViewers: number;
        }[];
    };
}

export class SpotifyPlaylistOptimizer {
    private runtime: IAgentRuntime;
    private readonly UPDATE_DAYS = {
        RELEASE_RADAR: 'Friday',
        DISCOVER_WEEKLY: 'Monday'
    };

    private readonly GENRE_TIERS = {
        PRIMARY: ['hip-hop', 'rap', 'trap', 'r&b', 'hyperpop'],
        SECONDARY: ['pop', 'electronic', 'alternative', 'indie'],
        TERTIARY: ['dance', 'soul', 'urban']
    };

    private readonly PROMOTION_TARGETS = {
        COMMUNITIES: [
            { name: 'OnTheRadar', platform: 'instagram', minFollowers: 100000, genre: ['hip-hop', 'rap'] },
            { name: 'UndergroundSounds', platform: 'instagram', minFollowers: 50000, genre: ['hip-hop', 'rap', 'r&b'] },
            { name: 'DailyChiefers', platform: 'instagram', minFollowers: 75000, genre: ['hip-hop', 'rap', 'trap'] },
            { name: 'TrashMag', platform: 'instagram', minFollowers: 50000, genre: ['hip-hop', 'rap', 'hyperpop'], submissionType: 'email' }
        ],
        INFLUENCERS: [
            { type: 'curator', platform: 'tiktok', minFollowers: 50000, genre: ['hip-hop', 'rap'] },
            { type: 'reviewer', platform: 'instagram', minFollowers: 25000, genre: ['hip-hop', 'r&b'] }
        ],
        STREAMERS: [
            { 
                name: 'PatricCC',
                platform: 'twitch',
                minFollowers: 10000,
                genre: ['hip-hop', 'pop'],
                submissionType: 'twitter',
                averageViewers: 500,
                submissionWindow: 'weekly'
            },
            {
                name: 'plaqueboymax',
                platform: 'twitch',
                minFollowers: 8000,
                genre: ['hip-hop', 'rap'],
                submissionType: 'email',
                averageViewers: 400,
                submissionWindow: 'monthly'
            }
        ]
    };

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    async generateReleaseRadarStrategy(
        currentMetrics: SpotifyMetrics,
        streamQuality: StreamQualityMetrics
    ): Promise<PlaylistOptimizationStrategy> {
        const baseStrategy = {
            timing: {
                dayOfWeek: 'Thursday',
                timeOfDay: '18:00',
                timezone: 'UTC'
            },
            targetActions: {
                requiredSaves: Math.max(50, currentMetrics.saves * 1.2),
                requiredCompletePlays: Math.max(100, currentMetrics.totalStreams * 0.8),
                requiredPlaylistAdds: Math.max(20, currentMetrics.playlistAdds * 1.1)
            },
            contentStrategy: {
                idealDuration: 210,
                genreAlignment: this.GENRE_TIERS.PRIMARY,
                moodAlignment: ['energetic', 'confident', 'upbeat'],
                targetAudience: {
                    primaryGenres: this.GENRE_TIERS.PRIMARY,
                    similarArtists: [],
                    audienceSize: {
                        min: 10000,
                        max: 500000
                    }
                },
                promotionChannels: this.getPromotionChannels(currentMetrics, 'release')
            }
        };

        return this.enrichStrategyWithPromotionTargets(baseStrategy);
    }

    async generateDiscoverWeeklyStrategy(
        currentMetrics: SpotifyMetrics,
        streamQuality: StreamQualityMetrics
    ): Promise<PlaylistOptimizationStrategy> {
        const baseStrategy = {
            timing: {
                dayOfWeek: 'Sunday',
                timeOfDay: '20:00',
                timezone: 'UTC'
            },
            targetActions: {
                requiredSaves: Math.max(100, currentMetrics.saves * 1.5),
                requiredCompletePlays: Math.max(200, currentMetrics.totalStreams * 0.9),
                requiredPlaylistAdds: Math.max(40, currentMetrics.playlistAdds * 1.3)
            },
            contentStrategy: {
                idealDuration: 180,
                genreAlignment: [...this.GENRE_TIERS.PRIMARY, ...this.GENRE_TIERS.SECONDARY],
                moodAlignment: ['energetic', 'confident', 'upbeat'],
                targetAudience: {
                    primaryGenres: this.GENRE_TIERS.PRIMARY,
                    similarArtists: [],
                    audienceSize: {
                        min: 50000,
                        max: 1000000
                    }
                },
                promotionChannels: this.getPromotionChannels(currentMetrics, 'discover')
            }
        };

        return this.enrichStrategyWithPromotionTargets(baseStrategy);
    }

    private getPromotionChannels(metrics: SpotifyMetrics, type: 'release' | 'discover') {
        const channels = [];
        const popularityThreshold = type === 'release' ? 20 : 30;
        
        // Filter communities based on current popularity and genre match
        const relevantCommunities = this.PROMOTION_TARGETS.COMMUNITIES.filter(community => 
            metrics.popularityScore >= popularityThreshold * 0.75 &&
            community.genre.some(g => this.GENRE_TIERS.PRIMARY.includes(g))
        );

        // Add relevant communities
        channels.push(...relevantCommunities.map(community => ({
            type: 'community' as const,
            name: community.name,
            platform: community.platform,
            audienceMatch: 0.8,
            engagementRate: 0.05,
            submissionType: community.submissionType || 'direct'
        })));

        // Add curated influencers
        const relevantInfluencers = this.PROMOTION_TARGETS.INFLUENCERS.filter(influencer =>
            metrics.popularityScore >= popularityThreshold * 0.6 &&
            influencer.genre.some(g => this.GENRE_TIERS.PRIMARY.includes(g))
        );

        channels.push(...relevantInfluencers.map(influencer => ({
            type: 'influencer' as const,
            name: `${influencer.type}_${influencer.platform}`,
            platform: influencer.platform,
            audienceMatch: 0.75,
            engagementRate: 0.03
        })));

        // Add relevant streamers
        const relevantStreamers = this.PROMOTION_TARGETS.STREAMERS.filter(streamer =>
            metrics.popularityScore >= popularityThreshold * 0.5 &&
            streamer.genre.some(g => this.GENRE_TIERS.PRIMARY.includes(g))
        );

        channels.push(...relevantStreamers.map(streamer => ({
            type: 'streamer' as const,
            name: streamer.name,
            platform: streamer.platform,
            audienceMatch: 0.7,
            engagementRate: 0.04,
            submissionType: streamer.submissionType,
            submissionWindow: streamer.submissionWindow,
            averageViewers: streamer.averageViewers
        })));

        return channels;
    }

    private enrichStrategyWithPromotionTargets(strategy: PlaylistOptimizationStrategy): PlaylistOptimizationStrategy {
        // Add payment and engagement tracking
        strategy.contentStrategy.promotionChannels = strategy.contentStrategy.promotionChannels.map(channel => ({
            ...channel,
            paymentDetails: {
                type: 'trading_fee',
                percentage: channel.type === 'community' ? 0.05 : channel.type === 'influencer' ? 0.03 : 0.04,
                minEngagement: channel.type === 'community' ? 1000 : channel.type === 'influencer' ? 500 : 200
            }
        }));

        return strategy;
    }

    async optimizeStreamQuality(
        currentQuality: StreamQualityMetrics
    ): Promise<{
        recommendedActions: string[];
        targetMetrics: StreamQualityMetrics;
    }> {
        const targetSkipRate = Math.max(0.2, currentQuality.skipRate * 0.8);
        const targetCompletionRate = Math.min(0.95, currentQuality.completionRate * 1.2);

        return {
            recommendedActions: [
                'Optimize song intro to hook listeners in first 30 seconds',
                'Create compelling bridge sections to maintain engagement',
                'Ensure consistent audio quality throughout the track',
                'Add engaging elements every 20-30 seconds'
            ],
            targetMetrics: {
                skipRate: targetSkipRate,
                completionRate: targetCompletionRate,
                repeatListenRate: Math.min(0.4, currentQuality.repeatListenRate * 1.25),
                playlistRetentionRate: Math.min(0.8, currentQuality.playlistRetentionRate * 1.15)
            }
        };
    }

    async calculatePromotionWindow(
        targetPlaylist: 'RELEASE_RADAR' | 'DISCOVER_WEEKLY',
        currentPopularity: number
    ): Promise<{
        daysUntilUpdate: number;
        requiredDailyGrowth: number;
        recommendedStartDate: Date;
    }> {
        const today = new Date();
        const targetDay = this.UPDATE_DAYS[targetPlaylist];
        const daysUntilUpdate = this.calculateDaysUntil(targetDay);
        
        const targetPopularity = targetPlaylist === 'RELEASE_RADAR' ? 20 : 30;
        const requiredGrowth = Math.max(0, targetPopularity - currentPopularity);
        
        return {
            daysUntilUpdate,
            requiredDailyGrowth: requiredGrowth / Math.max(1, daysUntilUpdate),
            recommendedStartDate: new Date(today.getTime() - (24 * 60 * 60 * 1000)) // Start 1 day before
        };
    }

    private calculateDaysUntil(targetDay: string): number {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date().getDay();
        const target = days.indexOf(targetDay);
        
        let daysUntil = target - today;
        if (daysUntil <= 0) {
            daysUntil += 7;
        }
        
        return daysUntil;
    }

    async generateWeeklyPromotionPlan(
        currentMetrics: SpotifyMetrics,
        streamQuality: StreamQualityMetrics
    ): Promise<{
        dailyActions: Array<{
            day: string;
            actions: string[];
            targetMetrics: Partial<SpotifyMetrics>;
        }>;
    }> {
        // Generate a day-by-day promotion plan
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dailyActions = days.map(day => ({
            day,
            actions: this.getDailyActions(day, currentMetrics),
            targetMetrics: this.getDailyTargets(day, currentMetrics)
        }));

        return { dailyActions };
    }

    private getDailyActions(day: string, metrics: SpotifyMetrics): string[] {
        const baseActions = [
            'Share track on social media',
            'Engage with playlist curators',
            'Respond to listener comments'
        ];

        switch (day) {
            case 'Monday':
                return [...baseActions, 'Analyze weekend performance', 'Plan week\'s content'];
            case 'Friday':
                return [...baseActions, 'Release new content', 'Launch weekend promotion'];
            default:
                return baseActions;
        }
    }

    private getDailyTargets(day: string, metrics: SpotifyMetrics): Partial<SpotifyMetrics> {
        const multiplier = day === 'Friday' || day === 'Saturday' ? 1.5 : 1.0;
        
        return {
            recentStreams: Math.ceil(metrics.recentStreams * 0.15 * multiplier),
            saves: Math.ceil(metrics.saves * 0.15 * multiplier),
            playlistAdds: Math.ceil(metrics.playlistAdds * 0.15 * multiplier)
        };
    }
} 