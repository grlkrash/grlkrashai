import { ethers } from 'ethers';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

interface VerificationRequest {
    userId: string;
    platform: 'discord' | 'telegram';
    walletAddress: string;
    nonce: string;
    timestamp: number;
}

export class WalletVerificationService {
    private redis: Redis;
    private readonly NONCE_EXPIRY = 600; // 10 minutes
    private readonly JWT_SECRET: string;
    private readonly RATE_LIMIT_ATTEMPTS = 5;
    private readonly RATE_LIMIT_WINDOW = 3600; // 1 hour

    constructor(redisUrl: string, jwtSecret: string) {
        this.redis = new Redis(redisUrl);
        this.JWT_SECRET = jwtSecret;
    }

    /**
     * Generate a new verification nonce for a wallet address
     */
    async generateNonce(userId: string, platform: 'discord' | 'telegram', walletAddress: string): Promise<string> {
        // Check rate limiting
        const attempts = await this.redis.incr(`ratelimit:${userId}:${platform}`);
        if (attempts === 1) {
            await this.redis.expire(`ratelimit:${userId}:${platform}`, this.RATE_LIMIT_WINDOW);
        }
        if (attempts > this.RATE_LIMIT_ATTEMPTS) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }

        // Check if wallet is already verified
        const existingWallet = await this.redis.get(`wallet:${walletAddress}`);
        if (existingWallet) {
            throw new Error('This wallet address is already verified for another user.');
        }

        // Generate and store nonce
        const nonce = uuidv4();
        const verificationRequest: VerificationRequest = {
            userId,
            platform,
            walletAddress,
            nonce,
            timestamp: Date.now()
        };

        await this.redis.setex(
            `nonce:${nonce}`,
            this.NONCE_EXPIRY,
            JSON.stringify(verificationRequest)
        );

        return nonce;
    }

    /**
     * Generate deep links for popular mobile wallets
     */
    generateWalletDeepLinks(walletAddress: string, message: string): { [key: string]: string } {
        // URL encode the message
        const encodedMessage = encodeURIComponent(message);
        
        return {
            metamask: `metamask://wc?uri=${encodedMessage}`,
            trustwallet: `trustwallet://wc?uri=${encodedMessage}`,
            rainbow: `rainbow://wc?uri=${encodedMessage}`,
            coinbase: `cbwallet://wc?uri=${encodedMessage}`, // Coinbase Wallet
            coinbasepro: `coinbasepro://wc?uri=${encodedMessage}`, // Coinbase Pro
            // Universal fallback for Coinbase
            coinbaseuniversal: `https://go.cb-w.com/wc?uri=${encodedMessage}`,
            // Add more wallet deep links as needed
        };
    }

    /**
     * Generate a mobile-friendly signing link
     */
    generateMobileSigningLink(walletAddress: string, nonce: string): string {
        const message = this.generateMessage(walletAddress, nonce);
        const encodedMessage = encodeURIComponent(message);
        
        // Create a universal deep link that most wallets can handle
        // Include Coinbase universal fallback in the chain
        return `ethereum:sign?message=${encodedMessage}&fallback=https://go.cb-w.com/sign?message=${encodedMessage}`;
    }

    /**
     * Generate the message to be signed with mobile-friendly format
     */
    generateMessage(walletAddress: string, nonce: string): string {
        const timestamp = Date.now();
        return [
            `Verify wallet ${walletAddress} for CDP Platform`,
            `Nonce: ${nonce}`,
            `Timestamp: ${timestamp}`,
            '', // Empty line for better mobile display
            'By signing this message, you confirm that you own this wallet.'
        ].join('\n');
    }

    /**
     * Verify a signature and link wallet to user
     */
    async verifySignature(nonce: string, signature: string): Promise<string> {
        // Get verification request
        const requestData = await this.redis.get(`nonce:${nonce}`);
        if (!requestData) {
            throw new Error('Invalid or expired nonce.');
        }

        const request: VerificationRequest = JSON.parse(requestData);
        
        // Check if nonce is expired
        if (Date.now() - request.timestamp > this.NONCE_EXPIRY * 1000) {
            await this.redis.del(`nonce:${nonce}`);
            throw new Error('Verification request expired.');
        }

        // Generate the message that was signed
        const message = this.generateMessage(request.walletAddress, nonce);
        
        // Recover the address from the signature
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== request.walletAddress.toLowerCase()) {
            throw new Error('Invalid signature.');
        }

        // Link wallet to user
        await this.redis.set(`user:${request.userId}:${request.platform}:wallet`, request.walletAddress);
        await this.redis.set(`wallet:${request.walletAddress}`, `${request.userId}:${request.platform}`);

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: request.userId,
                platform: request.platform,
                walletAddress: request.walletAddress
            },
            this.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Cleanup nonce
        await this.redis.del(`nonce:${nonce}`);

        return token;
    }

    /**
     * Get wallet address for a user
     */
    async getWalletAddress(userId: string, platform: 'discord' | 'telegram'): Promise<string | null> {
        return this.redis.get(`user:${userId}:${platform}:wallet`);
    }

    /**
     * Unlink wallet from user
     */
    async unlinkWallet(userId: string, platform: 'discord' | 'telegram'): Promise<void> {
        const walletAddress = await this.getWalletAddress(userId, platform);
        if (walletAddress) {
            await this.redis.del(`user:${userId}:${platform}:wallet`);
            await this.redis.del(`wallet:${walletAddress}`);
        }
    }
} 