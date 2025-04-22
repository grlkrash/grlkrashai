import { IAgentRuntime } from '@elizaos/core';
import { google } from 'googleapis';
import { YouTubeAuthService } from './YouTubeAuthService';
import { YouTubeUploadMetadata, YouTubeVideoMetrics } from './index';
import { EventEmitter } from 'events';
import { YouTubeOptimizer } from './YouTubeOptimizer';

export interface YouTubeShortMetadata extends YouTubeUploadMetadata {
    isShort: true;
    soundtrackInfo?: {
        title: string;
        artist: string;
        license: string;
        timestamp?: {
            start: number;
            duration: number;
        };
    };
    verticalPresentation: {
        aspectRatio: '9:16';
        resolution: {
            width: number;
            height: number;
        };
    };
    chaptersTimestamp?: never; // Shorts don't support chapters
    endScreen?: never; // Shorts don't support end screens
}

export class YouTubeContentService extends EventEmitter {
    private youtube: any;
    private runtime: IAgentRuntime;
    private authService: YouTubeAuthService;
    private optimizer: YouTubeOptimizer;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.authService = YouTubeAuthService.getInstance(runtime);
        this.optimizer = new YouTubeOptimizer(runtime);
    }

    async initialize(): Promise<void> {
        this.youtube = google.youtube({
            version: 'v3',
            auth: this.authService.getOAuth2Client()
        });
        await this.optimizer.initialize();
    }

    async uploadVideo(
        videoPath: string,
        metadata: YouTubeUploadMetadata | YouTubeShortMetadata,
        onProgress?: (progress: number) => void
    ): Promise<string> {
        try {
            // Apply platform-specific optimizations
            const optimizedMetadata = await this.optimizer.optimizeContent(metadata);

            // Special handling for Shorts
            if ('isShort' in metadata && metadata.isShort) {
                return this.uploadShort(videoPath, metadata, onProgress);
            }

            const response = await this.youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: optimizedMetadata.title,
                        description: optimizedMetadata.description,
                        tags: optimizedMetadata.tags,
                        categoryId: optimizedMetadata.categoryId || '10', // Music category
                        defaultLanguage: optimizedMetadata.language || 'en'
                    },
                    status: {
                        privacyStatus: optimizedMetadata.privacyStatus,
                        selfDeclaredMadeForKids: false
                    }
                },
                media: {
                    body: this.runtime.createReadStream(videoPath)
                }
            });

            const videoId = response.data.id;

            // Add end screens if specified
            if (optimizedMetadata.endScreen) {
                await this.addEndScreens(videoId, optimizedMetadata.endScreen);
            }

            // Add cards if specified
            if (optimizedMetadata.cards) {
                await this.addCards(videoId, optimizedMetadata.cards);
            }

            // Add to playlist if specified
            if (optimizedMetadata.playlist) {
                await this.addToPlaylist(videoId, optimizedMetadata.playlist);
            }

            this.emit('uploadComplete', { videoId, metadata: optimizedMetadata });
            return videoId;

        } catch (error) {
            console.error('Error uploading video:', error);
            this.emit('uploadError', { error, metadata });
            throw error;
        }
    }

    private async uploadShort(
        videoPath: string,
        metadata: YouTubeShortMetadata,
        onProgress?: (progress: number) => void
    ): Promise<string> {
        try {
            // Validate Short-specific requirements
            this.validateShortRequirements(videoPath, metadata);

            // Apply Shorts-specific optimizations
            const optimizedMetadata = await this.optimizer.optimizeShort(metadata);

            const response = await this.youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: optimizedMetadata.title,
                        description: this.formatShortDescription(optimizedMetadata),
                        tags: [...optimizedMetadata.tags, '#Shorts'],
                        categoryId: optimizedMetadata.categoryId || '10',
                        defaultLanguage: optimizedMetadata.language || 'en'
                    },
                    status: {
                        privacyStatus: optimizedMetadata.privacyStatus,
                        selfDeclaredMadeForKids: false,
                        shortForm: true // Mark as Short
                    }
                },
                media: {
                    body: this.runtime.createReadStream(videoPath)
                }
            });

            const videoId = response.data.id;

            // Add music attribution if specified
            if (metadata.soundtrackInfo) {
                await this.addMusicAttribution(videoId, metadata.soundtrackInfo);
            }

            this.emit('shortUploadComplete', { videoId, metadata: optimizedMetadata });
            return videoId;

        } catch (error) {
            console.error('Error uploading Short:', error);
            this.emit('shortUploadError', { error, metadata });
            throw error;
        }
    }

    private validateShortRequirements(videoPath: string, metadata: YouTubeShortMetadata): void {
        // Implement validation for:
        // - Video duration (max 60 seconds)
        // - Vertical aspect ratio (9:16)
        // - Resolution requirements
        // - File size limits
    }

    private formatShortDescription(metadata: YouTubeShortMetadata): string {
        // Format description with:
        // - Music attribution
        // - Hashtags
        // - Call to action
        // - Links (if allowed)
        return '';
    }

    private async addMusicAttribution(
        videoId: string,
        soundtrackInfo: YouTubeShortMetadata['soundtrackInfo']
    ): Promise<void> {
        // Implement music attribution for Shorts
    }

    private async addEndScreens(
        videoId: string,
        endScreens: YouTubeUploadMetadata['endScreen']
    ): Promise<void> {
        if (!endScreens) return;
        
        try {
            await this.youtube.endScreens.insert({
                videoId,
                requestBody: {
                    items: endScreens.map(screen => ({
                        type: screen.type,
                        position: {
                            type: 'corner',
                            cornerPosition: 'topRight'
                        },
                        timing: {
                            type: 'video_end_time',
                            offsetMs: -20000 // 20 seconds before end
                        },
                        [screen.type]: {
                            resourceId: screen.content
                        }
                    }))
                }
            });
        } catch (error) {
            console.error('Failed to add end screens:', error);
            this.emit('endScreenError', { videoId, error });
        }
    }

    private async addCards(
        videoId: string,
        cards: YouTubeUploadMetadata['cards']
    ): Promise<void> {
        if (!cards) return;

        try {
            await this.youtube.cards.insert({
                part: 'snippet',
                videoId,
                requestBody: {
                    items: cards.map(card => ({
                        snippet: {
                            type: card.type,
                            timing: {
                                startMs: card.timestamp
                            },
                            [card.type]: {
                                resourceId: card.content
                            }
                        }
                    }))
                }
            });
        } catch (error) {
            console.error('Failed to add cards:', error);
            this.emit('cardsError', { videoId, error });
        }
    }

    private async addToPlaylist(videoId: string, playlistId: string): Promise<void> {
        try {
            await this.youtube.playlistItems.insert({
                part: 'snippet',
                requestBody: {
                    snippet: {
                        playlistId,
                        resourceId: {
                            kind: 'youtube#video',
                            videoId
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to add to playlist:', error);
            this.emit('playlistError', { videoId, playlistId, error });
        }
    }

    async updateVideoMetadata(
        videoId: string,
        metadata: Partial<YouTubeUploadMetadata>
    ): Promise<void> {
        try {
            await this.youtube.videos.update({
                part: 'snippet,status',
                requestBody: {
                    id: videoId,
                    snippet: {
                        title: metadata.title,
                        description: metadata.description,
                        tags: metadata.tags,
                        categoryId: metadata.categoryId,
                        defaultLanguage: metadata.language
                    },
                    status: metadata.privacyStatus ? {
                        privacyStatus: metadata.privacyStatus
                    } : undefined
                }
            });

            this.emit('metadataUpdateComplete', { videoId, metadata });
        } catch (error) {
            console.error('Error updating video metadata:', error);
            this.emit('metadataUpdateError', { videoId, error });
            throw error;
        }
    }

    async getVideoMetrics(videoId: string): Promise<YouTubeVideoMetrics> {
        try {
            const response = await this.youtube.videos.list({
                part: 'statistics,contentDetails',
                id: videoId
            });

            const video = response.data.items[0];
            const metrics = {
                views: parseInt(video.statistics.viewCount) || 0,
                likes: parseInt(video.statistics.likeCount) || 0,
                comments: parseInt(video.statistics.commentCount) || 0,
                shares: 0, // YouTube API doesn't provide share count directly
                watchTime: 0, // Requires YouTube Analytics API
                retentionRate: 0 // Requires YouTube Analytics API
            };

            this.emit('metricsUpdate', { videoId, metrics });
            return metrics;
        } catch (error) {
            console.error('Error fetching video metrics:', error);
            this.emit('metricsError', { videoId, error });
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        this.removeAllListeners();
        await this.optimizer.cleanup();
    }
} 