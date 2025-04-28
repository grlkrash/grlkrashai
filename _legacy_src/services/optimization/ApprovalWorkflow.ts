import { EventEmitter } from 'events';
import { AnalyticsService } from '../analytics/AnalyticsService';
import { ContentService } from '../content/ContentService';

interface OptimizationProposal {
    platform: string;
    contentId: string;
    original: any;
    optimized: any;
    changes: {
        field: string;
        before: any;
        after: any;
        impact: {
            metric: string;
            predictedChange: number;
            confidence: number;
        }[];
    }[];
    predictedPerformance: {
        engagement: number;
        reach: number;
        conversion: number;
        confidence: number;
    };
    riskAssessment: {
        level: 'low' | 'medium' | 'high';
        factors: string[];
    };
}

interface ApprovalCriteria {
    minConfidence: number;
    maxRiskLevel: 'low' | 'medium' | 'high';
    minPredictedImprovement: number;
    requiredMetrics: string[];
    platformSpecific?: {
        [platform: string]: {
            additionalChecks: string[];
            restrictedChanges: string[];
        };
    };
}

export class ApprovalWorkflow extends EventEmitter {
    private analyticsService: AnalyticsService;
    private contentService: ContentService;
    private approvalCriteria: ApprovalCriteria;
    private approvalHistory: Map<string, {
        timestamp: Date;
        approved: boolean;
        reason: string;
        performance: any;
    }[]>;

    constructor(
        analyticsService: AnalyticsService,
        contentService: ContentService,
        criteria?: Partial<ApprovalCriteria>
    ) {
        super();
        this.analyticsService = analyticsService;
        this.contentService = contentService;
        this.approvalHistory = new Map();

        // Default approval criteria
        this.approvalCriteria = {
            minConfidence: 0.7,
            maxRiskLevel: 'medium',
            minPredictedImprovement: 0.1, // 10% improvement
            requiredMetrics: ['engagement', 'reach', 'conversion'],
            platformSpecific: {
                twitter: {
                    additionalChecks: ['sentiment', 'viralPotential'],
                    restrictedChanges: ['userMentions', 'sensitiveContent']
                },
                instagram: {
                    additionalChecks: ['visualAppeal', 'hashtagRelevance'],
                    restrictedChanges: ['filteredContent', 'excessiveHashtags']
                },
                youtube: {
                    additionalChecks: ['retentionRate', 'clickThroughRate'],
                    restrictedChanges: ['thumbnailMisleading', 'titleClickbait']
                },
                tiktok: {
                    additionalChecks: ['trendAlignment', 'soundUsage'],
                    restrictedChanges: ['copyrightedMusic', 'restrictedEffects']
                }
            },
            ...criteria
        };
    }

    async evaluateOptimization(
        platform: string,
        contentId: string,
        original: any,
        optimized: any
    ): Promise<{
        approved: boolean;
        reason: string;
        proposal: OptimizationProposal;
    }> {
        // Generate detailed optimization proposal
        const proposal = await this.generateProposal(platform, contentId, original, optimized);

        // Check approval history
        const recentApprovals = this.getRecentApprovals(platform, contentId);
        if (this.hasRecentFailure(recentApprovals)) {
            return {
                approved: false,
                reason: 'Recent optimization failure, waiting for cool-down period',
                proposal
            };
        }

        // Evaluate against criteria
        const evaluation = await this.evaluateAgainstCriteria(proposal);
        
        // Record the decision
        this.recordDecision(platform, contentId, evaluation.approved, evaluation.reason);

        return evaluation;
    }

    private async generateProposal(
        platform: string,
        contentId: string,
        original: any,
        optimized: any
    ): Promise<OptimizationProposal> {
        // Analyze changes
        const changes = this.analyzeChanges(original, optimized);

        // Get performance predictions
        const predictions = await this.analyticsService.predictPerformance(platform, optimized);

        // Assess risks
        const riskAssessment = await this.assessRisks(platform, changes, predictions);

        return {
            platform,
            contentId,
            original,
            optimized,
            changes,
            predictedPerformance: predictions,
            riskAssessment
        };
    }

    private analyzeChanges(original: any, optimized: any): OptimizationProposal['changes'] {
        const changes: OptimizationProposal['changes'] = [];
        const analyzedFields = new Set<string>();

        // Recursively analyze changes
        const analyzeObject = (orig: any, opt: any, path: string = '') => {
            if (typeof orig !== typeof opt) {
                changes.push(this.createChangeEntry(path, orig, opt));
                return;
            }

            if (typeof orig === 'object' && orig !== null) {
                for (const key of new Set([...Object.keys(orig), ...Object.keys(opt)])) {
                    analyzeObject(orig[key], opt[key], path ? `${path}.${key}` : key);
                }
            } else if (orig !== opt) {
                changes.push(this.createChangeEntry(path, orig, opt));
            }
        };

        analyzeObject(original, optimized);
        return changes;
    }

