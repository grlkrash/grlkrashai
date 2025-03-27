import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { IAgentRuntime } from '@elizaos/core';
import { TokenDistributionService } from '../payment/TokenDistributionService';
import { BlockchainPowers } from '../blockchain/BlockchainService';
import { ProgressTracker } from '../tracking/ProgressTracker';
import { HolderChallengesManager } from '../challenges/HolderChallengesManager';

interface AirdropBatch {
    recipients: string[];
    amounts: number[];
    merkleRoot: string;
    expiryTime: number;
}

interface EngagementScore {
    userId: string;
    walletAddress: string;
    points: number;
    activities: {
        type: string;
        count: number;
        weight: number;
    }[];
    challengeStats: {
        completed: number;
        streak: number;
        difficulty: number;
        bonus: number;
    };
    totalScore: number;
}

interface AirdropEligibility {
    isEligibleEngagement: boolean;
    isEligibleChallenges: boolean;
    engagementScore: number;
    challengeScore: number;
    dualParticipationBonus: number;
}

interface AirdropDistributionRules {
    engagement: {
        minPoints: number;
        baseAmount: number;
        pointMultiplier: number;
        activityBonuses: {
            [key: string]: number;
        };
    };
    challenges: {
        minCompletions: number;
        baseAmount: number;
        completionMultiplier: number;
        streakBonus: number;
        difficultyMultiplier: number;
    };
    dualParticipationBonus: number;
    frequency: number;
    maxPerPeriod: number;
}

export class OptimizedAirdropManager extends EventEmitter {
    private readonly MAX_BATCH_SIZE = 100;
    private readonly GAS_PRICE_THRESHOLD = 50; // Gwei
    private readonly RETRY_ATTEMPTS = 3;
    private readonly RETRY_DELAY = 60000; // 1 minute
    private distributionRules: AirdropDistributionRules;
    private distributionInterval: NodeJS.Timeout;

    constructor(
        private runtime: IAgentRuntime,
        private provider: ethers.providers.Provider,
        private tokenContract: any,
        private distributionService: TokenDistributionService,
        private blockchainService: BlockchainPowers,
        private progressTracker: ProgressTracker,
        private challengesManager: HolderChallengesManager,
        private retryQueue: any
    ) {
        super();
        this.setupDistributionRules();
        this.startAutonomousDistribution();
    }

    private setupDistributionRules() {
        this.distributionRules = {
            engagement: {
                minPoints: 100,
                baseAmount: 10,
                pointMultiplier: 0.1,
                activityBonuses: {
                    'proposal_creation': 2.0,
                    'vote_cast': 1.5,
                    'daily_activity': 1.2,
                    'community_engagement': 1.3,
                    'content_creation': 1.8
                }
            },
            challenges: {
                minCompletions: 1,
                baseAmount: 15,
                completionMultiplier: 1.5,
                streakBonus: 0.1,
                difficultyMultiplier: 0.5
            },
            dualParticipationBonus: 0.5, // 50% bonus for participating in both
            frequency: 24 * 60 * 60 * 1000,
            maxPerPeriod: 1000
        };
    }

    private startAutonomousDistribution() {
        this.distributionInterval = setInterval(
            () => this.processAutonomousDistribution(),
            this.distributionRules.frequency
        );
    }

