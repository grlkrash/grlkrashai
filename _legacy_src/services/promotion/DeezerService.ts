import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';

export interface DeezerTrackMetrics {
    plays: number;
    favorites: number;
    playlists: number;
    shares: number;
    comments: number;
    averageCompletion: number;
    skipRate: number;
    regions: { [key: string]: number };
    popularityScore: number;
    recentPlays: number; // Last 7 days
    genreMatch: number;
    audienceRetention: number;
    viralCoefficient: number;
}

export interface DeezerPlaylistMetrics {
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

export interface DeezerReleaseMetadata {
    title: string;
    artist: string;
    album?: string;
    genre: string[];
    isrc?: string;
    releaseDate: Date;
    artwork?: string;
    explicit: boolean;
    language: string;
    bpm?: number;
    key?: string;
    contributors?: {
        role: string;
        name: string;
    }[];
    lyrics?: {
        text: string;
        language: string;
        timestamped?: boolean;
    };
}

export class DeezerService extends EventEmitter {
    private runtime: IAgentRuntime;
    private apiKey: string;
    private accessToken: string;
    private releaseMetrics: Map<string, DeezerTrackMetrics>;
    private playlistCache: Map<string, DeezerPlaylistMetrics>;
    private qualityCache: Map<string, StreamQualityMetrics>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly API_BASE_URL = 'https://api.deezer.com';

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
        apiKey: string;
        accessToken: string;
    }): Promise<void> {
        this.apiKey = credentials.apiKey;
        this.accessToken = credentials.accessToken;
    }

    async uploadTrack(
        audioPath: string,
        metadata: DeezerReleaseMetadata
    ): Promise<string> {
        try {
            // Validate ISRC and essential metadata
            this.validateMetadata(metadata);

            // Create track metadata
            const response = await fetch(`${this.API_BASE_URL}/track/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: metadata.title,
                    artist: metadata.artist,
                    album: metadata.album,
                    isrc: metadata.isrc,
                    release_date: metadata.releaseDate.toISOString().split('T')[0],
                    explicit_lyrics: metadata.explicit,
                    language: metadata.language,
                    bpm: metadata.bpm,
                    key: metadata.key,
                    contributors: metadata.contributors,
                    lyrics: metadata.lyrics
                })
            });

            const result = await response.json();
            const trackId = result.id;

            // Upload audio file
            await this.uploadAudioFile(trackId, audioPath);

            // Upload artwork if provided
            if (metadata.artwork) {
                await this.uploadArtwork(trackId, metadata.artwork);
            }

            // Initialize tracking
            await this.initializeTrackTracking(trackId);

            return trackId;
        } catch (error) {
            console.error('Error uploading track to Deezer:', error);
            throw error;
        }
    }

    private async uploadAudioFile(trackId: string, audioPath: string): Promise<void> {
        // Implementation for uploading the audio file
        // This would use Deezer's upload endpoints
    }

    private async uploadArtwork(trackId: string, artworkPath: string): Promise<void> {
        // Implementation for uploading artwork
        // This would use Deezer's artwork upload endpoints
    }

    private validateMetadata(metadata: DeezerReleaseMetadata): void {
        if (!metadata.isrc) {
            throw new Error('ISRC code is required for Deezer distribution');
        }

        if (!metadata.genre || metadata.genre.length === 0) {
            throw new Error('At least one genre must be specified');
        }

        if (!metadata.releaseDate) {
            throw new Error('Release date is required');
        }
    }

    async getTrackMetrics(trackId: string): Promise<DeezerTrackMetrics> {
        try {
            const response = await fetch(`${this.API_BASE_URL}/track/${trackId}/stats`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = await response.json();

            return {
                plays: data.plays || 0,
                favorites: data.favorites || 0,
                playlists: data.playlists || 0,
                shares: data.shares || 0,
                comments: data.comments || 0,
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
            console.error('Failed to fetch Deezer track metrics:', error);
            throw error;
        }
    }

    private async initializeTrackTracking(trackId: string): Promise<void> {
        try {
            const initialMetrics: DeezerTrackMetrics = {
                plays: 0,
                favorites: 0,
                playlists: 0,
                shares: 0,
                comments: 0,
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