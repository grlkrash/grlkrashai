import { EventEmitter } from 'events';
import { ethers } from 'ethers';

interface RewardAction {
    type: 'engagement' | 'creation' | 'promotion' | 'holding';
    points: number;
    requirements: {
        minHolding?: number;
        duration?: number;
        activity?: string[];
    };
}

interface UserMetrics {
    holding: number;
    holdingDuration: number;
    completedActivities: string[];
    engagementScore: number;
}

export class CommunityRewardsManager extends EventEmitter {
    private readonly REWARD_ACTIONS: Record<string, RewardAction> = {
        contentCreation: {
            type: 'creation',
            points: 100,
            requirements: {
                minHolding: 1000,
                activity: ['original_content', 'remix', 'cover']
            }
        },
        communityEngagement: {
            type: 'engagement',
            points: 50,
            requirements: {
                minHolding: 100,
                activity: ['comment', 'share', 'like']
            }
        },
        promotionParticipation: {
            type: 'promotion',
            points: 75,
            requirements: {
                minHolding: 500,
                activity: ['challenge_participation', 'content_sharing']
            }
        },
        longTermHolding: {
            type: 'holding',
            points: 200,
            requirements: {
                minHolding: 5000,
                duration: 30 // days
            }
        }
    };

    private readonly POINT_TO_TOKEN_RATIO = 10; // 10 points = 1 TOKEN
    private userPoints: Map<string, number>;
    private userMetrics: Map<string, UserMetrics>;

    constructor() {
        super();
        this.userPoints = new Map();
        this.userMetrics = new Map();
    }

    async calculateRewards(
        address: string,
        actions: string[],
        metrics: UserMetrics
    ): Promise<number> {
        let totalPoints = 0;

        // Store user metrics for future reference
        this.userMetrics.set(address, metrics);

        for (const action of actions) {
            const rewardAction = this.REWARD_ACTIONS[action];
            if (this.isEligible(metrics, rewardAction.requirements)) {
                totalPoints += rewardAction.points;
                
                // Emit reward event
                this.emit('rewardEarned', {
                    address,
                    action,
                    points: rewardAction.points
                });
            }
        }

        // Update user's total points
        const currentPoints = this.userPoints.get(address) || 0;
        this.userPoints.set(address, currentPoints + totalPoints);

        return this.convertPointsToTokens(totalPoints);
    }

    private isEligible(
        metrics: UserMetrics,
        requirements: RewardAction['requirements']
    ): boolean {
        if (!requirements) return true;

        return (
            metrics.holding >= (requirements.minHolding || 0) &&
            metrics.holdingDuration >= (requirements.duration || 0) &&
            (!requirements.activity || this.hasCompletedActivities(metrics, requirements.activity))
        );
    }

    private hasCompletedActivities(metrics: UserMetrics, requiredActivities: string[]): boolean {
        return requiredActivities.every(activity =>
            metrics.completedActivities.includes(activity)
        );
    }

    private convertPointsToTokens(points: number): number {
        return Math.floor(points / this.POINT_TO_TOKEN_RATIO);
    }

    async getUserPoints(address: string): Promise<number> {
        return this.userPoints.get(address) || 0;
    }

    async getUserLevel(address: string): Promise<{
        level: number;
        title: string;
        nextLevelPoints: number;
    }> {
        const points = await this.getUserPoints(address);
        const level = Math.floor(points / 1000) + 1;
        
        return {
            level,
            title: this.getLevelTitle(level),
            nextLevelPoints: (level * 1000) - points
        };
    }

    private getLevelTitle(level: number): string {
        if (level >= 10) return 'Legend';
        if (level >= 7) return 'Master';
        if (level >= 5) return 'Expert';
        if (level >= 3) return 'Enthusiast';
        return 'Beginner';
    }

    async getLeaderboard(timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<{
        address: string;
        points: number;
        level: number;
    }[]> {
        return Array.from(this.userPoints.entries())
            .map(([address, points]) => ({
                address,
                points,
                level: Math.floor(points / 1000) + 1
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 10);
    }

    async distributeRewards(address: string, tokens: number): Promise<void> {
        try {
            // Emit distribution event
            this.emit('rewardsDistributed', {
                address,
                tokens,
                timestamp: new Date()
            });

            // Reset points after distribution
            const currentPoints = this.userPoints.get(address) || 0;
            const remainingPoints = currentPoints - (tokens * this.POINT_TO_TOKEN_RATIO);
            this.userPoints.set(address, remainingPoints);

        } catch (error) {
            console.error('Error distributing rewards:', error);
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        this.userPoints.clear();
        this.userMetrics.clear();
        this.removeAllListeners();
    }
} 