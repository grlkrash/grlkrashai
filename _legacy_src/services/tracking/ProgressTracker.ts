import { EventEmitter } from 'events';
import { IAgentRuntime } from '@elizaos/core';

interface ProgressEvent {
    userId: string;
    type: string;
    timestamp: Date;
    metadata: Record<string, any>;
}

interface UserProgress {
    userId: string;
    activities: {
        type: string;
        count: number;
        lastUpdated: Date;
        history: ProgressEvent[];
    }[];
    totalPoints: number;
    level: number;
    achievements: string[];
    lastActive: Date;
}

export class ProgressTracker extends EventEmitter {
    private userProgress: Map<string, UserProgress> = new Map();
    private activityPoints: Map<string, number> = new Map();

    constructor(private runtime: IAgentRuntime) {
        super();
        this.initializeActivityPoints();
    }

    private initializeActivityPoints(): void {
        // Base points for different activities
        this.activityPoints.set('post', 10);
        this.activityPoints.set('comment', 5);
        this.activityPoints.set('share', 15);
        this.activityPoints.set('react', 2);
        this.activityPoints.set('challenge_complete', 100);
        this.activityPoints.set('daily_login', 5);
    }

    async trackActivity(
        userId: string,
        type: string,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        const event: ProgressEvent = {
            userId,
            type,
            timestamp: new Date(),
            metadata
        };

        let progress = this.userProgress.get(userId);
        if (!progress) {
            progress = this.initializeUserProgress(userId);
        }

        // Update activity count and history
        const activity = progress.activities.find(a => a.type === type);
        if (activity) {
            activity.count++;
            activity.lastUpdated = event.timestamp;
            activity.history.push(event);
        } else {
            progress.activities.push({
                type,
                count: 1,
                lastUpdated: event.timestamp,
                history: [event]
            });
        }

        // Update points
        const points = this.activityPoints.get(type) || 0;
        progress.totalPoints += points;

        // Update level
        progress.level = this.calculateLevel(progress.totalPoints);
        progress.lastActive = event.timestamp;

        // Check for achievements
        await this.checkAchievements(progress);

        this.userProgress.set(userId, progress);
        this.emit('progress_updated', { userId, type, points });
    }

    private initializeUserProgress(userId: string): UserProgress {
        return {
            userId,
            activities: [],
            totalPoints: 0,
            level: 1,
            achievements: [],
            lastActive: new Date()
        };
    }

    private calculateLevel(points: number): number {
        // Level calculation formula: level = floor(sqrt(points/100)) + 1
        return Math.floor(Math.sqrt(points / 100)) + 1;
    }

    private async checkAchievements(progress: UserProgress): Promise<void> {
        const newAchievements: string[] = [];

        // Check activity-based achievements
        for (const activity of progress.activities) {
            switch (activity.type) {
                case 'post':
                    if (activity.count >= 100 && !progress.achievements.includes('prolific_poster')) {
                        newAchievements.push('prolific_poster');
                    }
                    break;
                case 'share':
                    if (activity.count >= 50 && !progress.achievements.includes('community_advocate')) {
                        newAchievements.push('community_advocate');
                    }
                    break;
                // Add more achievement conditions
            }
        }

        // Check point-based achievements
        if (progress.totalPoints >= 10000 && !progress.achievements.includes('power_user')) {
            newAchievements.push('power_user');
        }

        // Add new achievements
        if (newAchievements.length > 0) {
            progress.achievements.push(...newAchievements);
            this.emit('achievements_earned', { userId: progress.userId, achievements: newAchievements });
        }
    }

    getUserProgress(userId: string): UserProgress | undefined {
        return this.userProgress.get(userId);
    }

    getActivityHistory(
        userId: string,
        type?: string,
        startDate?: Date,
        endDate?: Date
    ): ProgressEvent[] {
        const progress = this.userProgress.get(userId);
        if (!progress) return [];

        let events: ProgressEvent[] = [];
        progress.activities.forEach(activity => {
            if (!type || activity.type === type) {
                events.push(...activity.history);
            }
        });

        // Apply date filters
        if (startDate || endDate) {
            events = events.filter(event => {
                const timestamp = event.timestamp.getTime();
                return (!startDate || timestamp >= startDate.getTime()) &&
                       (!endDate || timestamp <= endDate.getTime());
            });
        }

        return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getLeaderboard(
        type: string,
        limit: number = 10,
        timeframe?: { start: Date; end: Date }
    ): { userId: string; score: number }[] {
        const scores = Array.from(this.userProgress.values())
            .map(progress => {
                let score = 0;
                const activity = progress.activities.find(a => a.type === type);
                
                if (activity) {
                    if (timeframe) {
                        score = activity.history.filter(event => 
                            event.timestamp >= timeframe.start &&
                            event.timestamp <= timeframe.end
                        ).length;
                    } else {
                        score = activity.count;
                    }
                }

                return { userId: progress.userId, score };
            })
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return scores;
    }

    async cleanup(): Promise<void> {
        this.userProgress.clear();
        this.activityPoints.clear();
        this.removeAllListeners();
    }
} 