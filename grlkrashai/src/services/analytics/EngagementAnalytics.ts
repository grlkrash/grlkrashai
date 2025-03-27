import { EventEmitter } from 'events';
import { IAgentRuntime } from '@elizaos/core';

interface EngagementMetrics {
    activeUsers: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    challengeMetrics: {
        activeParticipants: number;
        completionRate: number;
        averageTimeToComplete: number;
    };
    contentMetrics: {
        totalPosts: number;
        totalComments: number;
        totalShares: number;
        averageEngagementRate: number;
    };
    rewardMetrics: {
        totalPointsAwarded: number;
        totalTokensDistributed: number;
        totalBadgesAwarded: number;
    };
}

interface TimeSeriesData {
    timestamp: Date;
    value: number;
}

export class EngagementAnalytics extends EventEmitter {
    private metrics: Map<string, TimeSeriesData[]> = new Map();
    private readonly RETENTION_DAYS = 90; // Keep 90 days of data

    constructor(private runtime: IAgentRuntime) {
        super();
        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        // Initialize all metric types
        const metricTypes = [
            'daily_active_users',
            'weekly_active_users',
            'monthly_active_users',
            'challenge_participants',
            'challenge_completions',
            'posts',
            'comments',
            'shares',
            'points_awarded',
            'tokens_distributed',
            'badges_awarded'
        ];

        metricTypes.forEach(type => {
            this.metrics.set(type, []);
        });
    }

    async trackMetric(type: string, value: number): Promise<void> {
        const data: TimeSeriesData = {
            timestamp: new Date(),
            value
        };

        let timeSeriesData = this.metrics.get(type) || [];
        timeSeriesData.push(data);

        // Clean up old data
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
        timeSeriesData = timeSeriesData.filter(d => d.timestamp >= cutoffDate);

        this.metrics.set(type, timeSeriesData);
        this.emit('metric_updated', { type, data });
    }

    getEngagementMetrics(timeframe?: { start: Date; end: Date }): EngagementMetrics {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        return {
            activeUsers: {
                daily: this.calculateUniqueUsers('daily_active_users', dayAgo, now),
                weekly: this.calculateUniqueUsers('weekly_active_users', weekAgo, now),
                monthly: this.calculateUniqueUsers('monthly_active_users', monthAgo, now)
            },
            challengeMetrics: {
                activeParticipants: this.getLatestValue('challenge_participants'),
                completionRate: this.calculateCompletionRate(timeframe),
                averageTimeToComplete: this.calculateAverageTimeToComplete(timeframe)
            },
            contentMetrics: {
                totalPosts: this.sumMetric('posts', timeframe),
                totalComments: this.sumMetric('comments', timeframe),
                totalShares: this.sumMetric('shares', timeframe),
                averageEngagementRate: this.calculateEngagementRate(timeframe)
            },
            rewardMetrics: {
                totalPointsAwarded: this.sumMetric('points_awarded', timeframe),
                totalTokensDistributed: this.sumMetric('tokens_distributed', timeframe),
                totalBadgesAwarded: this.sumMetric('badges_awarded', timeframe)
            }
        };
    }

    private calculateUniqueUsers(type: string, start: Date, end: Date): number {
        const data = this.metrics.get(type) || [];
        return data.filter(d => d.timestamp >= start && d.timestamp <= end)
            .reduce((max, current) => Math.max(max, current.value), 0);
    }

    private getLatestValue(type: string): number {
        const data = this.metrics.get(type) || [];
        return data.length > 0 ? data[data.length - 1].value : 0;
    }

    private calculateCompletionRate(timeframe?: { start: Date; end: Date }): number {
        const participants = this.sumMetric('challenge_participants', timeframe);
        const completions = this.sumMetric('challenge_completions', timeframe);
        return participants > 0 ? (completions / participants) * 100 : 0;
    }

    private calculateAverageTimeToComplete(timeframe?: { start: Date; end: Date }): number {
        // Implementation would depend on how we track individual completion times
        return 0; // Placeholder
    }

    private calculateEngagementRate(timeframe?: { start: Date; end: Date }): number {
        const posts = this.sumMetric('posts', timeframe);
        const comments = this.sumMetric('comments', timeframe);
        const shares = this.sumMetric('shares', timeframe);
        const totalActions = posts + comments + shares;
        const activeUsers = this.getLatestValue('monthly_active_users');
        return activeUsers > 0 ? (totalActions / activeUsers) * 100 : 0;
    }

    private sumMetric(type: string, timeframe?: { start: Date; end: Date }): number {
        const data = this.metrics.get(type) || [];
        if (!timeframe) {
            return data.reduce((sum, current) => sum + current.value, 0);
        }

        return data
            .filter(d => d.timestamp >= timeframe.start && d.timestamp <= timeframe.end)
            .reduce((sum, current) => sum + current.value, 0);
    }

    getMetricHistory(
        type: string,
        timeframe?: { start: Date; end: Date },
        interval: 'hour' | 'day' | 'week' | 'month' = 'day'
    ): TimeSeriesData[] {
        const data = this.metrics.get(type) || [];
        let filteredData = data;

        if (timeframe) {
            filteredData = data.filter(
                d => d.timestamp >= timeframe.start && d.timestamp <= timeframe.end
            );
        }

        return this.aggregateDataByInterval(filteredData, interval);
    }

    private aggregateDataByInterval(
        data: TimeSeriesData[],
        interval: 'hour' | 'day' | 'week' | 'month'
    ): TimeSeriesData[] {
        const aggregated = new Map<string, number>();

        data.forEach(d => {
            const key = this.getIntervalKey(d.timestamp, interval);
            aggregated.set(key, (aggregated.get(key) || 0) + d.value);
        });

        return Array.from(aggregated.entries())
            .map(([key, value]) => ({
                timestamp: new Date(key),
                value
            }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    private getIntervalKey(date: Date, interval: 'hour' | 'day' | 'week' | 'month'): string {
        const d = new Date(date);
        switch (interval) {
            case 'hour':
                d.setMinutes(0, 0, 0);
                break;
            case 'day':
                d.setHours(0, 0, 0, 0);
                break;
            case 'week':
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - d.getDay());
                break;
            case 'month':
                d.setHours(0, 0, 0, 0);
                d.setDate(1);
                break;
        }
        return d.toISOString();
    }

    async cleanup(): Promise<void> {
        this.metrics.clear();
        this.removeAllListeners();
    }
} 