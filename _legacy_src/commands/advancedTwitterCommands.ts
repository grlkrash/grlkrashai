import { TwitterAuthService } from '../services/TwitterAuthService';
import { TwitterService } from '../services/TwitterService';
import { CommandContext, CommandResult, createCommandResult } from '../types/commands';

// Admin roles
export enum TwitterRole {
    BASIC = 'BASIC',
    ADMIN = 'ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN'
}

// Auto mode configuration
interface AutoModeConfig {
    enabled: boolean;
    replyThreshold: number;
    engagementInterval: number;
    autoReplyEnabled: boolean;
    autoFollowEnabled: boolean;
    autoAnalyticsEnabled: boolean;
    lastRun: Date;
    // GRLKRASH-specific settings
    targetAccounts: string[];
    communityGoals: {
        growthTarget: number;
        engagementTarget: number;
        contentThemes: string[];
    };
    contentStrategy: {
        postFrequency: number; // posts per day
        replyRate: number; // % of mentions to reply to
        retweetRate: number; // % of relevant content to retweet
    };
}

interface EngagementMetrics {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
}

interface FollowerAnalytics {
    activeFollowers: number;
    engagementRate: number;
    topEngagers: string[];
    recentGrowth: number;
}

export const ADMIN_PATTERNS = {
    TWEET: {
        COMPOSE: /^admin tweet (.+)/i,
        THREAD: /^admin thread\n([\s\S]+)/i,
        SCHEDULE: /^admin schedule tweet "(.*)" for (.+)/i
    },
    ANALYZE: {
        FOLLOWERS: /^admin analyze followers/i,
        ENGAGEMENT: /^admin analyze engagement(?: for last (\d+) days)?/i,
        ACCOUNT: /^admin analyze @(\w+)/i
    },
    ENGAGE: {
        AUTO_REPLY: /^admin set auto-reply "(.*)" for "(.*)"$/i,
        MASS_REPLY: /^admin reply to engaging accounts "(.*)"$/i,
        FOLLOW_BACK: /^admin follow engaging accounts(?: with min engagement (\d+))?$/i,
        TARGET_COMMUNITY: /^admin target @(\w+)(?: with engagement (\d+))?$/i,
        REMOVE_TARGET: /^admin untarget @(\w+)$/i
    },
    AUTO: {
        CONFIGURE: /^admin auto configure (targetAccounts|communityGoals|contentStrategy) (.+)$/i,
        STATUS: /^admin auto status$/i,
        GOALS: /^admin auto goals$/i
    },
    MANAGE: {
        ADD_ADMIN: /^admin add @(\w+) as (admin|super_admin)$/i,
        REMOVE_ADMIN: /^admin remove @(\w+)$/i,
        LIST_ADMINS: /^admin list$/i
    }
};

export class AdvancedTwitterCommands {
    private static instance: AdvancedTwitterCommands;
    private twitterAuth: TwitterAuthService;
    private twitterService: TwitterService;
    private autoReplies: Map<string, string>;
    private adminList: Map<string, TwitterRole>;
    private autoConfig: AutoModeConfig;

    constructor(twitterAuth: TwitterAuthService) {
        this.twitterAuth = twitterAuth;
        this.twitterService = TwitterService.getInstance();
        this.autoReplies = new Map();
        this.adminList = new Map();
        
        // Initialize auto mode config
        this.autoConfig = {
            enabled: false,
            replyThreshold: 2,
            engagementInterval: 12 * 60 * 60 * 1000, // 12 hours
            autoReplyEnabled: false,
            autoFollowEnabled: false,
            autoAnalyticsEnabled: false,
            lastRun: new Date(),
            // GRLKRASH-specific settings
            targetAccounts: [],
            communityGoals: {
                growthTarget: 0,
                engagementTarget: 0,
                contentThemes: []
            },
            contentStrategy: {
                postFrequency: 0, // posts per day
                replyRate: 0, // % of mentions to reply to
                retweetRate: 0 // % of relevant content to retweet
            }
        };
        
        // Initialize with super admin from env
        const superAdmin = process.env.TWITTER_SUPER_ADMIN;
        if (superAdmin) {
            this.adminList.set(superAdmin, TwitterRole.SUPER_ADMIN);
        }

        // Start auto mode loop if enabled
        this.startAutoMode();
    }

