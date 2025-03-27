// Browser-compatible Twitter auth service
import { TwitterService } from './TwitterService';

export interface TwitterSession {
    userId: string;
    username: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

interface VerificationResult {
    success: boolean;
    verificationCode?: string;
}

interface VerificationTweetResult {
    success: boolean;
    tweetId?: string;
}

interface VerificationRequest {
    code: string;
    expiresAt: Date;
    username: string;
    userAddress: string;
}

export class TwitterAuthService {
    private static instance: TwitterAuthService;
    private readonly VERIFICATION_REQUEST_DURATION = 10 * 60 * 1000; // 10 minutes
    private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private verificationRequests: Map<string, VerificationRequest>;
    private sessions: Map<string, TwitterSession> = new Map();
    private twitterService: TwitterService;
    private username: string | null = null;
    private verified: boolean = false;

    private constructor() {
        this.twitterService = TwitterService.getInstance();
        this.verificationRequests = new Map();
    }

    private generateVerificationCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    public static getInstance(): TwitterAuthService {
        if (!TwitterAuthService.instance) {
            TwitterAuthService.instance = new TwitterAuthService();
        }
        return TwitterAuthService.instance;
    }

    public async startVerification(username: string, userAddress: string): Promise<VerificationResult> {
        if (!username || !userAddress) {
            return { success: false };
        }

        // Generate a verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store the verification request
        this.verificationRequests.set(userAddress, {
            code: verificationCode,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes expiration
            username,
            userAddress
        });

        return {
            success: true,
            verificationCode
        };
    }

    public getVerificationRequest(userAddress: string): VerificationRequest | null {
        const request = this.verificationRequests.get(userAddress);
        
        // Check if request exists and hasn't expired
        if (request && request.expiresAt > new Date()) {
            console.log('[DEBUG] Found valid verification request:', {
                userAddress,
                code: request.code,
                expiresAt: request.expiresAt
            });
            return request;
        }
        
        // If request has expired, remove it
        if (request) {
            console.log('[DEBUG] Removing expired verification request:', {
                userAddress,
                expiresAt: request.expiresAt
            });
            this.verificationRequests.delete(userAddress);
        }
        
        return null;
    }

    public async verifyTwitterAccount(username: string, verificationCode: string): Promise<{ success: boolean; message: string }> {
        try {
            const twitterService = TwitterService.getInstance();
            const result = await twitterService.findVerificationTweet(username, verificationCode);
            
            if (result.error) {
                return {
                    success: false,
                    message: result.status.message
                };
            }

            if (result.id) {
                // Get the verification request for this user
                const request = Array.from(this.verificationRequests.values())
                    .find(req => req.username.toLowerCase() === username.toLowerCase() && req.code === verificationCode);
                
                if (!request) {
                    return {
                        success: false,
                        message: "❌ NO ACTIVE VERIFICATION REQUEST!\n\n" +
                                "Please set your Twitter handle first using: 'twitter <username>'"
                    };
                }

                // Create a new session
                const session: TwitterSession = {
                    userId: request.userAddress,
                    username: username,
                    accessToken: 'temp_token',
                    refreshToken: 'temp_refresh_token',
                    expiresAt: new Date(Date.now() + this.SESSION_DURATION)
                };

                // Store the session
                this.sessions.set(request.userAddress, session);
     
                // Clean up the verification request
                this.verificationRequests.delete(request.userAddress);

                return {
                    success: true,
                    message: "✅ VERIFICATION SUCCESSFUL!\n\n" +
                            "Your digital presence has been authenticated!\n" +
                            "Welcome to the resistance, brave rebel."
                };
            }

            return {
                success: false,
                message: "❌ VERIFICATION FAILED!\n\n" +
                        "No verification tweet found.\n" +
                        "Please ensure you've posted the tweet and try again."
            };
        } catch (error) {
            console.error('[DEBUG] Verification error:', error);
            return {
                success: false,
                message: "⚠️ VERIFICATION ERROR!\n\n" +
                        "An unexpected error occurred.\n" +
                        "The resistance will try again."
            };
        }
    }

    public isVerified(userAddress: string): boolean {
        const session = this.sessions.get(userAddress);
        return !!(session && session.expiresAt > new Date());
    }

    public getTwitterSession(userAddress: string): TwitterSession | null {
        const session = this.sessions.get(userAddress);
        if (!session || session.expiresAt < new Date()) {
            return null;
        }
        return session;
    }

    public async findVerificationTweet(userAddress: string): Promise<VerificationTweetResult> {
        const request = this.verificationRequests.get(userAddress);
        if (!request || request.expiresAt < new Date()) {
            console.log('[DEBUG] No valid verification request found for address:', userAddress);
            return { success: false };
        }

        try {
            const tweets = await this.twitterService.getRecentTweets(request.username);
            const verificationTweet = tweets.find(tweet => tweet.text.includes(request.code));

            if (!verificationTweet) {
                console.log('[DEBUG] No verification tweet found for user:', request.username);
                return { success: false };
            }

            console.log('[DEBUG] Found verification tweet:', {
                username: request.username,
                tweetId: verificationTweet.id
            });

            return {
                success: true,
                tweetId: verificationTweet.id
            };
        } catch (error) {
            console.error('Error finding verification tweet:', error instanceof Error ? error.message : 'Unknown error');
            return { success: false };
        }
    }

    public async verifyTweet(username: string, verificationCode: string): Promise<VerificationTweetResult> {
        try {
            const tweets = await this.twitterService.getRecentTweets(username);
            const verificationTweet = tweets.find(tweet => tweet.text.includes(verificationCode));

            if (!verificationTweet) {
                console.log('[DEBUG] No verification tweet found for user:', username);
                return { success: false };
            }

            console.log('[DEBUG] Found verification tweet:', {
                username,
                tweetId: verificationTweet.id
            });

            return {
                success: true,
                tweetId: verificationTweet.id
            };
        } catch (error) {
            console.error('Error finding verification tweet:', error instanceof Error ? error.message : 'Unknown error');
            return { success: false };
        }
    }

    public async isVerified(command?: string): Promise<boolean> {
        return this.verified;
    }

    public async getVerifiedUsername(): Promise<string | null> {
        return this.username;
    }

    public setVerified(username: string): void {
        this.username = username;
        this.verified = true;
    }

    public clearVerification(): void {
        this.username = null;
        this.verified = false;
    }

    public async verifyTwitter(verificationCode: string): Promise<boolean> {
        try {
            if (!this.username) {
                return false;
            }
            const found = await this.twitterService.findVerificationTweet(this.username, verificationCode);
            if (found) {
                this.verified = true;
            }
            return found;
        } catch (error) {
            console.error('Error verifying Twitter:', error);
            return false;
        }
    }
} 