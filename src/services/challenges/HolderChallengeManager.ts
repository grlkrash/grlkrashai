import { EventEmitter } from 'events';
import { IAgentRuntime } from '@elizaos/core';
import { TokenContract } from '../types/contracts';
import { CommunityRewardsManager } from '../rewards/CommunityRewardsManager';
import { ChallengeTemplateManager } from './ChallengeTemplates';
import { PromotionStrategyService } from '../optimization/OptimizationService';
import { ContentTemplateManager } from '../content/ContentTemplates';

interface Challenge {
    id: string;
    name: string;
    description: string;
    requirements: {
        minHolding: number;
        duration: number;
        tasks: {
            type: string;
            count: number;
            points: number;
        }[];
    };
    rewards: {
        tokens: number;
        points: number;
        nft?: {
            type: string;
            metadata: any;
        };
    };
    timeframe: {
        start: Date;
        end: Date;
    };
}

interface ChallengeProgress {
    userId: string;
    challengeId: string;
    completedTasks: {
        type: string;
        count: number;
        timestamp: Date;
    }[];
    startTime: Date;
    lastUpdate: Date;
    status: 'active' | 'completed' | 'failed';
}

export class HolderChallengeManager extends EventEmitter {
    private challenges: Map<string, Challenge> = new Map();
    private progress: Map<string, ChallengeProgress[]> = new Map();
    private rewardsManager: CommunityRewardsManager;
    private tokenContract: TokenContract;
    private templateManager: ChallengeTemplateManager;
    private promotionService: PromotionStrategyService;
    private contentManager: ContentTemplateManager;

    constructor(
        private runtime: IAgentRuntime,
        tokenContract: TokenContract,
        rewardsManager: CommunityRewardsManager,
        contentManager: ContentTemplateManager,
        promotionService: PromotionStrategyService
    ) {
        super();
        this.tokenContract = tokenContract;
        this.rewardsManager = rewardsManager;
        this.contentManager = contentManager;
        this.promotionService = promotionService;
        this.templateManager = new ChallengeTemplateManager(contentManager, promotionService);
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.on('challengeCompleted', async (userId: string, challengeId: string) => {
            const challenge = this.challenges.get(challengeId);
            if (!challenge) return;

            await this.distributeRewards(userId, challenge.rewards);
        });

        this.templateManager.on('challengeReady', async (challenge: Challenge) => {
            await this.launchChallenge(challenge);
        });

        this.templateManager.on('automationError', async ({ id, error }) => {
            console.error(`Automation error for template ${id}:`, error);
            this.emit('automationError', { id, error });
        });
    }

    async launchChallenge(challenge: Omit<Challenge, 'id'>): Promise<string> {
        const id = this.generateChallengeId();
        const newChallenge: Challenge = {
            ...challenge,
            id
        };

        this.challenges.set(id, newChallenge);
        
        await this.announceChallenge(newChallenge);
        
        this.emit('challengeLaunched', newChallenge);
        return id;
    }

    private async announceChallenge(challenge: Challenge): Promise<void> {
        const platforms = ['discord', 'twitter', 'instagram'];
        
        for (const platform of platforms) {
            try {
                const content = await this.contentManager.generateContent(
                    platform,
                    'announcement',
                    {
                        challengeName: challenge.name,
                        description: challenge.description,
                        rewards: this.formatRewards(challenge.rewards),
                        duration: `${challenge.requirements.duration} days`,
                        minHolding: challenge.requirements.minHolding.toString()
                    }
                );

                await this.promotionService.createABTest(platform, content);
            } catch (error) {
                console.error(`Error announcing challenge on ${platform}:`, error);
            }
        }
    }

    private async shareCompletion(userId: string, challenge: Challenge): Promise<void> {
        const platforms = ['discord', 'twitter'];
        
        for (const platform of platforms) {
            try {
                const content = await this.contentManager.generateContent(
                    platform,
                    'achievement',
                    {
                        userId,
                        challengeName: challenge.name,
                        rewards: this.formatRewards(challenge.rewards)
                    }
                );

                await this.promotionService.createABTest(platform, content);
            } catch (error) {
                console.error(`Error sharing completion on ${platform}:`, error);
            }
        }
    }

    async joinChallenge(userId: string, challengeId: string): Promise<boolean> {
        const challenge = this.challenges.get(challengeId);
        if (!challenge) {
            throw new Error('Challenge not found');
        }

        // Check eligibility
        const holding = await this.tokenContract.balanceOf(userId);
        if (holding < challenge.requirements.minHolding) {
            return false;
        }

        // Initialize progress
        const userProgress: ChallengeProgress = {
            userId,
            challengeId,
            completedTasks: [],
            startTime: new Date(),
            lastUpdate: new Date(),
            status: 'active'
        };

        const existingProgress = this.progress.get(userId) || [];
        existingProgress.push(userProgress);
        this.progress.set(userId, existingProgress);

        this.emit('challengeJoined', userId, challengeId);
        return true;
    }