    private async processAutonomousDistribution() {
        try {
            const users = await this.progressTracker.getAllUsers();
            const eligibleRecipients = [];

            for (const user of users) {
                const eligibility = await this.calculateUserEligibility(user.id);
                
                // User must be eligible through either path
                if (eligibility.isEligibleEngagement || eligibility.isEligibleChallenges) {
                    eligibleRecipients.push({
                        address: user.walletAddress,
                        amount: this.calculateAirdropAmount(eligibility)
                    });
                }
            }

            if (eligibleRecipients.length === 0) return;

            // Scale amounts if total exceeds maxPerPeriod
            const totalAmount = eligibleRecipients.reduce((sum, r) => sum + r.amount, 0);
            if (totalAmount > this.distributionRules.maxPerPeriod) {
                const scaleFactor = this.distributionRules.maxPerPeriod / totalAmount;
                eligibleRecipients.forEach(r => r.amount *= scaleFactor);
            }

            // Queue the airdrop
            await this.queueAirdrop(
                eligibleRecipients.map(r => r.address),
                eligibleRecipients.map(r => r.amount),
                { minActivity: this.distributionRules.engagement.minPoints }
            );

            this.emit('autonomousDistributionProcessed', {
                recipients: eligibleRecipients.length,
                totalAmount: eligibleRecipients.reduce((sum, r) => sum + r.amount, 0)
            });

        } catch (error) {
            console.error('Autonomous distribution failed:', error);
            this.emit('autonomousDistributionFailed', { error });
        }
    }

    private async calculateUserEligibility(userId: string): Promise<AirdropEligibility> {
        // Calculate engagement eligibility
        const activities = await this.progressTracker.getUserActivities(userId);
        const points = await this.progressTracker.getUserPoints(userId);
        const engagementScore = this.calculateEngagementScore(activities, points);
        const isEligibleEngagement = engagementScore >= this.distributionRules.engagement.minPoints;

        // Calculate challenge eligibility
        const challengeStats = await this.calculateChallengeStats(userId);
        const challengeScore = this.calculateChallengeScore(challengeStats);
        const isEligibleChallenges = challengeStats.completed >= this.distributionRules.challenges.minCompletions;

        // Calculate dual participation bonus
        const dualParticipationBonus = (isEligibleEngagement && isEligibleChallenges) ? 
            this.distributionRules.dualParticipationBonus : 0;

        return {
            isEligibleEngagement,
            isEligibleChallenges,
            engagementScore,
            challengeScore,
            dualParticipationBonus
        };
    }

    private calculateEngagementScore(activities: Record<string, number>, points: number): number {
        const { engagement } = this.distributionRules;
        
        const activityScore = Object.entries(activities).reduce(
            (sum, [type, count]) => sum + (count * (engagement.activityBonuses[type] || 1)),
            0
        );

        return activityScore + (points * engagement.pointMultiplier);
    }

    private calculateChallengeScore(stats: {
        completed: number;
        streak: number;
        difficulty: number;
    }): number {
        const { challenges } = this.distributionRules;
        
        return (
            stats.completed * challenges.completionMultiplier +
            stats.streak * challenges.streakBonus +
            stats.difficulty * challenges.difficultyMultiplier
        ) * challenges.baseAmount;
    }

    private calculateAirdropAmount(eligibility: AirdropEligibility): number {
        let amount = 0;

        // Add engagement rewards if eligible
        if (eligibility.isEligibleEngagement) {
            amount += this.distributionRules.engagement.baseAmount + eligibility.engagementScore;
        }

        // Add challenge rewards if eligible
        if (eligibility.isEligibleChallenges) {
            amount += eligibility.challengeScore;
        }

        // Apply dual participation bonus if applicable
        if (eligibility.dualParticipationBonus > 0) {
            amount *= (1 + eligibility.dualParticipationBonus);
        }

        return Math.floor(amount);
    }

    async queueAirdrop(
        recipients: string[],
        amounts: number[],
        criteria: AirdropCriteria
    ): Promise<void> {
        try {
            // Validate inputs
            if (recipients.length !== amounts.length) {
                throw new Error('Recipients and amounts arrays must have the same length');
            }

            // Split into optimal batches
            const batches = this.createOptimalBatches(recipients, amounts);
            
            for (const batch of batches) {
                const merkleRoot = this.generateMerkleRoot(batch.recipients, batch.amounts);
                
                try {
                    await this.executeAirdropWithRetry({
                        ...batch,
                        merkleRoot,
                        expiryTime: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                    });
                } catch (error) {
                    console.error('Airdrop batch failed:', error);
                    // Queue for retry system
                    await this.queueForRetry(batch);
                }
            }

            this.emit('airdropQueued', {
                totalRecipients: recipients.length,
                totalAmount: amounts.reduce((a, b) => a + b, 0),
                batches: batches.length
            });
        } catch (error) {
            console.error('Error queueing airdrop:', error);
            throw error;
        }
    }

