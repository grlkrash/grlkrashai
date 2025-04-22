import { IAgentRuntime } from '@elizaos/core';
import SpotifyWebApi from 'spotify-web-api-node';
import { EventEmitter } from 'events';

export interface SpotifyTrackMetrics {
    streams: number;
    saves: number;
    playlistAdds: number;
    averageCompletion: number;
    skipRate: number;
    regions: { [key: string]: number };
    popularityScore: number;
    recentStreams: number; // Last 7 days
    genreMatch: number;
    audienceRetention: number;
    viralCoefficient: number;
}

export interface PlaylistMetrics {
    name: string;
    followers: number;
    monthlyListeners: number;
    genre: string[];
    averagePopularity: number;
    engagementRate: number;
    retentionRate: number;
    skipThreshold: number;
}

export interface StreamQualityMetrics {
    skipRate: number;
    completionRate: number;
    repeatListenRate: number;
    playlistRetentionRate: number;
    segmentAnalysis: {
        intro: { duration: number; retention: number };
        verses: { count: number; avgRetention: number };
        hooks: { count: number; avgRetention: number };
        bridge: { duration: number; retention: number };
        outro: { duration: number; retention: number };
    };
    listenerBehavior: {
        peakEngagementPoints: number[];
        dropoffPoints: number[];
        repeatSegments: number[];
    };
}

export interface SpotifyReleaseMetadata {
    title: string;
    artist: string;
    album?: string;
    genre: string[];
    isrc?: string;
    releaseDate: Date;
    artwork?: string;
    explicit: boolean;
    language: string;
    contributors?: {
        role: string;
        name: string;
    }[];
}

interface SpotifyMetrics {
    streams: number;
    saves: number;
    playlistAdds: number;
    skipRate: number;
    completionRate: number;
    popularityScore: number;
}

interface PlaylistOptimizationStrategy {
    targetPlaylists: string[];
    recommendedTracks: string[];
    timing: {
        bestDays: string[];
        bestHours: number[];
    };
    audienceMatch: number;
}

export class SpotifyService extends EventEmitter {
    private spotifyApi: SpotifyWebApi;
    private runtime: IAgentRuntime;
    private releaseMetrics: Map<string, SpotifyTrackMetrics>;
    private playlistCache: Map<string, PlaylistMetrics>;
    private qualityCache: Map<string, StreamQualityMetrics>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly RELEASE_RADAR_THRESHOLD = 1000;
    private readonly DISCOVER_WEEKLY_THRESHOLD = 5000;
    private readonly API_BASE_URL = 'https://api.spotify.com/v1';
    private trackMetrics: Map<string, SpotifyMetrics>;
    private optimizationStrategies: Map<string, PlaylistOptimizationStrategy>;

    private readonly QUALITY_THRESHOLDS = {
        SKIP_RATE: { good: 0.2, excellent: 0.15 },
        COMPLETION_RATE: { good: 0.85, excellent: 0.9 },
        REPEAT_LISTEN: { good: 0.3, excellent: 0.4 },
        RETENTION: { good: 0.75, excellent: 0.85 }
    };

