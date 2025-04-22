import { EventEmitter } from 'events';
import { IAgentRuntime } from '@elizaos/core';
import { ContentTemplateManager } from '../content/ContentTemplates';
import { PromotionStrategyService } from '../optimization/OptimizationService';

interface Achievement {
    id: string;
    name: string;
    description: string;
    category: 'engagement' | 'challenges' | 'holding' | 'community';
    requirements: {
        type: string;
        threshold: number;
        timeframe?: {
            days: number;
        };
    }[];
    rewards: {
        points: number;
        badge?: {
            name: string;
            image: string;
            rarity: 'common' | 'rare' | 'epic' | 'legendary';
        };
    };
}

interface UserAchievement {
    userId: string;
    achievementId: string;
    earnedAt: Date;
    progress: {
        type: string;
        current: number;
        required: number;
    }[];
}

export class AchievementManager extends EventEmitter {
    private achievements: Map<string, Achievement> = new Map();
    private userAchievements: Map<string, UserAchievement[]> = new Map();

    constructor(
        private runtime: IAgentRuntime,
        private contentManager: ContentTemplateManager,
        private promotionService: PromotionStrategyService
    ) {
        super();
        this.initializeAchievements();
    }

    private initializeAchievements(): void {
        const defaultAchievements: Achievement[] = [
            {
                id: 'early_supporter',
                name: 'Early Supporter',
                description: 'One of the first to join and support the community',
                category: 'holding',
                requirements: [
                    {
                        type: 'holding_duration',
                        threshold: 30 // days
                    }
                ],
                rewards: {
                    points: 1000,
                    badge: {
                        name: 'Early Supporter Badge',
                        image: 'badges/early_supporter.png',
                        rarity: 'legendary'
                    }
                }
            },
            {
                id: 'engagement_master',
                name: 'Engagement Master',
                description: 'Consistently engage with the community',
                category: 'engagement',
                requirements: [
                    {
                        type: 'daily_activity',
                        threshold: 7,
                        timeframe: { days: 7 }
                    }
                ],
                rewards: {
                    points: 500,
                    badge: {
                        name: 'Engagement Master Badge',
                        image: 'badges/engagement_master.png',
                        rarity: 'rare'
                    }
                }
            }
            // Add more achievements as needed
        ];

        defaultAchievements.forEach(achievement => {
            this.achievements.set(achievement.id, achievement);
        });
    }

    async checkAchievements(
        userId: string,
        activityType: string,
        value: number
    ): Promise<void> {
        const userAchievements = this.userAchievements.get(userId) || [];
        const earnedAchievementIds = new Set(userAchievements.map(ua => ua.achievementId));

        for (const [id, achievement] of this.achievements) {
            if (earnedAchievementIds.has(id)) continue;

            const relevantRequirement = achievement.requirements.find(r => r.type === activityType);
            if (!relevantRequirement) continue;

            const progress = userAchievements.find(ua => ua.achievementId === id)?.progress || 
                achievement.requirements.map(r => ({
                    type: r.type,
                    current: 0,
                    required: r.threshold
                }));

            const requirementProgress = progress.find(p => p.type === activityType);
            if (requirementProgress) {
                requirementProgress.current = value;

                if (this.checkAchievementCompletion(progress)) {
                    await this.awardAchievement(userId, id);
                } else {
                    // Update progress
                    const existingProgress = userAchievements.findIndex(ua => ua.achievementId === id);
                    if (existingProgress !== -1) {
                        userAchievements[existingProgress].progress = progress;
                    } else {
                        userAchievements.push({
                            userId,
                            achievementId: id,
                            earnedAt: new Date(),
                            progress
                        });
                    }
                    this.userAchievements.set(userId, userAchievements);
                }
            }
        }
    }

    private checkAchievementCompletion(progress: { current: number; required: number }[]): boolean {
        return progress.every(p => p.current >= p.required);
    }

    private async awardAchievement(userId: string, achievementId: string): Promise<void> {
        const achievement = this.achievements.get(achievementId);
        if (!achievement) return;

        const userAchievement: UserAchievement = {
            userId,
            achievementId,
            earnedAt: new Date(),
            progress: achievement.requirements.map(r => ({
                type: r.type,
                current: r.threshold,
                required: r.threshold
            }))
        };

        const userAchievements = this.userAchievements.get(userId) || [];
        userAchievements.push(userAchievement);
        this.userAchievements.set(userId, userAchievements);

        // Announce achievement
        await this.announceAchievement(userId, achievement);

        this.emit('achievement_earned', { userId, achievement });
    }

    private async announceAchievement(userId: string, achievement: Achievement): Promise<void> {
        const platforms = ['discord', 'twitter'];
        
        for (const platform of platforms) {
            try {
                const content = await this.contentManager.generateContent(
                    platform,
                    'achievement',
                    {
                        userId,
                        achievementName: achievement.name,
                        description: achievement.description,
                        rewards: this.formatRewards(achievement.rewards)
                    }
                );

                await this.promotionService.createABTest(platform, content);
            } catch (error) {
                console.error(`Error announcing achievement on ${platform}:`, error);
            }
        }
    }

    private formatRewards(rewards: Achievement['rewards']): string {
        const parts = [];
        if (rewards.points) parts.push(`${rewards.points} points`);
        if (rewards.badge) parts.push(rewards.badge.name);
        return parts.join(', ');
    }

    getUserAchievements(userId: string): Achievement[] {
        const userAchievements = this.userAchievements.get(userId) || [];
        return userAchievements.map(ua => this.achievements.get(ua.achievementId)!)
            .filter((a): a is Achievement => !!a);
    }

    getAvailableAchievements(): Achievement[] {
        return Array.from(this.achievements.values());
    }

    getUserProgress(userId: string, achievementId: string): UserAchievement | undefined {
        const userAchievements = this.userAchievements.get(userId) || [];
        return userAchievements.find(ua => ua.achievementId === achievementId);
    }

    async cleanup(): Promise<void> {
        this.achievements.clear();
        this.userAchievements.clear();
        this.removeAllListeners();
    }
} 