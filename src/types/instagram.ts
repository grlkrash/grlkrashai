export interface InstagramPost {
    content: string;
    mediaUrls?: string[];
    caption: string;
    hashtags: string[];
    mentions: string[];
}

export interface InstagramAnalytics {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
}

export interface InstagramClient {
    post(content: InstagramPost): Promise<string>; // Returns post ID
    getAnalytics(postId: string): Promise<InstagramAnalytics>;
    schedulePost(content: InstagramPost, timing: Date): Promise<string>;
    deletePost(postId: string): Promise<void>;
} 