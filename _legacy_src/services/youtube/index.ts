export * from './YouTubeService';
export * from './YouTubeMusicPromotion';
export * from './YouTubeContentService';
export * from './YouTubeAnalyticsService';

// Re-export common types
export interface YouTubeVideoMetrics {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    watchTime: number;
    retentionRate: number;
}

export interface YouTubeCampaignMetrics {
    totalViews: number;
    averageRetention: number;
    subscriberGain: number;
    topTrafficSources: string[];
    audienceRetention: {
        timeStamp: number;
        retentionPercentage: number;
    }[];
}

export interface YouTubeUploadMetadata {
    title: string;
    description: string;
    tags: string[];
    privacyStatus: 'private' | 'unlisted' | 'public';
    categoryId?: string;
    language?: string;
    playlist?: string;
    endScreen?: {
        type: 'video' | 'playlist' | 'subscribe';
        content: string;
    }[];
    cards?: {
        timestamp: number;
        type: 'video' | 'playlist';
        content: string;
    }[];
} 