    private async executeAirdropWithRetry(
        batch: AirdropBatch,
        attempt: number = 1
    ): Promise<void> {
        try {
            const gasPrice = await this.provider.getGasPrice();
            
            if (gasPrice.gt(ethers.utils.parseUnits(this.GAS_PRICE_THRESHOLD.toString(), 'gwei'))) {
                throw new Error('Gas price too high');
            }

            const tx = await this.tokenContract.airdropBatch(
                batch.recipients,
                batch.amounts,
                batch.merkleRoot,
                {
                    gasLimit: this.calculateOptimalGasLimit(batch),
                    gasPrice
                }
            );

            await tx.wait();

            this.emit('batchCompleted', {
                txHash: tx.hash,
                recipients: batch.recipients.length,
                totalAmount: batch.amounts.reduce((a, b) => a + b, 0)
            });

        } catch (error) {
            if (attempt < this.RETRY_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                return this.executeAirdropWithRetry(batch, attempt + 1);
            }
            throw error;
        }
    }

    private calculateOptimalGasLimit(batch: AirdropBatch): number {
        // Base gas cost + per-recipient gas cost
        return 21000 + (batch.recipients.length * 20000);
    }

    private createOptimalBatches(
        recipients: string[],
        amounts: number[]
    ): Array<{ recipients: string[]; amounts: number[] }> {
        const batches = [];
        
        for (let i = 0; i < recipients.length; i += this.MAX_BATCH_SIZE) {
            batches.push({
                recipients: recipients.slice(i, i + this.MAX_BATCH_SIZE),
                amounts: amounts.slice(i, i + this.MAX_BATCH_SIZE)
            });
        }
        
        return batches;
    }

    private generateMerkleRoot(recipients: string[], amounts: number[]): string {
        const leaves = recipients.map((recipient, index) =>
            Buffer.from(
                ethers.utils.solidityKeccak256(
                    ['address', 'uint256'],
                    [recipient, amounts[index]]
                ).slice(2),
                'hex'
            )
        );

        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        return tree.getHexRoot();
    }

    private async queueForRetry(batch: AirdropBatch): Promise<void> {
        await this.retryQueue.add({
            type: 'airdrop_batch',
            data: batch,
            attempts: 0,
            maxAttempts: this.RETRY_ATTEMPTS
        });

        this.emit('batchQueued', {
            recipients: batch.recipients.length,
            totalAmount: batch.amounts.reduce((a, b) => a + b, 0)
        });
    }

    async verifyMerkleProof(
        recipient: string,
        amount: number,
        merkleRoot: string
    ): Promise<boolean> {
        const leaf = Buffer.from(
            ethers.utils.solidityKeccak256(
                ['address', 'uint256'],
                [recipient, amount]
            ).slice(2),
            'hex'
        );

        const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });
        const proof = tree.getHexProof(leaf);

        return tree.verify(proof, leaf, merkleRoot);
    }

    async getAirdropStatus(address: string): Promise<{
        claimed: boolean;
        amount: number;
        expiryTime: number;
    }> {
        try {
            const status = await this.tokenContract.airdropStatus(address);
            return {
                claimed: status.claimed,
                amount: status.amount.toNumber(),
                expiryTime: status.expiryTime.toNumber()
            };
        } catch (error) {
            console.error('Error getting airdrop status:', error);
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        clearInterval(this.distributionInterval);
        this.removeAllListeners();
    }
} 