    private createChangeEntry(field: string, before: any, after: any): OptimizationProposal['changes'][0] {
        return {
            field,
            before,
            after,
            impact: [
                {
                    metric: 'engagement',
                    predictedChange: this.predictMetricChange('engagement', before, after),
                    confidence: 0.8
                },
                {
                    metric: 'reach',
                    predictedChange: this.predictMetricChange('reach', before, after),
                    confidence: 0.75
                }
            ]
        };
    }

    private predictMetricChange(metric: string, before: any, after: any): number {
        // Implement metric-specific prediction logic
        return 0.1; // Placeholder: 10% improvement
    }

    private async assessRisks(
        platform: string,
        changes: OptimizationProposal['changes'],
        predictions: any
    ): Promise<OptimizationProposal['riskAssessment']> {
        const factors: string[] = [];
        let riskLevel: 'low' | 'medium' | 'high' = 'low';

        // Check platform-specific restrictions
        const restrictedChanges = this.approvalCriteria.platformSpecific?.[platform]?.restrictedChanges || [];
        const hasRestrictedChanges = changes.some(change => 
            restrictedChanges.some(restricted => change.field.includes(restricted))
        );

        if (hasRestrictedChanges) {
            factors.push('Contains restricted changes');
            riskLevel = 'high';
        }

        // Assess prediction confidence
        if (predictions.confidence < this.approvalCriteria.minConfidence) {
            factors.push('Low prediction confidence');
            riskLevel = 'medium';
        }

        // Check for dramatic changes
        const dramaticChanges = changes.filter(change => 
            change.impact.some(impact => Math.abs(impact.predictedChange) > 0.5)
        );
        if (dramaticChanges.length > 0) {
            factors.push('Contains dramatic changes');
            riskLevel = 'medium';
        }

        return { level: riskLevel, factors };
    }

    private async evaluateAgainstCriteria(
        proposal: OptimizationProposal
    ): Promise<{ approved: boolean; reason: string }> {
        // Check confidence
        if (proposal.predictedPerformance.confidence < this.approvalCriteria.minConfidence) {
            return {
                approved: false,
                reason: 'Insufficient confidence in predictions'
            };
        }

        // Check risk level
        const riskLevels = { low: 0, medium: 1, high: 2 };
        if (riskLevels[proposal.riskAssessment.level] > riskLevels[this.approvalCriteria.maxRiskLevel]) {
            return {
                approved: false,
                reason: `Risk level (${proposal.riskAssessment.level}) exceeds maximum allowed (${this.approvalCriteria.maxRiskLevel})`
            };
        }

        // Check predicted improvement
        const avgImprovement = (
            proposal.predictedPerformance.engagement +
            proposal.predictedPerformance.reach +
            proposal.predictedPerformance.conversion
        ) / 3;

        if (avgImprovement < this.approvalCriteria.minPredictedImprovement) {
            return {
                approved: false,
                reason: 'Insufficient predicted improvement'
            };
        }

        // Check platform-specific criteria
        const platformChecks = this.approvalCriteria.platformSpecific?.[proposal.platform]?.additionalChecks;
        if (platformChecks) {
            const failedChecks = platformChecks.filter(check => !this.validatePlatformCheck(check, proposal));
            if (failedChecks.length > 0) {
                return {
                    approved: false,
                    reason: `Failed platform-specific checks: ${failedChecks.join(', ')}`
                };
            }
        }

        return {
            approved: true,
            reason: 'Meets all approval criteria'
        };
    }

    private validatePlatformCheck(check: string, proposal: OptimizationProposal): boolean {
        // Implement platform-specific validation logic
        return true; // Placeholder
    }

    private getRecentApprovals(platform: string, contentId: string): any[] {
        const key = `${platform}:${contentId}`;
        return this.approvalHistory.get(key) || [];
    }

    private hasRecentFailure(history: any[]): boolean {
        const lastDay = history.filter(h => 
            h.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );
        return lastDay.some(h => !h.approved);
    }

    private recordDecision(platform: string, contentId: string, approved: boolean, reason: string): void {
        const key = `${platform}:${contentId}`;
        const history = this.approvalHistory.get(key) || [];
        
        history.push({
            timestamp: new Date(),
            approved,
            reason,
            performance: null // To be updated later with actual performance
        });

        this.approvalHistory.set(key, history);
    }

    async updatePerformance(platform: string, contentId: string, performance: any): Promise<void> {
        const key = `${platform}:${contentId}`;
        const history = this.approvalHistory.get(key) || [];
        
        if (history.length > 0) {
            const lastEntry = history[history.length - 1];
            lastEntry.performance = performance;
        }

        this.approvalHistory.set(key, history);
    }

    async cleanup(): Promise<void> {
        this.approvalHistory.clear();
        this.removeAllListeners();
    }
} 