    private readonly REQUIRED_SCOPES = [
        'ugc-image-upload',
        'playlist-modify-public',
        'playlist-modify-private',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-read-private',
        'user-read-email'
    ];

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.releaseMetrics = new Map();
        this.playlistCache = new Map();
        this.qualityCache = new Map();
        this.trackMetrics = new Map();
        this.optimizationStrategies = new Map();
    }

    async initialize(credentials: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    }): Promise<void> {
        this.spotifyApi = new SpotifyWebApi(credentials);
    }

    async uploadTrack(
        audioPath: string,
        metadata: SpotifyReleaseMetadata
    ): Promise<string> {
        try {
            // Validate ISRC and essential metadata
            this.validateMetadata(metadata);

            // Upload track to Spotify
            const response = await this.spotifyApi.uploadTrack({
                audioFile: this.runtime.createReadStream(audioPath),
                metadata: {
                    name: metadata.title,
                    artists: [{ name: metadata.artist }],
                    album: metadata.album || metadata.title,
                    genres: metadata.genre,
                    isrc: metadata.isrc,
                    release_date: metadata.releaseDate.toISOString().split('T')[0],
                    explicit: metadata.explicit,
                    language: metadata.language,
                    external_ids: {
                        isrc: metadata.isrc
                    }
                }
            });

            const trackId = response.body.id;

            // Upload artwork if provided
            if (metadata.artwork) {
                await this.spotifyApi.uploadArtwork(trackId, metadata.artwork);
            }

            // Initialize tracking
            await this.initializeTrackTracking(trackId);

            return trackId;
        } catch (error) {
            console.error('Error uploading track to Spotify:', error);
            throw error;
        }
    }

    private validateMetadata(metadata: SpotifyReleaseMetadata): void {
        if (!metadata.isrc) {
            throw new Error('ISRC code is required for Spotify distribution');
        }

        if (!metadata.genre || metadata.genre.length === 0) {
            throw new Error('At least one genre must be specified');
        }

        if (!metadata.releaseDate) {
            throw new Error('Release date is required');
        }
    }

    async getTrackMetrics(trackId: string): Promise<SpotifyTrackMetrics> {
        try {
            const [trackData, audioFeatures] = await Promise.all([
                this.fetchTrackData(trackId),
                this.fetchAudioFeatures(trackId)
            ]);

            const metrics = {
                streams: await this.fetchStreamCount(trackId),
                saves: await this.fetchSaveCount(trackId),
                playlistAdds: await this.fetchPlaylistCount(trackId),
                averageCompletion: 0, // Will be updated by quality analysis
                skipRate: 0, // Will be updated by quality analysis
                regions: {},
                popularityScore: trackData.popularity,
                recentStreams: 0, // Will be calculated
                genreMatch: 0, // Will be calculated
                audienceRetention: 0, // Will be calculated
                viralCoefficient: 0 // Will be calculated
            };

            // Get quality metrics
            const quality = await this.analyzeStreamQuality(trackId);
            metrics.averageCompletion = quality.completionRate;
            metrics.skipRate = quality.skipRate;

            return metrics;
        } catch (error) {
            console.error('Failed to fetch track metrics:', error);
            throw error;
        }
    }

    async analyzeStreamQuality(trackId: string): Promise<StreamQualityMetrics> {
        // Check cache first
        const cached = this.qualityCache.get(trackId);
        if (cached) {
            return cached;
        }

        // Fetch audio features for segment analysis
        const audioFeatures = await this.fetchAudioFeatures(trackId);

        const quality: StreamQualityMetrics = {
            skipRate: 0,
            completionRate: 0,
            repeatListenRate: 0,
            playlistRetentionRate: 0,
            segmentAnalysis: {
                intro: { duration: 0, retention: 0 },
                verses: { count: 0, avgRetention: 0 },
                hooks: { count: 0, avgRetention: 0 },
                bridge: { duration: 0, retention: 0 },
                outro: { duration: 0, retention: 0 }
            },
            listenerBehavior: {
                peakEngagementPoints: [],
                dropoffPoints: [],
                repeatSegments: []
            }
        };

        // Cache the results
        this.qualityCache.set(trackId, quality);
        return quality;
    }

    async optimizeStreamQuality(trackId: string): Promise<{
        currentQuality: StreamQualityMetrics;
        recommendations: {
            priority: 'high' | 'medium' | 'low';
            aspect: string;
            suggestion: string;
            expectedImpact: number;
        }[];
        potentialScore: number;
    }> {
        const quality = await this.analyzeStreamQuality(trackId);
        const recommendations = [];

        // Analyze intro retention
        if (quality.segmentAnalysis.intro.retention < this.QUALITY_THRESHOLDS.RETENTION.good) {
            recommendations.push({
                priority: 'high',
                aspect: 'intro',
                suggestion: 'Consider shortening intro or adding a hook within first 7 seconds',
                expectedImpact: 0.15
            });
        }

        // Add more recommendations based on other metrics...

        return {
            currentQuality: quality,
            recommendations: this.prioritizeRecommendations(recommendations),
            potentialScore: this.calculatePotentialScore(quality, recommendations)
        };
    }

    private prioritizeRecommendations(recommendations: any[]): any[] {
        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    private calculatePotentialScore(quality: StreamQualityMetrics, recommendations: any[]): number {
        const currentScore = (
            (1 - quality.skipRate) * 0.3 +
            quality.completionRate * 0.4 +
            quality.repeatListenRate * 0.3
        ) * 100;

        const potentialImprovement = recommendations.reduce(
            (sum, rec) => sum + rec.expectedImpact,
            0
        );

        return Math.min(100, currentScore + (potentialImprovement * 100));
    }

    private async initializeTrackTracking(trackId: string): Promise<void> {
        // Initialize metrics
        this.releaseMetrics.set(trackId, {
            streams: 0,
            saves: 0,
            playlistAdds: 0,
            averageCompletion: 0,
            skipRate: 0,
            regions: {},
            popularityScore: 0,
            recentStreams: 0,
            genreMatch: 0,
            audienceRetention: 0,
            viralCoefficient: 0
        });

        // Set up periodic tracking
        const trackingInterval = setInterval(async () => {
            try {
                const metrics = await this.getTrackMetrics(trackId);
                this.updateTrackMetrics(trackId, metrics);

                // Emit metrics update
                this.emit('metricsUpdate', {
                    trackId,
                    metrics: this.releaseMetrics.get(trackId)
                });

                // Check for playlist opportunities
                await this.checkPlaylistOpportunities(trackId, metrics);
            } catch (error) {
                console.error('Error tracking Spotify metrics:', error);
            }
        }, 3600000); // Check every hour

        // Stop tracking after 90 days
        setTimeout(() => {
            clearInterval(trackingInterval);
            this.emit('trackingEnd', {
                trackId,
                finalMetrics: this.releaseMetrics.get(trackId)
            });
        }, 90 * 24 * 3600000);
    }

    private async getTrackAnalytics(trackId: string): Promise<any> {
        // Implement Spotify Analytics API calls
        // This requires additional permissions and setup
        return {};
    }

    private updateTrackMetrics(
        trackId: string,
        metrics: SpotifyTrackMetrics
    ): void {
        const currentMetrics = this.releaseMetrics.get(trackId);
        if (!currentMetrics) return;

        this.releaseMetrics.set(trackId, {
            ...currentMetrics,
            ...metrics
        });
    }

    private async checkPlaylistOpportunities(
        trackId: string,
        metrics: SpotifyTrackMetrics
    ): Promise<void> {
        // Check for playlist submission opportunities based on performance
        if (metrics.streams > 1000 && metrics.skipRate < 0.3) {
            const playlists = await this.findRelevantPlaylists(trackId);
            for (const playlist of playlists) {
                await this.submitToPlaylist(trackId, playlist.id);
            }
        }
    }

    private async findRelevantPlaylists(trackId: string): Promise<any[]> {
        // Implement playlist discovery logic
        return [];
    }

    private async submitToPlaylist(trackId: string, playlistId: string): Promise<void> {
        try {
            await this.spotifyApi.addTracksToPlaylist(playlistId, [`spotify:track:${trackId}`]);
        } catch (error) {
            console.error('Error submitting to playlist:', error);
        }
    }

    async cleanup(): Promise<void> {
        this.releaseMetrics.clear();
        this.playlistCache.clear();
        this.qualityCache.clear();
        this.removeAllListeners();
    }

    // Analytics Methods
    async getTrackMetrics(trackId: string): Promise<SpotifyTrackMetrics> {
        return this.releaseMetrics.get(trackId) || {
            streams: 0,
            saves: 0,
            playlistAdds: 0,
            averageCompletion: 0,
            skipRate: 0,
            regions: {},
            popularityScore: 0,
            recentStreams: 0,
            genreMatch: 0,
            audienceRetention: 0,
            viralCoefficient: 0
        };
    }

    async analyzeStreamQuality(trackId: string): Promise<{
        quality: number;
        factors: string[];
    }> {
        const metrics = await this.getTrackMetrics(trackId);
        if (!metrics) return { quality: 0, factors: [] };

        const factors: string[] = [];
        let quality = 0;

        if (metrics.completionRate > 0.8) {
            factors.push('High completion rate');
            quality += 0.4;
        }

        if (metrics.skipRate < 0.2) {
            factors.push('Low skip rate');
            quality += 0.3;
        }

        if (metrics.playlistAdds > 100) {
            factors.push('Strong playlist performance');
            quality += 0.3;
        }

        return { quality, factors };
    }

    // Optimization Methods
    async generateWeeklyPromotionPlan(
        metrics: SpotifyTrackMetrics,
        quality: { quality: number; factors: string[] }
    ): Promise<{
        dailyActions: Array<{
            day: string;
            actions: string[];
        }>;
    }> {
        const plan = {
            dailyActions: this.generateDailyActions(metrics, quality)
        };

        return plan;
    }

    async optimizeStreamQuality(trackId: string): Promise<{
        recommendations: string[];
        priority: 'high' | 'medium' | 'low';
    }> {
        const quality = await this.analyzeStreamQuality(trackId);
        const recommendations: string[] = [];
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (quality.quality < 0.5) {
            priority = 'high';
            recommendations.push(
                'Optimize track metadata',
                'Improve playlist targeting',
                'Analyze skip points'
            );
        } else if (quality.quality < 0.8) {
            priority = 'medium';
            recommendations.push(
                'Fine-tune playlist pitching',
                'Expand genre targeting'
            );
        } else {
            priority = 'low';
            recommendations.push(
                'Maintain current strategy',
                'Monitor for changes'
            );
        }

        return { recommendations, priority };
    }

    async calculatePromotionWindow(
        playlistType: string,
        currentPopularity: number
    ): Promise<{
        daysUntilUpdate: number;
        requiredDailyGrowth: number;
    }> {
        const targetPopularity = this.getTargetPopularity(playlistType);
        const daysUntilUpdate = this.calculateDaysUntilUpdate(currentPopularity, targetPopularity);
        const requiredDailyGrowth = (targetPopularity - currentPopularity) / daysUntilUpdate;

        return {
            daysUntilUpdate,
            requiredDailyGrowth
        };
    }

    private generateDailyActions(
        metrics: SpotifyTrackMetrics,
        quality: { quality: number; factors: string[] }
    ): Array<{ day: string; actions: string[] }> {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days.map(day => ({
            day,
            actions: this.getActionsForDay(day, metrics, quality)
        }));
    }

    private getActionsForDay(
        day: string,
        metrics: SpotifyTrackMetrics,
        quality: { quality: number; factors: string[] }
    ): string[] {
        const actions: string[] = [];

        // Base actions for all days
        actions.push('Monitor stream count');
        actions.push('Check playlist performance');

        // Day-specific actions
        switch (day) {
            case 'Monday':
                actions.push('Review weekly performance');
                actions.push('Update playlist pitching strategy');
                break;
            case 'Wednesday':
                actions.push('Analyze skip rates');
                actions.push('Optimize metadata if needed');
                break;
            case 'Friday':
                actions.push('Prepare weekend promotion strategy');
                actions.push('Review playlist adds');
                break;
        }

        // Quality-based actions
        if (quality.quality < 0.6) {
            actions.push('Implement quality improvement recommendations');
        }

        return actions;
    }

    private getTargetPopularity(playlistType: string): number {
        const targets = {
            'RELEASE_RADAR': 65,
            'DISCOVER_WEEKLY': 55,
            'FRESH_FINDS': 45
        };
        return targets[playlistType as keyof typeof targets] || 50;
    }

    private calculateDaysUntilUpdate(current: number, target: number): number {
        const difference = target - current;
        // Assume 1 point per day minimum, faster if difference is larger
        return Math.max(Math.ceil(difference / 2), 7);
    }
} 
