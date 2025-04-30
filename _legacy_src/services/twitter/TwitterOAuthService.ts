interface TwitterOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
}

interface TwitterOAuthSession {
    userAddress: string;
    username: string;
    state: string;
    codeVerifier: string;
    expiresAt: number;
}

export class TwitterOAuthService {
    private static instance: TwitterOAuthService;
    private sessions: Map<string, TwitterOAuthSession>;
    private readonly config: TwitterOAuthConfig;
    private readonly SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    private storage: NodeStorage;

    private constructor() {
        this.sessions = new Map();
        this.storage = new NodeStorage();
        
        // Debug log for environment variables
        console.log('TwitterOAuthService Debug:', {
            env: {
                TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID ? '✓ Present' : '✗ Missing',
                TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET ? '✓ Present' : '✗ Missing',
                TWITTER_REDIRECT_URI: process.env.TWITTER_REDIRECT_URI ? '✓ Present' : '✗ Missing'
            }
        });
        
        const redirectUri = 'http://localhost:5177/auth/twitter/callback';
        
        this.config = {
            clientId: process.env.TWITTER_CLIENT_ID || '',
            clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
            redirectUri,
            scope: ['tweet.read', 'users.read', 'offline.access']
        };

        // Log final config (without secret)
        console.log('TwitterOAuthService Config:', {
            clientId: this.config.clientId ? '✓ Set' : '✗ Empty',
            redirectUri: this.config.redirectUri,
            scope: this.config.scope.join(' ')
        });
    }

    public static getInstance(): TwitterOAuthService {
        if (!TwitterOAuthService.instance) {
            TwitterOAuthService.instance = new TwitterOAuthService();
        }
        return TwitterOAuthService.instance;
    }

    public async startOAuth(userAddress: string, username: string): Promise<CommandResult> {
        try {
            const state = this.generateRandomString(32);
            const codeVerifier = this.generateRandomString(64);
            const codeChallenge = await this.generateCodeChallenge(codeVerifier);
            
            const session: TwitterOAuthSession = {
                userAddress,
                username,
                state,
                codeVerifier,
                expiresAt: Date.now() + this.SESSION_TIMEOUT
            };
            
            this.sessions.set(state, session);
            this.cleanupSessions();

            const oauthUrl = new URL('https://twitter.com/i/oauth2/authorize');
            oauthUrl.searchParams.append('response_type', 'code');
            oauthUrl.searchParams.append('client_id', this.config.clientId);
            oauthUrl.searchParams.append('redirect_uri', this.config.redirectUri);
            oauthUrl.searchParams.append('scope', this.config.scope.join(' '));
            oauthUrl.searchParams.append('state', state);
            oauthUrl.searchParams.append('code_challenge', codeChallenge);
            oauthUrl.searchParams.append('code_challenge_method', 'S256');

            return {
                success: true,
                message: `🔐 TWITTER VERIFICATION STARTED\n\n` +
                    `Click to authorize: ${oauthUrl.toString()}\n` +
                    `This link will expire in 10 minutes.`
            };
        } catch (error) {
            console.error('OAuth start error:', error);
            return {
                success: false,
                message: "❌ OAUTH ERROR\n\nFailed to start Twitter verification.\nPlease try again later."
            };
        }
    }

    public async handleCallback(code: string, state: string): Promise<{ success: boolean; message: string; userAddress?: string }> {
        try {
            const session = this.sessions.get(state);
            if (!session) {
                return {
                    success: false,
                    message: "Session expired or invalid. Please try again."
                };
            }

            const tokenResponse = await this.exchangeCodeForToken(code);
            if (!tokenResponse?.access_token) {
                throw new Error('Failed to get access token');
            }

            const userInfo = await this.getUserInfo(tokenResponse.access_token);
            if (!userInfo?.data?.username) {
                throw new Error('Failed to get user info');
            }

            // Store the tokens securely
            this.storage.setItem(`twitter_access_token_${session.userAddress}`, tokenResponse.access_token);
            if (tokenResponse.refresh_token) {
                this.storage.setItem(`twitter_refresh_token_${session.userAddress}`, tokenResponse.refresh_token);
            }

            this.sessions.delete(state);

            return {
                success: true,
                message: "✅ TWITTER VERIFICATION SUCCESSFUL!\n\n" +
                    "Your Twitter account has been verified.\n" +
                    `Username: @${userInfo.data.username}`,
                userAddress: session.userAddress
            };
        } catch (error) {
            console.error('OAuth callback error:', error);
            return {
                success: false,
                message: "Failed to complete Twitter verification.\n" +
                    "Please try again later."
            };
        }
    }

