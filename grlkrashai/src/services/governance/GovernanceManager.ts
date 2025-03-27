import { EventEmitter } from 'events';
import { IAgentRuntime } from '@elizaos/core';
import { TokenContract } from '../types/contracts';
import { ProgressTracker } from '../tracking/ProgressTracker';
import { AchievementManager } from '../achievements/AchievementManager';
import { VotingSecurityService } from './VotingSecurityService';

interface Proposal {
    id: number;
    title: string;
    description: string;
    proposer: string;
    startTime: number;
    endTime: number;
    status: 'active' | 'passed' | 'failed' | 'executed';
    votesFor: number;
    votesAgainst: number;
    minimumQuorum: number;
    executionData: string;
}

interface VotingPower {
    baseVotes: number;
    tokenBalance: number;
    multiplier: number;
    nftBonus: number;
    totalPower: number;
}

interface GovernanceReward {
    proposalParticipation: number;
    votingStreak: number;
    proposalCreation: number;
    totalReward: number;
}

export class GovernanceManager extends EventEmitter {
    private proposals: Map<number, Proposal> = new Map();
    private nextProposalId: number = 1;
    private readonly MINIMUM_PROPOSAL_TOKENS = 1000;
    private readonly VOTING_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days
    private readonly BASE_VOTING_POWER = 1;
    private readonly NFT_BONUS_MULTIPLIER = 0.1;
    private readonly PROPOSAL_REWARD = 100;
    private readonly VOTE_REWARD = 10;

    constructor(
        private runtime: IAgentRuntime,
        private tokenContract: TokenContract,
        private progressTracker: ProgressTracker,
        private achievementManager: AchievementManager,
        private votingSecurityService: VotingSecurityService
    ) {
        super();
    }

    async createProposal(
        userId: string,
        title: string,
        description: string,
        executionData: string
    ): Promise<Proposal> {
        // Verify identity first
        const identity = await this.votingSecurityService.verifyIdentity(
            userId,
            await this.getWalletAddress(userId)
        );
        
        if (!identity) {
            throw new Error('Identity verification required to create proposals');
        }

        // Calculate voting power (includes token balance check)
        const votingPower = await this.votingSecurityService.calculateVotingPower(userId);
        if (votingPower < this.MINIMUM_PROPOSAL_TOKENS) {
            throw new Error('Insufficient voting power to create proposal');
        }

        // Create proposal
        const proposal: Proposal = {
            id: this.nextProposalId++,
            title,
            description,
            proposer: userId,
            startTime: Date.now(),
            endTime: Date.now() + this.VOTING_PERIOD,
            status: 'active',
            votesFor: 0,
            votesAgainst: 0,
            minimumQuorum: await this.calculateQuorum(),
            executionData
        };

        this.proposals.set(proposal.id, proposal);
        
        // Award proposal creation points
        await this.progressTracker.trackActivity(userId, 'proposal_creation', {
            proposalId: proposal.id
        });

        this.emit('proposalCreated', { proposalId: proposal.id, proposer: userId });
        return proposal;
    }

    async castVote(
        userId: string,
        proposalId: number,
        support: boolean
    ): Promise<void> {
        // Security checks
        if (!await this.votingSecurityService.canVote(userId, proposalId)) {
            throw new Error('Not eligible to vote');
        }

        const proposal = this.proposals.get(proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }

        if (proposal.status !== 'active') {
            throw new Error('Proposal is not active');
        }

        if (Date.now() > proposal.endTime) {
            throw new Error('Voting period has ended');
        }

        // Calculate voting power with all modifiers
        const votingPower = await this.votingSecurityService.calculateVotingPower(userId);

        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }

        // Record the vote
        await this.votingSecurityService.recordVote(userId, proposalId);

        // Update proposal
        this.proposals.set(proposalId, proposal);

        // Record participation for rewards
        await this.progressTracker.trackActivity(userId, 'vote_cast', {
            proposalId,
            support,
            votingPower
        });

        this.emit('voteCast', {
            proposalId,
            voter: userId,
            support,
            votingPower
        });

        // Check for suspicious activity patterns
        await this.checkForSuspiciousActivity(userId, proposalId);

