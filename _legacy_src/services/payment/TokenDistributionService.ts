import { IAgentRuntime } from '@elizaos/core';
import { ethers } from 'ethers';
import { TokenContract } from '../types/contracts';

interface DistributionConfig {
    communityRewardsWallet: string;
    holderChallengesWallet: string;
    airdropWallet: string;
    governanceWallet: string;
    allocations: {
        communityRewards: number;
        holderChallenges: number;
        airdrop: number;
        governance: number;
    };
}

interface DistributionEvent {
    type: 'community_rewards' | 'holder_challenge' | 'airdrop' | 'governance';
    amount: number;
    recipients: string[];
    timestamp: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class TokenDistributionService {
    private runtime: IAgentRuntime;
    private tokenContract: TokenContract;
    private distributionWallet: ethers.Wallet;
    private config: DistributionConfig;
    private pendingDistributions: DistributionEvent[] = [];
    private readonly BATCH_SIZE = 100;
    private readonly MIN_BALANCE_THRESHOLD = ethers.utils.parseEther("1000"); // Adjust as needed

    constructor(
        runtime: IAgentRuntime,
        tokenContract: TokenContract,
        config: DistributionConfig
    ) {
        this.runtime = runtime;
        this.tokenContract = tokenContract;
        this.config = config;
        
        // Initialize distribution wallet
        const privateKey = process.env.DISTRIBUTION_WALLET_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('Distribution wallet private key not configured');
        }
        this.distributionWallet = new ethers.Wallet(privateKey);
    }

    async initialize() {
        // Validate wallet balances
        await this.validateWalletBalances();
        
        // Start distribution monitoring
        this.startDistributionMonitoring();
    }

    private async validateWalletBalances() {
        const wallets = [
            { address: this.config.communityRewardsWallet, name: 'Community Rewards' },
            { address: this.config.holderChallengesWallet, name: 'Holder Challenges' },
            { address: this.config.airdropWallet, name: 'Airdrop' },
            { address: this.config.governanceWallet, name: 'Governance' }
        ];

        for (const wallet of wallets) {
            const balance = await this.tokenContract.balanceOf(wallet.address);
            if (balance.lt(this.MIN_BALANCE_THRESHOLD)) {
                console.warn(`Low balance warning for ${wallet.name} wallet: ${balance.toString()}`);
            }
        }
    }

    private startDistributionMonitoring() {
        setInterval(async () => {
            await this.processPendingDistributions();
        }, 5 * 60 * 1000); // Check every 5 minutes
    }

    async queueCommunityRewards(amount: number, recipients: string[]) {
        await this.queueDistribution('community_rewards', amount, recipients);
    }

    async queueHolderChallenge(amount: number, recipients: string[]) {
        await this.queueDistribution('holder_challenge', amount, recipients);
    }

    async queueAirdrop(amount: number, recipients: string[]) {
        await this.queueDistribution('airdrop', amount, recipients);
    }

    async queueGovernanceRewards(amount: number, recipients: string[]) {
        await this.queueDistribution('governance', amount, recipients);
    }

    private async queueDistribution(
        type: DistributionEvent['type'],
        amount: number,
        recipients: string[]
    ) {
        // Validate sufficient balance in source wallet
        const sourceWallet = this.getWalletForType(type);
        const balance = await this.tokenContract.balanceOf(sourceWallet);
        
        if (balance.lt(ethers.utils.parseEther(amount.toString()))) {
            throw new Error(`Insufficient balance in ${type} wallet`);
        }

        this.pendingDistributions.push({
            type,
            amount,
            recipients,
            timestamp: new Date(),
            status: 'pending'
        });

        if (this.pendingDistributions.length >= this.BATCH_SIZE) {
            await this.processPendingDistributions();
        }
    }

    private async processPendingDistributions() {
        const distributions = [...this.pendingDistributions];
        this.pendingDistributions = [];

        for (const distribution of distributions) {
            try {
                distribution.status = 'processing';
                
                const sourceWallet = this.getWalletForType(distribution.type);
                const amountPerRecipient = distribution.amount / distribution.recipients.length;

                // Process in smaller batches to avoid gas issues
                for (let i = 0; i < distribution.recipients.length; i += this.BATCH_SIZE) {
                    const batch = distribution.recipients.slice(i, i + this.BATCH_SIZE);
                    const amounts = batch.map(() => ethers.utils.parseEther(amountPerRecipient.toString()));
                    
                    await this.tokenContract.connect(sourceWallet).batchTransfer(batch, amounts);
                }

                distribution.status = 'completed';
                
                // Emit event for tracking
                this.runtime.emit('distribution:completed', {
                    type: distribution.type,
                    amount: distribution.amount,
                    recipientCount: distribution.recipients.length,
                    timestamp: new Date()
                });

            } catch (error) {
                console.error(`Failed to process ${distribution.type} distribution:`, error);
                distribution.status = 'failed';
                this.pendingDistributions.push(distribution);
            }
        }
    }

    private getWalletForType(type: DistributionEvent['type']): string {
        switch (type) {
            case 'community_rewards':
                return this.config.communityRewardsWallet;
            case 'holder_challenge':
                return this.config.holderChallengesWallet;
            case 'airdrop':
                return this.config.airdropWallet;
            case 'governance':
                return this.config.governanceWallet;
            default:
                throw new Error(`Unknown distribution type: ${type}`);
        }
    }

    async getDistributionStats(): Promise<{
        pending: number;
        completed: number;
        failed: number;
        totalDistributed: number;
    }> {
        const completed = this.pendingDistributions.filter(d => d.status === 'completed').length;
        const failed = this.pendingDistributions.filter(d => d.status === 'failed').length;
        const pending = this.pendingDistributions.filter(d => d.status === 'pending').length;
        
        const totalDistributed = this.pendingDistributions
            .filter(d => d.status === 'completed')
            .reduce((sum, d) => sum + d.amount, 0);

        return {
            pending,
            completed,
            failed,
            totalDistributed
        };
    }

    async cleanup() {
        // Process any remaining distributions before cleanup
        await this.processPendingDistributions();
    }
} 