    async trackProgress(
        userId: string,
        challengeId: string,
        taskType: string
    ): Promise<void> {
        const userProgress = this.getUserProgress(userId, challengeId);
        if (!userProgress || userProgress.status !== 'active') {
            return;
        }

        const challenge = this.challenges.get(challengeId);
        if (!challenge) return;

        // Update task completion
        const taskProgress = userProgress.completedTasks.find(t => t.type === taskType);
        if (taskProgress) {
            taskProgress.count++;
            taskProgress.timestamp = new Date();
        } else {
            userProgress.completedTasks.push({
                type: taskType,
                count: 1,
                timestamp: new Date()
            });
        }

        userProgress.lastUpdate = new Date();

        // Check if challenge is completed
        if (this.isChallengeCompleted(userProgress, challenge)) {
            userProgress.status = 'completed';
            this.emit('challengeCompleted', userId, challengeId);
        }

        // Update progress
        const allProgress = this.progress.get(userId) || [];
        const index = allProgress.findIndex(p => p.challengeId === challengeId);
        if (index !== -1) {
            allProgress[index] = userProgress;
            this.progress.set(userId, allProgress);
        }
    }

    private isChallengeCompleted(
        progress: ChallengeProgress,
        challenge: Challenge
    ): boolean {
        return challenge.requirements.tasks.every(task => {
            const completed = progress.completedTasks.find(t => t.type === task.type);
            return completed && completed.count >= task.count;
        });
    }

    private async distributeRewards(
        userId: string,
        rewards: Challenge['rewards']
    ): Promise<void> {
        try {
            // Distribute tokens
            if (rewards.tokens > 0) {
                await this.tokenContract.transfer(userId, rewards.tokens);
            }

            // Award points
            if (rewards.points > 0) {
                await this.rewardsManager.calculateRewards(userId, ['challenge_completion'], {
                    holding: 0,
                    holdingDuration: 0,
                    completedActivities: [],
                    engagementScore: rewards.points
                });
            }

            // Mint NFT if applicable
            if (rewards.nft) {
                // NFT minting logic would go here
            }

            // Share achievement on social platforms
            const challenge = Array.from(this.challenges.values())
                .find(c => c.rewards === rewards);
            
            if (challenge) {
                await this.shareCompletion(userId, challenge);
            }

            this.emit('rewardsDistributed', userId, rewards);
        } catch (error) {
            console.error('Error distributing rewards:', error);
            this.emit('rewardsError', userId, error);
        }
    }

    getUserChallenges(userId: string): {
        active: Challenge[];
        completed: Challenge[];
        available: Challenge[];
    } {
        const userProgress = this.progress.get(userId) || [];
        const now = new Date();

        const active = userProgress
            .filter(p => p.status === 'active')
            .map(p => this.challenges.get(p.challengeId))
            .filter((c): c is Challenge => !!c);

        const completed = userProgress
            .filter(p => p.status === 'completed')
            .map(p => this.challenges.get(p.challengeId))
            .filter((c): c is Challenge => !!c);

        const available = Array.from(this.challenges.values()).filter(
            challenge =>
                !userProgress.some(p => p.challengeId === challenge.id) &&
                challenge.timeframe.start <= now &&
                challenge.timeframe.end >= now
        );

        return { active, completed, available };
    }

    private getUserProgress(
        userId: string,
        challengeId: string
    ): ChallengeProgress | undefined {
        const userProgress = this.progress.get(userId) || [];
        return userProgress.find(p => p.challengeId === challengeId);
    }

    private generateChallengeId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    async addChallengeTemplate(template: any): Promise<string> {
        return this.templateManager.addTemplate(template);
    }

    getAvailableTemplates(): any[] {
        return this.templateManager.getAllTemplates();
    }

    async cleanup(): Promise<void> {
        await this.templateManager.cleanup();
        this.challenges.clear();
        this.progress.clear();
        this.removeAllListeners();
    }

    private formatRewards(rewards: Challenge['rewards']): string {
        const parts = [];
        if (rewards.tokens) parts.push(`${rewards.tokens} tokens`);
        if (rewards.points) parts.push(`${rewards.points} points`);
        if (rewards.nft) parts.push(rewards.nft.metadata.name);
        return parts.join(', ');
    }
} 