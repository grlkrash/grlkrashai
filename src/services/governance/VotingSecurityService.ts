import { ethers } from 'ethers';
import { IAgentRuntime } from '@elizaos/core';
import { TokenContract } from '../types/contracts';

interface VerifiedIdentity {
    discordId?: string;
    telegramId?: string;
    walletAddress: string;
    socialVerified: boolean;
    kycVerified: boolean;
    verificationTimestamp: number;
}

interface VotingPowerModifiers {
    baseMultiplier: number;
    socialBonus: number;
    kycBonus: number;
    holdingTimeBonus: number;
    nftBonus: number;
}

export class VotingSecurityService {
    private readonly MIN_HOLDING_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days
    private readonly MAX_VOTES_PER_PROPOSAL = 1;
    private readonly SUSPICIOUS_ACTIVITY_THRESHOLD = 5;
    private verifiedIdentities: Map<string, VerifiedIdentity> = new Map();
    private votingHistory: Map<string, Set<number>> = new Map(); // userId -> Set of proposalIds
    private suspiciousActivity: Map<string, number> = new Map();

    constructor(
        private runtime: IAgentRuntime,
        private tokenContract: TokenContract,
        private provider: ethers.providers.Provider
    ) {}

    async verifyIdentity(
        userId: string,
        walletAddress: string,
        discordId?: string,
        telegramId?: string
    ): Promise<boolean> {
        try {
            // Verify wallet ownership through signature
            const nonce = ethers.utils.randomBytes(32);
            const message = `Verify wallet ownership for governance: ${nonce}`;
            const signature = await this.provider.send('personal_sign', [message, walletAddress]);
            const recoveredAddress = ethers.utils.verifyMessage(message, signature);

            if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new Error('Wallet verification failed');
            }

            // Check for existing verifications with this wallet
            for (const [existingId, identity] of this.verifiedIdentities.entries()) {
                if (identity.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
                    throw new Error('Wallet already associated with another account');
                }
            }

            // Store verified identity
            this.verifiedIdentities.set(userId, {
                discordId,
                telegramId,
                walletAddress,
                socialVerified: false,
                kycVerified: false,
                verificationTimestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error('Identity verification failed:', error);
            return false;
        }
    }

    async verifySocialAccount(userId: string): Promise<boolean> {
        const identity = this.verifiedIdentities.get(userId);
        if (!identity) return false;

        try {
            // Implement social verification logic here
            // This could include OAuth verification for Discord/Telegram
            // and checking account age, activity, etc.
            identity.socialVerified = true;
            this.verifiedIdentities.set(userId, identity);
            return true;
        } catch (error) {
            console.error('Social verification failed:', error);
            return false;
        }
    }

    async verifyKYC(userId: string): Promise<boolean> {
        const identity = this.verifiedIdentities.get(userId);
        if (!identity) return false;

        try {
            // Implement KYC verification logic here
            // This could integrate with a KYC provider
            identity.kycVerified = true;
            this.verifiedIdentities.set(userId, identity);
            return true;
        } catch (error) {
            console.error('KYC verification failed:', error);
            return false;
        }
    }

    async calculateVotingPower(userId: string): Promise<number> {
        const identity = this.verifiedIdentities.get(userId);
        if (!identity) return 0;

        const modifiers: VotingPowerModifiers = {
            baseMultiplier: 1,
            socialBonus: identity.socialVerified ? 0.2 : 0,
            kycBonus: identity.kycVerified ? 0.3 : 0,
            holdingTimeBonus: await this.calculateHoldingTimeBonus(identity.walletAddress),
            nftBonus: await this.calculateNFTBonus(identity.walletAddress)
        };

        const tokenBalance = await this.tokenContract.balanceOf(identity.walletAddress);
        const baseVotingPower = tokenBalance.toNumber();

        return baseVotingPower * (1 + Object.values(modifiers).reduce((a, b) => a + b, 0));
    }

    async canVote(userId: string, proposalId: number): Promise<boolean> {
        // Check if user has already voted
        const userVotes = this.votingHistory.get(userId) || new Set();
        if (userVotes.has(proposalId)) {
            return false;
        }

        // Check for verified identity
        const identity = this.verifiedIdentities.get(userId);
        if (!identity) {
            return false;
        }

        // Check minimum holding time
        const holdingTime = await this.getHoldingTime(identity.walletAddress);
        if (holdingTime < this.MIN_HOLDING_TIME) {
            return false;
        }

        // Check for suspicious activity
        const suspiciousCount = this.suspiciousActivity.get(userId) || 0;
        if (suspiciousCount >= this.SUSPICIOUS_ACTIVITY_THRESHOLD) {
            return false;
        }

        return true;
    }

    async recordVote(userId: string, proposalId: number): Promise<void> {
        let userVotes = this.votingHistory.get(userId);
        if (!userVotes) {
            userVotes = new Set();
            this.votingHistory.set(userId, userVotes);
        }
        userVotes.add(proposalId);
    }

    private async calculateHoldingTimeBonus(walletAddress: string): Promise<number> {
        const holdingTime = await this.getHoldingTime(walletAddress);
        // Bonus of up to 0.5 based on holding time
        return Math.min(holdingTime / (180 * 24 * 60 * 60 * 1000), 0.5); // Max bonus after 180 days
    }

    private async calculateNFTBonus(walletAddress: string): Promise<number> {
        // Implement NFT holding checks
        // This could check for specific governance NFTs or other relevant tokens
        return 0;
    }

    private async getHoldingTime(walletAddress: string): Promise<number> {
        // Implementation would check token transfer events to determine first acquisition
        return 0;
    }

    async flagSuspiciousActivity(userId: string): Promise<void> {
        const count = (this.suspiciousActivity.get(userId) || 0) + 1;
        this.suspiciousActivity.set(userId, count);

        if (count >= this.SUSPICIOUS_ACTIVITY_THRESHOLD) {
            this.emit('suspiciousActivityThresholdReached', { userId, count });
        }
    }

    async cleanup(): Promise<void> {
        this.verifiedIdentities.clear();
        this.votingHistory.clear();
        this.suspiciousActivity.clear();
    }
} 