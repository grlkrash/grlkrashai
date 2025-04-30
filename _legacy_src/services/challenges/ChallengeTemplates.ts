import { EventEmitter } from 'events';
import { Challenge } from './HolderChallengeManager';
import { ContentTemplateManager } from '../content/ContentTemplates';
import { PromotionStrategyService } from '../optimization/OptimizationService';

interface ChallengeTemplate extends Omit<Challenge, 'id' | 'timeframe'> {
    type: 'engagement' | 'promotion' | 'holding' | 'community';
    automationRules?: {
        frequency: 'daily' | 'weekly' | 'monthly';
        conditions?: {
            minActiveUsers?: number;
            minTokenPrice?: number;
            requiredPlatforms?: string[];
        };
        promotion?: {
            platforms: string[];
            contentType: string;
            schedule: 'before' | 'during' | 'after';
        };
    };
}

export const DEFAULT_TEMPLATES: ChallengeTemplate[] = [
    {
        name: 'Music Promotion Master',
        description: 'Promote GRLKRASH music across platforms',
        type: 'promotion',
        requirements: {
            minHolding: 5000,
            duration: 7,
            tasks: [
                {
                    type: 'share',
                    count: 3,
                    points: 100
                },
                {
                    type: 'create_content',
                    count: 1,
                    points: 200
                },
                {
                    type: 'engage',
                    count: 10,
                    points: 50
                }
            ]
        },
        rewards: {
            tokens: 1000,
            points: 500,
            nft: {
                type: 'badge',
                metadata: {
                    name: 'Promotion Master Badge',
                    description: 'Awarded for exceptional music promotion'
                }
            }
        },
        automationRules: {
            frequency: 'weekly',
            conditions: {
                minActiveUsers: 100,
                requiredPlatforms: ['instagram', 'tiktok', 'youtube']
            },
            promotion: {
                platforms: ['discord', 'twitter'],
                contentType: 'announcement',
                schedule: 'before'
            }
        }
    },
    // Add more templates...
];

export class ChallengeTemplateManager extends EventEmitter {
    private templates: Map<string, ChallengeTemplate> = new Map();
    private contentManager: ContentTemplateManager;
    private promotionService: PromotionStrategyService;
    private automationTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        contentManager: ContentTemplateManager,
        promotionService: PromotionStrategyService
    ) {
        super();
        this.contentManager = contentManager;
        this.promotionService = promotionService;
        this.initializeDefaultTemplates();
    }

    private initializeDefaultTemplates(): void {
        DEFAULT_TEMPLATES.forEach(template => {
            const id = this.generateTemplateId(template.name);
            this.templates.set(id, template);
        });
    }

    async addTemplate(template: ChallengeTemplate): Promise<string> {
        const id = this.generateTemplateId(template.name);
        this.templates.set(id, template);
        
        if (template.automationRules) {
            await this.setupAutomation(id, template);
        }

        this.emit('templateAdded', { id, template });
        return id;
    }

    private async setupAutomation(id: string, template: ChallengeTemplate): Promise<void> {
        if (!template.automationRules) return;

        const interval = this.getAutomationInterval(template.automationRules.frequency);
        const timer = setInterval(async () => {
            try {
                if (await this.checkAutomationConditions(template)) {
                    await this.automateChallenge(id, template);
                }
            } catch (error) {
                console.error('Challenge automation error:', error);
                this.emit('automationError', { id, error });
            }
        }, interval);

        this.automationTimers.set(id, timer);
    }

    private async automateChallenge(id: string, template: ChallengeTemplate): Promise<void> {
        // Generate challenge timeframe
        const timeframe = this.generateTimeframe(template);

        // Create promotion content if needed
        if (template.automationRules?.promotion) {
            await this.createPromotionalContent(template, timeframe);
        }

        // Emit event for challenge creation
        this.emit('challengeReady', {
            ...template,
            id,
            timeframe
        });
    }

    private async createPromotionalContent(
        template: ChallengeTemplate,
        timeframe: { start: Date; end: Date }
    ): Promise<void> {
        const { platforms, contentType } = template.automationRules!.promotion!;

        for (const platform of platforms) {
            const content = await this.contentManager.generateContent(
                platform,
                contentType,
                {
                    challengeName: template.name,
                    description: template.description,
                    startDate: timeframe.start.toLocaleDateString(),
                    endDate: timeframe.end.toLocaleDateString(),
                    rewards: this.formatRewards(template.rewards)
                }
            );

            await this.promotionService.createABTest(platform, content);
        }
    }

    private async checkAutomationConditions(template: ChallengeTemplate): Promise<boolean> {
        if (!template.automationRules?.conditions) return true;

        const conditions = template.automationRules.conditions;
        // Implement condition checking logic
        return true;
    }

    getTemplate(id: string): ChallengeTemplate | undefined {
        return this.templates.get(id);
    }

    getAllTemplates(): ChallengeTemplate[] {
        return Array.from(this.templates.values());
    }

    private generateTemplateId(name: string): string {
        return name.toLowerCase().replace(/\s+/g, '_');
    }

    private getAutomationInterval(frequency: string): number {
        const day = 24 * 60 * 60 * 1000;
        switch (frequency) {
            case 'daily': return day;
            case 'weekly': return 7 * day;
            case 'monthly': return 30 * day;
            default: return day;
        }
    }

    private generateTimeframe(template: ChallengeTemplate): { start: Date; end: Date } {
        const start = new Date();
        const end = new Date(start.getTime() + template.requirements.duration * 24 * 60 * 60 * 1000);
        return { start, end };
    }

    private formatRewards(rewards: Challenge['rewards']): string {
        const parts = [];
        if (rewards.tokens) parts.push(`${rewards.tokens} tokens`);
        if (rewards.points) parts.push(`${rewards.points} points`);
        if (rewards.nft) parts.push(rewards.nft.metadata.name);
        return parts.join(', ');
    }

    async cleanup(): Promise<void> {
        for (const timer of this.automationTimers.values()) {
            clearInterval(timer);
        }
        this.automationTimers.clear();
        this.templates.clear();
        this.removeAllListeners();
    }
} 