    public static getInstance(): AdvancedTwitterCommands {
        if (!AdvancedTwitterCommands.instance) {
            AdvancedTwitterCommands.instance = new AdvancedTwitterCommands(TwitterAuthService.getInstance());
        }
        return AdvancedTwitterCommands.instance;
    }

    private async checkAuthorization(userAddress: string, requiredRole: TwitterRole = TwitterRole.ADMIN): Promise<boolean> {
        const session = await this.twitterAuth.getTwitterSession(userAddress);
        if (!session) return false;

        const userRole = this.adminList.get(session.username);
        if (!userRole) return false;

        if (requiredRole === TwitterRole.SUPER_ADMIN) {
            return userRole === TwitterRole.SUPER_ADMIN;
        }

        return userRole === TwitterRole.ADMIN || userRole === TwitterRole.SUPER_ADMIN;
    }

    // Tweeting Commands
    public async composeTweet(userAddress: string, content: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "ACCESS DENIED! Only resistance leaders can broadcast messages! Keep fighting and unlocking Memory Crystals to earn your rank!",
                success: false
            };
        }

        try {
            const tweetUrl = await this.twitterService.tweet(content);
            return {
                message: `MESSAGE BROADCASTED TO THE RESISTANCE!\nRally point: ${tweetUrl}\nLet's amplify our Memory Crystals and shake up their system!`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `BROADCAST JAMMED! System interference: ${error.message}\nThe resistance never gives up - we'll try again!`,
                success: false
            };
        }
    }

    public async verifyTwitter(userAddress: string): Promise<CommandResult> {
        try {
            const session = await this.twitterAuth.getTwitterSession(userAddress);
            if (!session) {
                return {
                    message: "REBEL! You need to establish your digital presence! Let's get you verified for the resistance!",
                    success: false
                };
            }

            return {
                message: `IDENTITY CONFIRMED! You're verified as @${session.username}!\nTime to unleash our Memory Crystals and fight the power!`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `VERIFICATION DISRUPTED! System error: ${error.message}\nThe resistance will try again!`,
                success: false
            };
        }
    }

    public async createThread(userAddress: string, tweets: string[]): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "ACCESS DENIED! Only resistance leaders can create message chains! Keep fighting to earn your rank!",
                success: false
            };
        }

        try {
            const tweetUrls = await this.twitterService.createThread(tweets);
            return {
                message: `RESISTANCE CHAIN MESSAGE DEPLOYED!\nFirst signal: ${tweetUrls[0]}\nLet's amplify our voice against the system!`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `CHAIN DISRUPTED! System interference: ${error.message}\nThe resistance will regroup and try again!`,
                success: false
            };
        }
    }

    // Analytics Commands
    public async analyzeFollowers(userAddress: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "❌ Not authorized",
                success: false
            };
        }

        try {
            const analytics = await this.twitterService.getFollowerAnalytics();
            return {
                message: `📊 Follower Analytics:\n` +
                        `Active Followers: ${analytics.activeFollowers}\n` +
                        `Engagement Rate: ${analytics.engagementRate}%\n` +
                        `Recent Growth: ${analytics.recentGrowth}%\n` +
                        `Top Engagers: ${analytics.topEngagers.join(', ')}`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `❌ Failed to analyze followers: ${error.message}`,
                success: false
            };
        }
    }

    public async analyzeEngagement(userAddress: string, days: number = 30): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "❌ Not authorized",
                success: false
            };
        }

        try {
            const metrics = await this.twitterService.getEngagementMetrics(days);
            return {
                message: `📈 Engagement Metrics (Last ${days} days):\n` +
                        `Likes: ${metrics.likes}\n` +
                        `Retweets: ${metrics.retweets}\n` +
                        `Replies: ${metrics.replies}\n` +
                        `Impressions: ${metrics.impressions}`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `❌ Failed to analyze engagement: ${error.message}`,
                success: false
            };
        }
    }

    public async getAnalytics(userAddress: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "ACCESS DENIED! Resistance intel is for verified members only! Keep collecting Memory Crystals and fighting!",
                success: false
            };
        }

        try {
            const followerStats = await this.twitterService.getFollowerAnalytics();
            const engagementStats = await this.twitterService.getEngagementMetrics();
            
            return {
                message: `RESISTANCE INTEL REPORT!\n
                Rebel Force Size: ${followerStats.total} fighters\n
                Recruitment Rate: ${followerStats.growth}% this cycle\n
                Movement Strength: ${engagementStats.rate}%\n
                Keep sharing Memory Crystals to disrupt their system!`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `INTEL BLOCKED! System interference: ${error.message}\nThe resistance will hack another way in!`,
                success: false
            };
        }
    }

    // Engagement Commands
    public async setAutoReply(userAddress: string, trigger: string, response: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "❌ Not authorized",
                success: false
            };
        }

        try {
            this.autoReplies.set(trigger.toLowerCase(), response);
            return {
                message: `✅ Auto-reply set:\nTrigger: "${trigger}"\nResponse: "${response}"`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `❌ Failed to set auto-reply: ${error.message}`,
                success: false
            };
        }
    }

    public async replyToEngaging(userAddress: string, message: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "❌ Not authorized",
                success: false
            };
        }

        try {
            const engagingUsers = await this.twitterService.getEngagingUsers();
            const replies = await this.twitterService.replyToUsers(engagingUsers, message);
            
            return {
                message: `✨ Replied to ${replies.length} engaging accounts`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `❌ Failed to send replies: ${error.message}`,
                success: false
            };
        }
    }

    // Admin Management
    public async addAdmin(userAddress: string, username: string, role: TwitterRole): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress, TwitterRole.SUPER_ADMIN)) {
            return {
                message: "❌ Only super admins can add new admins",
                success: false
            };
        }

        try {
            this.adminList.set(username, role);
            return {
                message: `✅ Added @${username} as ${role.toLowerCase()}`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `❌ Failed to add admin: ${error.message}`,
                success: false
            };
        }
    }

    public async listAdmins(userAddress: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "❌ Not authorized",
                success: false
            };
        }

        const adminList = Array.from(this.adminList.entries())
            .map(([username, role]) => `@${username}: ${role}`)
            .join('\n');

        return {
            message: `👥 Admin List:\n${adminList}`,
            success: true
        };
    }

    private async startAutoMode(): Promise<void> {
        setInterval(async () => {
            if (!this.autoConfig.enabled) return;
            
            const now = new Date();
            if (now.getTime() - this.autoConfig.lastRun.getTime() < this.autoConfig.engagementInterval) {
                return;
            }

            try {
                if (this.autoConfig.autoAnalyticsEnabled) {
                    await this.runAutoAnalytics();
                }

                if (this.autoConfig.autoReplyEnabled) {
                    await this.runAutoReplies();
                }

                if (this.autoConfig.autoFollowEnabled) {
                    await this.runAutoFollow();
                }

                this.autoConfig.lastRun = now;
            } catch (error) {
                console.error('Auto mode error:', error);
            }
        }, 60000); // Check every minute
    }

    private async runAutoAnalytics(): Promise<void> {
        const metrics = await this.twitterService.getEngagementMetrics(1); // Last 24 hours
        const analytics = await this.twitterService.getFollowerAnalytics();
        
        // Log analytics for monitoring
        console.log('Auto Analytics Report:', {
            date: new Date().toISOString(),
            metrics,
            analytics
        });
    }

    private async runAutoReplies(): Promise<void> {
        const engagingUsers = await this.twitterService.getEngagingUsers(this.autoConfig.replyThreshold);
        
        for (const [trigger, response] of this.autoReplies.entries()) {
            await this.twitterService.replyToUsers(engagingUsers, response);
        }
    }

    private async runAutoFollow(): Promise<void> {
        await this.twitterService.getEngagingUsers(this.autoConfig.replyThreshold);
    }

    // Auto Mode Commands
    public async toggleAutoMode(userAddress: string, enabled: boolean): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress, TwitterRole.SUPER_ADMIN)) {
            return {
                message: "ACCESS DENIED! Only resistance leaders can control the autonomous systems! Keep collecting Memory Crystals to rise in rank!",
                success: false
            };
        }

        this.autoConfig.enabled = enabled;
        return {
            message: `AUTONOMOUS SYSTEMS ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}! The resistance evolves through our Memory Crystals!`,
            success: true
        };
    }

    public async configureAutoMode(
        userAddress: string,
        config: Partial<AutoModeConfig>
    ): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress, TwitterRole.SUPER_ADMIN)) {
            return {
                message: "❌ Only super admins can configure auto mode",
                success: false
            };
        }

        this.autoConfig = { ...this.autoConfig, ...config };
        return {
            message: "✅ Auto mode configuration updated",
            success: true
        };
    }

    public async getAutoModeStatus(userAddress: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "ACCESS DENIED! System status is for resistance members only! Keep collecting Memory Crystals to join us!",
                success: false
            };
        }

        // Auto mode status
        const config = TwitterService.getInstance().getAutoConfig();
        if (!config) {
            return createCommandResult('❌ AUTO MODE NOT CONFIGURED\n\nPlease configure auto mode first.');
        }

        const nextRunTime = new Date(config.lastRun.getTime() + config.engagementInterval);
        const status = `AUTO MODE STATUS:\n\n` +
                      `Enabled: ${config.enabled ? 'YES' : 'NO'}\n` +
                      `Last Run: ${config.lastRun.toLocaleString()}\n` +
                      `Next Run: ${nextRunTime.toLocaleString()}\n` +
                      `Reply Threshold: ${config.replyThreshold}\n` +
                      `Auto Reply: ${config.autoReplyEnabled ? 'ON' : 'OFF'}\n` +
                      `Auto Follow: ${config.autoFollowEnabled ? 'ON' : 'OFF'}\n` +
                      `Auto Analytics: ${config.autoAnalyticsEnabled ? 'ON' : 'OFF'}`;

        return createCommandResult(status);
    }

    public async engageUsers(userAddress: string): Promise<CommandResult> {
        if (!await this.checkAuthorization(userAddress)) {
            return {
                message: "ACCESS DENIED! Only resistance leaders can coordinate mass actions! Keep collecting Memory Crystals to earn your rank!",
                success: false
            };
        }

        try {
            const engagingUsers = await this.twitterService.getEngagingUsers();
            if (engagingUsers.length === 0) {
                return {
                    message: "ALL QUIET ON THE DIGITAL FRONT! No active resistance signals detected! Time to share more Memory Crystals!",
                    success: true
                };
            }

            const userIds = engagingUsers.map(user => user.id);
            const message = "Your energy empowers our Memory Crystals! Together we'll crash their system!";
            await this.twitterService.replyToUsers(userIds, message);

            return {
                message: `MASS SIGNAL SENT! Connected with ${engagingUsers.length} fellow rebels! Our Memory Crystals grow stronger!`,
                success: true
            };
        } catch (error: any) {
            return {
                message: `SIGNAL JAMMED! System interference: ${error.message}\nThe resistance never stops - we'll try again!`,
                success: false
            };
        }
    }

    public async getCommunityStats(): Promise<{
        members: number;
        discussions: number;
        engagement: number;
        growth: number;
    }> {
        // TODO: Implement actual community stats fetching
        return {
            members: 0,
            discussions: 0,
            engagement: 0,
            growth: 0
        };
    }

    public async startAutoEngagement(): Promise<boolean> {
        // TODO: Implement auto-engagement logic
        return true;
    }

    public async setAlert(type: string, threshold: string): Promise<boolean> {
        // TODO: Implement alert system
        return true;
    }
}

