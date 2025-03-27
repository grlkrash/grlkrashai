import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { TikTokOptimizer } from './TikTokOptimizer';

export interface TikTokUploadMetadata {
    title: string;
    description?: string;
    audioTrack?: string;
    hashtags: string[];
    privacyLevel: 'public' | 'friends' | 'private';
    allowComments: boolean;
    allowDuets: boolean;
    allowStitch: boolean;
    scheduleTime?: Date;
    isCommercial: boolean;
    language: string;
    location?: {
        latitude: number;
        longitude: number;
        placeName: string;
    };
}

export interface TikTokVideoMetrics {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    duets: number;
    stitches: number;
    watchTime: number;
    completionRate: number;
    engagementRate: number;
    soundUsage: number;
    trendingScore: number;
    fypDistribution: number;
    followersGained: number;
}

export class TikTokContentService extends EventEmitter {
    private runtime: IAgentRuntime;
    private accessToken: string;
    private optimizer: TikTokOptimizer;
    private readonly API_BASE_URL = 'https://open.tiktokapis.com/v2';

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.optimizer = new TikTokOptimizer(runtime);
    }

    async initialize(credentials: {
        accessToken: string;
    }): Promise<void> {
        this.accessToken = credentials.accessToken;
        await this.optimizer.initialize();
    }

    async uploadVideo(
        videoPath: string,
        metadata: TikTokUploadMetadata,
        optimizationOptions?: {
            targetAudience?: string[];
            contentType?: string;
            musicGenre?: string;
            trendingTopics?: boolean;
        }
    ): Promise<string> {
        try {
            // Apply platform-specific optimizations
            const optimizedMetadata = await this.optimizer.optimizeContent(metadata, optimizationOptions);
            
            // Create upload session
            const session = await this.createUploadSession(videoPath);

            // Upload video chunks
            await this.uploadVideoChunks(session.uploadId, videoPath);

            // Publish video with optimized metadata
            const response = await fetch(`${this.API_BASE_URL}/video/publish`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    upload_id: session.uploadId,
                    title: optimizedMetadata.title,
                    description: optimizedMetadata.description,
                    privacy_level: optimizedMetadata.privacyLevel,
                    disable_comments: !optimizedMetadata.allowComments,
                    disable_duet: !optimizedMetadata.allowDuets,
                    disable_stitch: !optimizedMetadata.allowStitch,
                    schedule_time: optimizedMetadata.scheduleTime?.toISOString(),
                    brand_content_toggle: optimizedMetadata.isCommercial,
                    language: optimizedMetadata.language,
                    hashtag_names: optimizedMetadata.hashtags
                })
            });

            const result = await response.json();
            const videoId = result.data.video_id;

            this.emit('uploadComplete', { videoId, metadata: optimizedMetadata });
            return videoId;

        } catch (error) {
            console.error('Error uploading video to TikTok:', error);
            this.emit('uploadError', { error, metadata });
            throw error;
        }
    }

    private async createUploadSession(videoPath: string): Promise<{ uploadId: string }> {
        const stats = await this.runtime.stat(videoPath);
        
        const response = await fetch(`${this.API_BASE_URL}/video/upload/init`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: 'FILE',
                file_size: stats.size
            })
        });

        return response.json();
    }

    private async uploadVideoChunks(uploadId: string, videoPath: string): Promise<void> {
        // Implementation for chunked upload
        // This would handle large file uploads in segments
    }

    async getVideoMetrics(videoId: string): Promise<TikTokVideoMetrics> {
        try {
            const response = await fetch(`${this.API_BASE_URL}/video/metrics`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = await response.json();

            return {
                views: data.views || 0,
                likes: data.likes || 0,
                comments: data.comments || 0,
                shares: data.shares || 0,
                saves: data.saves || 0,
                duets: data.duets || 0,
                stitches: data.stitches || 0,
                watchTime: data.watch_time || 0,
                completionRate: data.completion_rate || 0,
                engagementRate: data.engagement_rate || 0,
                soundUsage: data.sound_usage || 0,
                trendingScore: data.trending_score || 0,
                fypDistribution: data.fyp_distribution || 0,
                followersGained: data.followers_gained || 0
            };
        } catch (error) {
            console.error('Failed to fetch TikTok metrics:', error);
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        this.removeAllListeners();
        await this.optimizer.cleanup();
    }
} 