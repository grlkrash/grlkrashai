import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';

export interface SoundCloudTrackMetrics {
    plays: number;
    likes: number;
    reposts: number;
    comments: number;
    downloads: number;
    averageCompletion: number;
    skipRate: number;
    regions: { [key: string]: number };
    popularityScore: number;
    recentPlays: number; // Last 7 days
    genreMatch: number;
    audienceRetention: number;
    viralCoefficient: number;
}

export interface SoundCloudPlaylistMetrics {
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

export interface SoundCloudReleaseMetadata {
    title: string;
    artist: string;
    description?: string;
    genre: string[];
    isrc?: string;
    releaseDate: Date;
    artwork?: string;
    tags: string[];
    explicit: boolean;
    language: string;
    license?: string;
    downloadable?: boolean;
    contributors?: {
        role: string;
        name: string;
    }[];
}

export class SoundCloudService extends EventEmitter {
    private runtime: IAgentRuntime;
    private clientId: string;
    private clientSecret: string;
    private accessToken: string;
    private releaseMetrics: Map<string, SoundCloudTrackMetrics>;
    private playlistCache: Map<string, SoundCloudPlaylistMetrics>;
    private qualityCache: Map<string, StreamQualityMetrics>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly API_BASE_URL = 'https://api.soundcloud.com';

    private readonly QUALITY_THRESHOLDS = {
        SKIP_RATE: { good: 0.2, excellent: 0.15 },
        COMPLETION_RATE: { good: 0.85, excellent: 0.9 },
        REPEAT_LISTEN: { good: 0.3, excellent: 0.4 },
        RETENTION: { good: 0.75, excellent: 0.85 }
    };

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.releaseMetrics = new Map();
        this.playlistCache = new Map();
        this.qualityCache = new Map();
    }

    async initialize(credentials: {
        clientId: string;
        clientSecret: string;
    }): Promise<void> {
        this.clientId = credentials.clientId;
        this.clientSecret = credentials.clientSecret;
        await this.authenticate();
    }

    private async authenticate(): Promise<void> {
        try {
            const response = await fetch(`${this.API_BASE_URL}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials'
                })
            });

            const data = await response.json();
            this.accessToken = data.access_token;
        } catch (error) {
            console.error('Failed to authenticate with SoundCloud:', error);
            throw error;
        }
    }

    async uploadTrack(
        audioPath: string,
        metadata: SoundCloudReleaseMetadata
    ): Promise<string> {
        try {
            // Validate ISRC and essential metadata
            this.validateMetadata(metadata);

            // Create upload request
            const response = await fetch(`${this.API_BASE_URL}/tracks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: metadata.title,
                    description: metadata.description,
                    genre: metadata.genre[0],
                    tags: metadata.tags,
                    isrc: metadata.isrc,
                    release_date: metadata.releaseDate.toISOString(),
                    artwork_data: metadata.artwork,
                    downloadable: metadata.downloadable || false,
                    license: metadata.license || 'all-rights-reserved',
                    sharing: 'public',
                    embeddable_by: 'all'
                })
            });

            const result = await response.json();
            const trackId = result.id;

            // Upload the audio file
            await this.uploadAudioFile(trackId, audioPath);

            // Initialize tracking
            await this.initializeTrackTracking(trackId);

            return trackId;
        } catch (error) {
            console.error('Error uploading track to SoundCloud:', error);
            throw error;
        }
    }

    private async uploadAudioFile(trackId: string, audioPath: string): Promise<void> {
        // Implementation for uploading the actual audio file
        // This would use SoundCloud's upload endpoints
    }

    private validateMetadata(metadata: SoundCloudReleaseMetadata): void {
        if (!metadata.title) {
            throw new Error('Title is required');
        }

        if (!metadata.genre || metadata.genre.length === 0) {
            throw new Error('At least one genre must be specified');
        }

        if (!metadata.tags || metadata.tags.length === 0) {
            throw new Error('At least one tag must be specified');
        }
    }

    async getTrackMetrics(trackId: string): Promise<SoundCloudTrackMetrics> {
        try {
            const response = await fetch(`${this.API_BASE_URL}/tracks/${trackId}/stats`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = await response.json();

            return {
                plays: data.playback_count || 0,
                likes: data.likes_count || 0,
                reposts: data.reposts_count || 0,
                comments: data.comments_count || 0,
                downloads: data.download_count || 0,
                averageCompletion: data.average_completion || 0,
                skipRate: data.skip_rate || 0,
                regions: data.regions || {},
                popularityScore: data.popularity_score || 0,
                recentPlays: data.recent_plays || 0,
                genreMatch: data.genre_match || 0,
                audienceRetention: data.audience_retention || 0,
                viralCoefficient: data.viral_coefficient || 0
            };
        } catch (error) {
            console.error('Failed to fetch SoundCloud track metrics:', error);
            throw error;
        }
    }

    private async initializeTrackTracking(trackId: string): Promise<void> {
        try {
            const initialMetrics: SoundCloudTrackMetrics = {
                plays: 0,
                likes: 0,
                reposts: 0,
                comments: 0,
                downloads: 0,
                averageCompletion: 0,
                skipRate: 0,
                regions: {},
                popularityScore: 0,
                recentPlays: 0,
                genreMatch: 0,
                audienceRetention: 0,
                viralCoefficient: 0
            };

            this.releaseMetrics.set(trackId, initialMetrics);
            this.emit('trackInitialized', { trackId, metrics: initialMetrics });
        } catch (error) {
            console.error('Failed to initialize track tracking:', error);
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        this.releaseMetrics.clear();
        this.playlistCache.clear();
        this.qualityCache.clear();
    }
} 