        // Check if proposal can be finalized
        await this.checkProposalStatus(proposalId);
    }

    private async checkForSuspiciousActivity(userId: string, proposalId: number): Promise<void> {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) return;

        // Check if voting for own proposal
        if (proposal.proposer === userId) {
            await this.votingSecurityService.flagSuspiciousActivity(userId);
        }

        // Check for rapid voting pattern
        const userVotes = await this.progressTracker.getUserActivity(userId, 'vote_cast');
        const recentVotes = userVotes.filter(v => 
            Date.now() - v.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
        );

        if (recentVotes.length > 3) {
            await this.votingSecurityService.flagSuspiciousActivity(userId);
        }
    }

    private async getWalletAddress(userId: string): Promise<string> {
        // Implementation would depend on how you store wallet associations
        return '';
    }

    private async calculateVotingPower(userId: string): Promise<VotingPower> {
        const tokenBalance = await this.tokenContract.balanceOf(userId);
        const nftCount = 0; // Implement NFT counting logic

        // Calculate multipliers
        const streakMultiplier = await this.calculateStreakMultiplier(userId);
        const nftBonus = nftCount * this.NFT_BONUS_MULTIPLIER;

        const totalPower = Math.floor(
            (this.BASE_VOTING_POWER + tokenBalance) * 
            (1 + streakMultiplier + nftBonus)
        );

        return {
            baseVotes: this.BASE_VOTING_POWER,
            tokenBalance,
            multiplier: streakMultiplier,
            nftBonus,
            totalPower
        };
    }

    private async calculateQuorum(): Promise<number> {
        const totalSupply = await this.tokenContract.totalSupply();
        return Math.floor(totalSupply * 0.1); // 10% quorum
    }

    private async calculateStreakMultiplier(userId: string): Promise<number> {
        const progress = this.progressTracker.getUserProgress(userId);
        if (!progress) return 0;

        const votingActivity = progress.activities.find(a => a.type === 'vote_cast');
        if (!votingActivity) return 0;

        // Calculate streak based on voting history
        let streak = 0;
        const now = Date.now();
        const history = votingActivity.history
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        for (let i = 0; i < history.length - 1; i++) {
            const current = history[i].timestamp.getTime();
            const next = history[i + 1].timestamp.getTime();
            
            if (current - next <= 7 * 24 * 60 * 60 * 1000) { // 7 days
                streak++;
            } else {
                break;
            }
        }

        return Math.min(streak * 0.1, 0.5); // Max 50% bonus
    }

    private async updateVotingStreak(userId: string): Promise<void> {
        await this.progressTracker.trackActivity(userId, 'vote_cast');
    }

    private async checkProposalStatus(proposalId: number): Promise<void> {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.status !== 'active') return;

        const totalVotes = proposal.votesFor + proposal.votesAgainst;
        const now = Date.now();

        if (now >= proposal.endTime || totalVotes >= proposal.minimumQuorum) {
            // Finalize proposal
            proposal.status = proposal.votesFor > proposal.votesAgainst ? 'passed' : 'failed';
            this.proposals.set(proposalId, proposal);

            this.emit('proposalFinalized', {
                proposalId,
                status: proposal.status,
                votesFor: proposal.votesFor,
                votesAgainst: proposal.votesAgainst
            });

            if (proposal.status === 'passed') {
                await this.executeProposal(proposalId);
            }
        }
    }

    private async executeProposal(proposalId: number): Promise<void> {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.status !== 'passed') return;

        try {
            // Execute proposal logic here
            // This would depend on the type of proposal and executionData

            proposal.status = 'executed';
            this.proposals.set(proposalId, proposal);

            this.emit('proposalExecuted', { proposalId });
        } catch (error) {
            console.error(`Failed to execute proposal ${proposalId}:`, error);
            this.emit('proposalExecutionFailed', { proposalId, error });
        }
    }

    getProposal(proposalId: number): Proposal | undefined {
        return this.proposals.get(proposalId);
    }

    getActiveProposals(): Proposal[] {
        return Array.from(this.proposals.values())
            .filter(p => p.status === 'active')
            .sort((a, b) => b.startTime - a.startTime);
    }

    async cleanup(): Promise<void> {
        this.proposals.clear();
        this.removeAllListeners();
    }
} 