    private async exchangeCodeForToken(code: string): Promise<any> {
        const codeVerifier = this.getStoredVerifier();
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.config.clientId);
        params.append('redirect_uri', this.config.redirectUri);
        params.append('code_verifier', codeVerifier);

        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`);
        }

        return response.json();
    }

    private async getUserInfo(accessToken: string): Promise<any> {
        const response = await fetch('https://api.twitter.com/2/users/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.statusText}`);
        }

        return response.json();
    }

    private generateRandomString(length: number): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const values = new Uint8Array(length);
        crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    }

    private async generateCodeChallenge(codeVerifier: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    private storeVerifier(verifier: string): void {
        // Store verifier in NodeStorage
        this.storage.setItem('twitter_oauth_verifier', verifier);
    }

    private getStoredVerifier(): string {
        return this.storage.getItem('twitter_oauth_verifier') || '';
    }

    private cleanupSessions(): void {
        const now = Date.now();
        for (const [state, session] of this.sessions.entries()) {
            if (now - session.expiresAt > 0) {
                this.sessions.delete(state);
            }
        }
    }

    public async verifyTweet(userAddress: string, tweetUrl: string): Promise<CommandResult> {
        try {
            // Extract tweet ID from URL
            const tweetId = this.extractTweetId(tweetUrl);
            if (!tweetId) {
                return {
                    status: {
                        message: "❌ INVALID TWEET URL\n\n" +
                                "Please provide a valid Twitter/X tweet URL."
                    },
                    error: 'Invalid tweet URL'
                };
            }

            // Get the tweet using Twitter API
            const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}`, {
                headers: {
                    'Authorization': `Bearer ${this.config.clientId}`
                }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    return {
                        status: {
                            message: "⚠️ RATE LIMIT EXCEEDED\n\n" +
                                    "Please wait a few minutes and try again."
                        },
                        error: 'Rate limit exceeded'
                    };
                }
                throw new Error(`Failed to fetch tweet: ${response.statusText}`);
            }

            const tweet = await response.json();
            
            // Verify the tweet content matches the verification code
            const session = Array.from(this.sessions.values())
                .find(s => s.userAddress === userAddress);

            if (!session) {
                return {
                    status: {
                        message: "❌ NO ACTIVE VERIFICATION REQUEST\n\n" +
                                "Please start the verification process first using the 'twitter' command."
                    },
                    error: 'No active verification request'
                };
            }

            // Check if the tweet contains the verification code
            if (!tweet.data?.text?.includes(session.state)) {
                return {
                    status: {
                        message: "❌ VERIFICATION FAILED\n\n" +
                                "The tweet does not contain the correct verification code.\n" +
                                "Please make sure you've posted the exact verification code."
                    },
                    error: 'Invalid verification code'
                };
            }

            // Clean up the session
            this.sessions.delete(session.state);

            return {
                status: {
                    message: "✅ TWITTER VERIFICATION SUCCESSFUL!\n\n" +
                            "Your Twitter account has been verified.\n" +
                            "Welcome to the resistance, brave rebel!"
                },
                verified: true
            };
        } catch (error) {
            console.error('Error verifying tweet:', error);
            return {
                status: {
                    message: "❌ VERIFICATION ERROR\n\n" +
                            "Failed to verify the tweet.\n" +
                            "Please try again later."
                },
                error: 'Failed to verify tweet'
            };
        }
    }

    private extractTweetId(url: string): string | null {
        try {
            const tweetUrl = new URL(url);
            const pathParts = tweetUrl.pathname.split('/');
            const statusIndex = pathParts.indexOf('status');
            if (statusIndex !== -1 && pathParts[statusIndex + 1]) {
                return pathParts[statusIndex + 1];
            }
            return null;
        } catch {
            return null;
        }
    }
} 