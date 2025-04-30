import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { NodeStorage } from '../storage/NodeStorage';
import { IAgentRuntime } from '@elizaos/core';

interface YouTubeAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
}

interface YouTubeAuthSession {
    userAddress: string;
    state: string;
    expiresAt: number;
}

export class YouTubeAuthService {
    private static instance: YouTubeAuthService;
    private sessions: Map<string, YouTubeAuthSession>;
    private readonly config: YouTubeAuthConfig;
    private readonly SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    private storage: NodeStorage;
    private oauth2Client: OAuth2Client;
    private runtime: IAgentRuntime;

    private constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.sessions = new Map();
        this.storage = new NodeStorage();
        
        this.config = {
            clientId: process.env.YOUTUBE_CLIENT_ID || '',
            clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
            redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5177/auth/youtube/callback',
            scope: [
                'https://www.googleapis.com/auth/youtube.upload',
                'https://www.googleapis.com/auth/youtube',
                'https://www.googleapis.com/auth/youtube.force-ssl',
                'https://www.googleapis.com/auth/youtube.readonly'
            ]
        };

        this.oauth2Client = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            this.config.redirectUri
        );

        // Set credentials if they exist
        const tokens = this.getStoredTokens();
        if (tokens) {
            this.oauth2Client.setCredentials(tokens);
        }
    }

    public static getInstance(runtime: IAgentRuntime): YouTubeAuthService {
        if (!YouTubeAuthService.instance) {
            YouTubeAuthService.instance = new YouTubeAuthService(runtime);
        }
        return YouTubeAuthService.instance;
    }

    public getOAuth2Client(): OAuth2Client {
        return this.oauth2Client;
    }

    public async startAuth(userAddress: string): Promise<{ success: boolean; message: string; url?: string }> {
        try {
            const state = this.generateRandomString(32);
            
            const session: YouTubeAuthSession = {
                userAddress,
                state,
                expiresAt: Date.now() + this.SESSION_TIMEOUT
            };
            
            this.sessions.set(state, session);
            this.cleanupSessions();

            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: this.config.scope,
                state: state,
                prompt: 'consent'
            });

            return {
                success: true,
                message: `🎥 YOUTUBE AUTHORIZATION STARTED\n\n` +
                    `Click to authorize: ${authUrl}\n` +
                    `This link will expire in 10 minutes.`,
                url: authUrl
            };
        } catch (error) {
            console.error('OAuth start error:', error);
            return {
                success: false,
                message: "❌ OAUTH ERROR\n\nFailed to start YouTube authorization.\nPlease try again later."
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

            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // Store tokens securely
            this.storeTokens(tokens);
            this.sessions.delete(state);

            return {
                success: true,
                message: "✅ YOUTUBE AUTHORIZATION SUCCESSFUL!\n\n" +
                    "Your YouTube account has been authorized.\n" +
                    "You can now upload and manage videos.",
                userAddress: session.userAddress
            };
        } catch (error) {
            console.error('OAuth callback error:', error);
            return {
                success: false,
                message: "Failed to complete YouTube authorization.\n" +
                    "Please try again later."
            };
        }
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

    private storeTokens(tokens: any): void {
        this.storage.setItem('youtube_tokens', JSON.stringify(tokens));
    }

    public getStoredTokens(): any {
        const tokens = this.storage.getItem('youtube_tokens');
        return tokens ? JSON.parse(tokens) : null;
    }

    private cleanupSessions(): void {
        const now = Date.now();
        for (const [state, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.sessions.delete(state);
            }
        }
    }

    public async cleanup(): Promise<void> {
        this.sessions.clear();
    }
} 