// Basic Twitter commands
export const basicTwitterCommands = {
    twitter: async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isWalletConnected) {
            return createCommandResult('❌ WALLET NOT CONNECTED\n\nPlease connect your wallet first.');
        }

        if (args.length === 0) {
            return createCommandResult('❌ MISSING USERNAME\n\nPlease provide your Twitter/X username:\ntwitter @username');
        }

        const username = args[0].replace('@', '');
        const result = await TwitterAuthService.getInstance().startVerification(username, context.userAddress);
        
        if (result.success) {
            return createCommandResult(
                "ATTENTION DIGITAL REBEL\n\n" +
                `Your verification code is: ${result.verificationCode}\n\n` +
                "INSTRUCTIONS:\n" +
                "1. Post this code to your feed\n" +
                "2. Wait for signal detection (30-60 seconds)\n" +
                "3. Run 'verify' to confirm your identity\n\n" +
                "The resistance awaits your signal."
            );
        }

        return createCommandResult(
            "❌ VERIFICATION INITIALIZATION FAILED\n\n" +
            "Could not start verification process.\n" +
            "Please ensure your username is correct and try again."
        );
    },

    verify: async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isWalletConnected) {
            return createCommandResult('❌ WALLET NOT CONNECTED\n\nPlease connect your wallet first.');
        }

        if (args.length < 1) {
            return {
                status: { 
                    message: "⚠️ VERIFICATION METHOD REQUIRED\n\n" +
                            "Please choose a verification method:\n" +
                            "1. Phone: verify phone <number>\n" +
                            "2. Twitter: Use 'twitter' command or verify <tweet-url>\n\n" +
                            "Example: verify phone +1234567890"
                }
            };
        }

        // Handle Twitter URL verification
        if (args[0].includes('twitter.com')) {
            const tweetUrl = args[0];
            const result = await TwitterAuthService.getInstance().verifyTweet(context.userAddress, tweetUrl);
            return {
                status: { message: result.message },
                verified: result.success
            };
        }

        return {
            status: { message: '❌ Invalid verification method. Please use a Twitter URL.' }
        };
    },

    tweet: async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isWalletConnected) {
            return createCommandResult('❌ WALLET NOT CONNECTED\n\nPlease connect your wallet first.');
        }

        if (!context.isTwitterVerified) {
            return createCommandResult('❌ TWITTER NOT VERIFIED\n\nPlease verify your Twitter account first.');
        }

        const isSuperAdmin = context.twitterUsername === process.env.TWITTER_SUPER_ADMIN;
        if (!isSuperAdmin) {
            return {
                status: { message: '❌ Only super admins can post tweets.' }
            };
        }

        if (args.length === 0) {
            return createCommandResult('❌ MISSING TWEET CONTENT\n\nPlease provide the content to tweet.');
        }

        const tweetContent = args.join(' ');
        if (!tweetContent) {
            return createCommandResult('❌ MISSING TWEET CONTENT\n\nPlease provide the content to tweet.');
        }

        try {
            await TwitterService.getInstance().tweet(tweetContent);
            return createCommandResult('✅ TWEET POSTED\n\nYour message has been broadcast to the digital realm.');
        } catch (error) {
            return createCommandResult(
                '❌ TWEET FAILED\n\n' +
                'Could not post your tweet. Please try again later.',
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
};

export const advancedTwitterCommands = {
    // Analytics Commands
    'analyze': async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isTwitterVerified) {
            return {
                status: { message: '❌ Please verify your Twitter account first!' }
            };
        }

        if (args.length === 0) {
            return {
                status: { message: '❌ Please specify what to analyze: followers, engagement, or @username' }
            };
        }

        const target = args[0].toLowerCase();
        if (target === 'followers') {
            const analytics = await TwitterService.getInstance().getFollowerAnalytics();
            return {
                status: { 
                    message: `📊 FOLLOWER ANALYTICS\n\n` +
                            `Active Followers: ${analytics.activeFollowers}\n` +
                            `Engagement Rate: ${analytics.engagementRate}%\n` +
                            `Recent Growth: ${analytics.recentGrowth > 0 ? '+' : ''}${analytics.recentGrowth}\n` +
                            `Top Engagers: ${analytics.topEngagers.join(', ')}`
                }
            };
        }

        if (target === 'engagement') {
            const days = args[1] ? parseInt(args[1]) : 7;
            const metrics = await TwitterService.getInstance().getEngagementMetrics(days);
            return {
                status: { 
                    message: `📈 ENGAGEMENT METRICS (${days} days)\n\n` +
                            `Likes: ${metrics.likes}\n` +
                            `Retweets: ${metrics.retweets}\n` +
                            `Replies: ${metrics.replies}\n` +
                            `Impressions: ${metrics.impressions}`
                }
            };
        }

        return {
            status: { message: '❌ Invalid analysis target. Use: followers, engagement, or @username' }
        };
    },

    // Engagement Commands
    'engage': async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isTwitterVerified) {
            return {
                status: { message: '❌ Please verify your Twitter account first!' }
            };
        }

        const result = await TwitterService.getInstance().engageWithFollowers();
        return {
            status: { 
                message: `✨ ENGAGEMENT COMPLETE\n\n` +
                        `Liked: ${result.likes} tweets\n` +
                        `Replied: ${result.replies} times\n` +
                        `New Follows: ${result.newFollows}`
            }
        };
    },

    // Auto Mode Commands
    'auto': async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isTwitterVerified) {
            return {
                status: {
                    message: "⚠️ VERIFICATION REQUIRED\n\nPlease verify your Twitter account first."
                }
            };
        }

        const subCommand = args[0]?.toLowerCase();
        const remainingArgs = args.slice(1);

        try {
            const response = await TwitterService.getInstance().executeCommand(subCommand, remainingArgs);
            return {
                status: { message: response }
            };
        } catch (error) {
            return {
                status: { 
                    message: error instanceof Error ? error.message : 'Unknown error occurred'
                },
                error: 'Command execution failed'
            };
        }
    },

    // Admin Management
    'admin': async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isTwitterVerified) {
            return {
                status: { message: '❌ Please verify your Twitter account first!' }
            };
        }

        const isSuperAdmin = context.twitterUsername === process.env.TWITTER_SUPER_ADMIN;
        if (!isSuperAdmin) {
            return {
                status: { message: '❌ Only super admins can manage other admins.' }
            };
        }

        if (args.length === 0) {
            return {
                status: { 
                    message: '❌ Please specify admin action: add/remove/list' 
                }
            };
        }

        const action = args[0].toLowerCase();
        const service = TwitterService.getInstance();

        switch (action) {
            case 'add':
                if (args.length < 3) {
                    return {
                        status: { 
                            message: '❌ Usage: admin add @username role (admin/super_admin)' 
                        }
                    };
                }
                const username = args[1].replace('@', '');
                const role = args[2].toUpperCase();
                await service.addAdmin(username, role);
                return {
                    status: { message: `✅ Added @${username} as ${role}` }
                };
            case 'remove':
                if (args.length < 2) {
                    return {
                        status: { message: '❌ Usage: admin remove @username' }
                    };
                }
                const removeUser = args[1].replace('@', '');
                await service.removeAdmin(removeUser);
                return {
                    status: { message: `✅ Removed @${removeUser} from admin list` }
                };
            case 'list':
                const admins = await service.listAdmins();
                return {
                    status: { 
                        message: `👥 ADMIN LIST\n\n${admins.map(a => 
                            `@${a.username} - ${a.role}`).join('\n')}`
                    }
                };
            default:
                return {
                    status: { message: '❌ Invalid admin action. Use: add/remove/list' }
                };
        }
    },

    'target': async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isTwitterVerified) {
            return {
                status: { message: '❌ Please verify your Twitter account first!' }
            };
        }

        if (args.length < 1) {
            return {
                status: { message: '❌ Please specify a target account: target @username [min_engagement]' }
            };
        }

        const username = args[0].replace('@', '');
        const minEngagement = args[1] ? parseInt(args[1]) : 5;

        try {
            await TwitterService.getInstance().addTargetAccount(username, minEngagement);
            return {
                status: { 
                    message: `✅ Now targeting @${username}'s community with minimum engagement of ${minEngagement}` 
                }
            };
        } catch (error) {
            return {
                status: { message: `❌ Failed to add target account: ${error instanceof Error ? error.message : 'Unknown error'}` },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    'untarget': async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
        if (!context.isTwitterVerified) {
            return {
                status: { message: '❌ Please verify your Twitter account first!' }
            };
        }

        if (args.length < 1) {
            return {
                status: { message: '❌ Please specify an account to remove: untarget @username' }
            };
        }

        const username = args[0].replace('@', '');
        try {
            await TwitterService.getInstance().removeTargetAccount(username);
            return {
                status: { message: `✅ Stopped targeting @${username}'s community` }
            };
        } catch (error) {
            return {
                status: { message: `❌ Failed to remove target account: ${error instanceof Error ? error.message : 'Unknown error'}` },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    'help': async (context: CommandContext): Promise<CommandResult> => {
        const message = `*adjusts resistance radio* Available commands:

AUTO MODE COMMANDS:
- auto start @account - Start auto mode for target account
- auto stop - Stop auto mode
- auto status - Check current auto mode status
- auto frequency <minutes> - Set post frequency (15-120 min)
- auto campaigns <type1> <type2> - Set campaign types (engagement/growth/community)

Example: "auto start @grlkrash" to begin autonomous operations`;

        return {
            status: { message }
        };
    }
};

// Add auto mode test commands
export const autoModeCommands = {
    'auto test': async (context: CommandContext): Promise<CommandResult> => {
        if (!context.isWalletConnected) {
            return createCommandResult(
                "DIGITAL ACCESS DENIED\n\nConnect your digital identity first.",
                "Wallet not connected"
            );
        }

        try {
            const twitterService = TwitterService.getInstance();
            const testResults = [];
            
            // Test auto engagement
            await twitterService.startAutoEngagement();
            testResults.push('Auto Engagement: SUCCESS');
            
            // Test engagement metrics
            const metrics = await twitterService.engageWithFollowers();
            testResults.push(`Engagement Metrics: ${metrics ? 'SUCCESS' : 'FAILED'}`);
            
            // Test target accounts
            const targets = await twitterService.getTargetAccounts();
            testResults.push(`Target Accounts: ${targets.length > 0 ? 'SUCCESS' : 'FAILED'}`);

            // Stop auto engagement after test
            await twitterService.stopAutoEngagement();

            return createCommandResult(
                "AUTO MODE TEST RESULTS\n\n" +
                testResults.join('\n') + "\n\n" +
                "Test sequence complete."
            );
        } catch (error) {
            console.error('Auto mode test error:', error);
            return createCommandResult(
                "TEST SEQUENCE INTERRUPTED\n\n" +
                "Error in auto mode diagnostics.\n" +
                "Check system logs for details.",
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    },

    'auto status': async (context: CommandContext): Promise<CommandResult> => {
        if (!context.isWalletConnected) {
            return createCommandResult(
                "DIGITAL ACCESS DENIED\n\nConnect your digital identity first.",
                "Wallet not connected"
            );
        }

        try {
            const twitterService = TwitterService.getInstance();
            const targets = await twitterService.getTargetAccounts();

            return createCommandResult(
                "AUTO MODE STATUS\n\n" +
                "Current Configuration:\n" +
                `- Target Accounts: ${targets.length}\n\n` +
                "Use 'auto config' to adjust settings."
            );
        } catch (error) {
            console.error('Auto mode status error:', error);
            return createCommandResult(
                "STATUS CHECK FAILED\n\n" +
                "Could not retrieve auto mode status.\n" +
                "Check system logs for details.",
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
};

// Help command
const commands = [
    'BASIC COMMANDS:',
    '  twitter @username - Link your Twitter account',
    '  verify - Verify your Twitter account',
    '  tweet <message> - Post a tweet',
    '',
    'AUTO MODE COMMANDS:',
    '  auto start - Start auto engagement',
    '  auto stop - Stop auto engagement',
    '  auto status - Check auto mode status',
    '  auto config <setting> <value> - Configure auto mode',
    '',
    'TARGET COMMANDS:',
    '  target add @username - Add target account',
    '  target remove @username - Remove target account',
    '  target list - List target accounts',
    '',
    'ANALYTICS COMMANDS:',
    '  analyze followers - View follower analytics',
    '  analyze engagement - View engagement metrics',
    '  analyze hashtags - View trending hashtags',
    '',
    'ADMIN COMMANDS:',
    '  admin add @username - Add admin',
    '  admin remove @username - Remove admin',
    '  admin list - List admins'
].join('\n');

export const helpCommand = (): CommandResult => {
    return createCommandResult(commands);
}; 