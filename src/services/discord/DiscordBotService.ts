import { Client, GatewayIntentBits, Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, MessageActionRow, ComponentType } from 'discord.js';
import { EventEmitter } from 'events';
import { MusicPromotionService } from './MusicPromotionService';
import { TokenDistributionService } from './TokenDistributionService';
import { AuthorizationService } from './AuthorizationService';
import { ethers } from 'ethers';
import { MemoryCrystal } from '../contracts/MemoryCrystal';
import { MOREToken } from '../contracts/MOREToken';
import { MOREPool } from '../contracts/MOREPool';
import { YouTubeOAuthService } from './YouTubeOAuthService';
import { TwitterOAuthService } from './TwitterOAuthService';
import { PersonalityHandler } from './PersonalityHandler';
import { OperationsMonitor } from '../monitoring/OperationsMonitor';
import { v4 as uuidv4 } from 'uuid';

interface CampaignTask {
    platform: string;
    time: string;
    action: string;
    content: any;
    metadata: any;
}

interface CampaignStatus {
    contentId: string;
    platform: string;
    metrics: {
        views: number;
        engagement: number;
        reach: number;
    };
    nextTasks: CampaignTask[];
}

interface TestResult {
    service: string;
    status: 'passed' | 'failed';
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
    timestamp: Date;
}

export class DiscordBotService extends EventEmitter {
    private static instance: DiscordBotService;
    private client: Client;
    private musicPromotion: MusicPromotionService;
    private tokenDistribution: TokenDistributionService;
    private memoryCrystal: MemoryCrystal;
    private moreToken: MOREToken;
    private morePool: MOREPool;
    private authService: AuthorizationService;
    private isInitialized: boolean = false;
    private testResults: Map<string, TestResult[]> = new Map();
    private personality: PersonalityHandler;
    private monitor: OperationsMonitor;
    
    // Add array of valid admin role names
    private readonly ADMIN_ROLES = ['Admin', 'Administrator', 'Bot Admin', 'Owner'];

    private async isUserAdmin(member: any): Promise<boolean> {
        return member.roles.cache.some((role: any) => 
            this.ADMIN_ROLES.includes(role.name)
        );
    }

    private constructor() {
        super();
        if (!process.env.DISCORD_BOT_TOKEN) {
            throw new Error('DISCORD_BOT_TOKEN not found in environment');
        }
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        this.personality = PersonalityHandler.getInstance();
        this.monitor = OperationsMonitor.getInstance();

        // Set up monitoring alerts
        this.monitor.on('alert', async (alert) => {
            const adminChannel = await this.getAdminChannel();
            if (adminChannel) {
                await adminChannel.send({
                    embeds: [{
                        title: `⚠️ ${alert.type}`,
                        description: alert.message,
                        color: 0xFF0000,
                        fields: [
                            {
                                name: 'Details',
                                value: JSON.stringify(alert.operations, null, 2)
                            }
                        ],
                        timestamp: new Date()
                    }]
                });
            }
        });
    }

    public static getInstance(): DiscordBotService {
        if (!DiscordBotService.instance) {
            DiscordBotService.instance = new DiscordBotService();
        }
        return DiscordBotService.instance;
    }

    private async checkAuthorization(message: Message, address: string): Promise<boolean> {
        const userId = message.author.id;
        const isAuthorized = await this.authService.isAuthorized(userId, address);
        if (!isAuthorized) {
            await message.reply('❌ You are not authorized to use this command');
            return false;
        }
        return true;
    }

    private createMainButtons() {
        return [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('points')
                        .setLabel('📊 Points')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('rank')
                        .setLabel('🏆 Rank')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('achievements')
                        .setLabel('🎯 Achievements')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('leaderboard')
                        .setLabel('📈 Leaderboard')
                        .setStyle(ButtonStyle.Primary)
                )
        ];
    }

    private createCrystalButtons() {
        return [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('forge_basic')
                        .setLabel('💎 Basic Crystal')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('forge_premium')
                        .setLabel('💎 Premium Crystal')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('forge_elite')
                        .setLabel('💎 Elite Crystal')
                        .setStyle(ButtonStyle.Secondary)
                )
        ];
    }

    private createWalletButtons() {
        return [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('wallet')
                        .setLabel('👝 Wallet Status')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('verify')
                        .setLabel('🔐 Verify Wallet')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('help')
                        .setLabel('❓ Help')
                        .setStyle(ButtonStyle.Secondary)
                )
        ];
    }

    private setupButtonHandlers() {
        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isButton()) return;

            const { customId } = interaction;
            const userId = interaction.user.id;

            try {
                switch (customId) {
                    case 'points':
                        await this.handlePointsButton(interaction);
                        break;
                    case 'rank':
                        await this.handleRankButton(interaction);
                        break;
                    case 'achievements':
                        await this.handleAchievementsButton(interaction);
                        break;
                    case 'leaderboard':
                        await this.handleLeaderboardButton(interaction);
                        break;
                    case 'forge_basic':
                    case 'forge_premium':
                    case 'forge_elite':
                        await this.handleForgeButton(interaction, customId.split('_')[1]);
                        break;
                    case 'wallet':
                        await this.handleWalletButton(interaction);
                        break;
                    case 'verify':
                        await this.handleVerifyButton(interaction);
                        break;
                    case 'help':
                        await this.handleHelpButton(interaction);
                        break;
                }
            } catch (error) {
                console.error('Button interaction error:', error);
                await interaction.reply({
                    content: '❌ An error occurred while processing your request.',
                    ephemeral: true
                });
            }
        });
    }

    private async handlePointsButton(interaction: ButtonInteraction) {
        const userId = interaction.user.id;
        const points = await this.userProgress.calculateUserLevel(userId);
        
        await interaction.reply({
            content: `
🏆 Your Progress Report:

Level: ${points.level} - ${points.title}
XP: ${points.currentXP} / ${points.nextLevelXP}
Progress: ${Math.floor((points.currentXP / points.nextLevelXP) * 100)}%

🌟 Active Perks:
${points.perks.map(perk => `- ${perk}`).join('\n')}
            `,
            ephemeral: true
        });
    }

    private async handleRankButton(interaction: ButtonInteraction) {
        const userId = interaction.user.id;
        const rank = await this.leaderboardService.getUserRank(userId);
        const stats = await this.userProgress.calculateUserLevel(userId);
        
        await interaction.reply({
            content: `
📊 Your Rank Status:

Global Rank: #${rank}
Level: ${stats.level} (${stats.title})
XP to Next Level: ${stats.nextLevelXP - stats.currentXP}

🎯 Next Milestone: ${this.getNextMilestone(stats.level)}
            `,
            ephemeral: true
        });
    }

    private async handleAchievementsButton(interaction: ButtonInteraction) {
        const userId = interaction.user.id;
        const achievements = await this.achievementService.getUserAchievements(userId);
        
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        const totalCount = achievements.length;
        
        await interaction.reply({
            content: `
🏆 Achievement Progress (${unlockedCount}/${totalCount}):

${achievements.map(a => 
    `${a.unlocked ? '✅' : '🔒'} ${a.name}
     ${a.description}
     Reward: ${a.points} points`
).join('\n\n')}
            `,
            ephemeral: true
        });
    }

    private async handleLeaderboardButton(interaction: ButtonInteraction) {
        const leaderboard = await this.leaderboardService.getLeaderboard('weekly');
        
        await interaction.reply({
            content: `
🏆 Weekly Leaderboard:

${leaderboard.map((entry, index) => 
    `${index + 1}. ${entry.username}
     Points: ${entry.points}
     Level: ${entry.level} (${entry.title})`
).join('\n\n')}
            `,
            ephemeral: false
        });
    }

    private async handleForgeButton(interaction: ButtonInteraction, type: string) {
        const userId = interaction.user.id;
        if (!await this.authService.isTokenHolder(userId)) {
            await interaction.reply({
                content: '❌ You need MORE tokens to forge crystals. Use /verify to connect your wallet first.',
                ephemeral: true
            });
            return;
        }

        await interaction.reply({
            content: `Starting forge process for ${type} crystal...`,
            ephemeral: true
        });

        await this.handleForgeCrystalCommand(interaction, [type]);
    }

    private setupCommands() {
        this.setupButtonHandlers();

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const opId = uuidv4();
            this.monitor.startOperation(opId, 'message_handling', {
                userId: message.author.id,
                channelId: message.channel.id
            });
            
            try {
                const content = message.content.toLowerCase();
                
                // Handle commands
                if (content.startsWith('!') || content.startsWith('/')) {
                    await this.handleCommand(message);
                    this.monitor.completeOperation(opId, 'success');
                    return;
                }

                // Handle natural conversation with personality
                const response = this.personality.processMessage(message.author.id, content);
                await message.reply(response);
                
                this.monitor.completeOperation(opId, 'success');
            } catch (error) {
                console.error('Error handling message:', error);
                this.monitor.completeOperation(opId, 'failure', error.message);
                await message.reply('🎸 Oops! Hit a wrong note there! Try again? 🤘');
            }
        });

        // Add test dashboard command
        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const { commandName } = interaction;

            if (commandName === 'tests') {
                await this.handleTestDashboard(interaction);
            }
        });
    }

    private async handlePromoteCommand(message: Message, args: string[]) {
        try {
            const platform = args[0]?.toLowerCase();
            const strategy = await this.musicPromotion.generatePromotionStrategy(platform);
            await this.musicPromotion.executePromotionStrategy(strategy);
            await message.reply(`Started promotion campaign on ${platform}!`);
        } catch (error) {
            await message.reply('Failed to start promotion campaign. Please try again later.');
        }
    }

    private async handleStatsCommand(message: Message) {
        try {
            const stats = await this.musicPromotion.getPromotionStats();
            await message.reply(`Current Stats:\nSpotify Streams: ${stats.spotifyStreams}\nYouTube Views: ${stats.youtubeViews}\nInstagram Followers: ${stats.instagramFollowers}`);
        } catch (error) {
            await message.reply('Failed to fetch stats. Please try again later.');
        }
    }

    private async handleMilestoneCommand(message: Message) {
        try {
            const milestones = await this.musicPromotion.getMilestones();
            await message.reply(`Latest Milestones:\n${milestones.map(m => `- ${m.description}`).join('\n')}`);
        } catch (error) {
            await message.reply('Failed to fetch milestones. Please try again later.');
        }
    }

    private async handleDistributeCommand(message: Message, args: string[]) {
        try {
            const amount = parseInt(args[0]);
            const type = args[1]?.toLowerCase();
            if (isNaN(amount) || !type) {
                await message.reply('Invalid command format. Use: !distribute [amount] [type]');
                return;
            }

            await this.tokenDistribution.queueDistribution(type, amount);
            await message.reply(`✅ Queued distribution of ${amount} tokens for ${type}`);

        } catch (error) {
            await message.reply('Failed to queue distribution: ' + error.message);
        }
    }

    private async handleYouTubeAuth(message: Message): Promise<void> {
        try {
            const youtubeService = YouTubeOAuthService.getInstance();
            const result = await youtubeService.startOAuth(message.author.id);

            if (result.success && result.url) {
                await message.reply({
                    content: "🎥 **YouTube Authorization**\n\n" +
                        "Click the link below to authorize your YouTube account:\n" +
                        result.url + "\n\n" +
                        "The link will expire in 10 minutes.",
                    ephemeral: true // Makes the message private
                });
            } else {
                await message.reply({
                    content: "❌ Failed to start YouTube authorization. Please try again later.",
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error starting YouTube auth:', error);
            await message.reply({
                content: "❌ An error occurred during YouTube authorization.",
                ephemeral: true
            });
        }
    }

    private async handleTwitterAuth(message: Message): Promise<void> {
        try {
            const twitterService = TwitterOAuthService.getInstance();
            const result = await twitterService.startOAuth(message.author.id, message.author.username);

            await message.reply({
                content: result.message,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error starting Twitter auth:', error);
            await message.reply({
                content: "❌ An error occurred during Twitter authorization.",
                ephemeral: true
            });
        }
    }

    private async handleSocialsStatus(message: Message): Promise<void> {
        try {
            const youtubeService = YouTubeOAuthService.getInstance();
            const twitterService = TwitterOAuthService.getInstance();

            const youtubeAuth = await youtubeService.getStoredTokens() ? '✅' : '❌';
            const twitterAuth = await twitterService.getStoredTokens(message.author.id) ? '✅' : '❌';

            await message.reply({
                content: "🔑 **Social Media Authorization Status**\n\n" +
                    `YouTube: ${youtubeAuth}\n` +
                    `Twitter: ${twitterAuth}\n\n` +
                    "Use `!youtube auth` or `!twitter auth` to authorize missing platforms.",
                ephemeral: true
            });
        } catch (error) {
            console.error('Error checking social status:', error);
            await message.reply({
                content: "❌ An error occurred while checking social media status.",
                ephemeral: true
            });
        }
    }

    private async handleCampaignsCommand(message: any): Promise<void> {
        const campaigns = await this.getCampaignsList();
        const embed = {
            title: '🎵 Active Campaigns',
            description: 'Here are your active music promotion campaigns:',
            fields: campaigns.map(campaign => ({
                name: campaign.contentId,
                value: `Platform: ${campaign.platform}\nViews: ${campaign.metrics.views}\nEngagement: ${campaign.metrics.engagement}%`
            }))
        };
        await message.channel.send({ embeds: [embed] });
    }

    private async handleScheduleCommand(message: any, args: string[]): Promise<void> {
        const [contentId, platform, time] = args;
        if (!contentId || !platform || !time) {
            await message.reply('Usage: !schedule <contentId> <platform> <time>');
            return;
        }

        const task: CampaignTask = {
            platform,
            time,
            action: 'post',
            content: { id: contentId },
            metadata: {}
        };

        await this.scheduleTask(task);
        await message.reply(`✅ Scheduled content ${contentId} for ${platform} at ${time}`);
    }

    private async handleStatusCommand(message: Message): Promise<void> {
        if (!await this.isUserAdmin(message.member)) {
            await message.reply('🎸 Sorry, only admins can check the system status! 🤘');
            return;
        }

        const metrics = this.monitor.getMetrics();
        const embed = {
            title: '🎸 System Status',
            fields: [
                {
                    name: 'Operations',
                    value: `Total: ${metrics.totalOperations}\nActive: ${metrics.activeOperations}`
                },
                {
                    name: 'Performance',
                    value: `Success Rate: ${(metrics.successRate * 100).toFixed(1)}%\nAvg Response: ${metrics.averageResponseTime}ms`
                }
            ],
            timestamp: new Date(),
            color: metrics.successRate > 0.9 ? 0x00FF00 : 0xFF0000
        };

        await message.reply({ embeds: [embed] });
    }

    private async handleOptimizeCommand(message: any, contentId: string): Promise<void> {
        if (!contentId) {
            await message.reply('Usage: !optimize <contentId>');
            return;
        }

        await message.reply('🔄 Optimizing campaign...');
        // Trigger optimization logic
        await this.optimizeCampaign(contentId);
        await message.reply('✅ Campaign optimized!');
    }

    private async handleTestDashboard(interaction: any) {
        // Verify admin role
        const member = interaction.member;
        const isAdmin = await this.isUserAdmin(member);
        
        if (!isAdmin) {
            await interaction.reply({
                content: '❌ Only administrators can access the test dashboard.',
                ephemeral: true
            });
            return;
        }

        // Run tests and collect results
        const results = await this.runTests();
        
        // Create embed for test results
        const embed = {
            title: '🧪 Test Dashboard',
            description: 'Latest test results for all services',
            color: 0x00ff00, // Green
            fields: results.map(result => ({
                name: `${result.service} ${result.status === 'passed' ? '✅' : '❌'}`,
                value: [
                    `Total Tests: ${result.totalTests}`,
                    `Passed: ${result.passedTests}`,
                    `Failed: ${result.failedTests}`,
                    `Duration: ${result.duration}ms`,
                    `Last Run: ${result.timestamp.toLocaleString()}`
                ].join('\n'),
                inline: true
            })),
            timestamp: new Date(),
            footer: {
                text: 'Test results are updated every time this command is run'
            }
        };

        // Add buttons for actions
        const row = {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 1,
                    label: 'Run All Tests',
                    custom_id: 'run_all_tests'
                },
                {
                    type: 2,
                    style: 2,
                    label: 'View Details',
                    custom_id: 'view_test_details'
                },
                {
                    type: 2,
                    style: 4,
                    label: 'Clear History',
                    custom_id: 'clear_test_history'
                }
            ]
        };

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }

    private async runTests(): Promise<TestResult[]> {
        const results: TestResult[] = [];
        const services = [
            'MusicPromotion',
            'Content',
            'Analytics',
            'TokenDistribution',
            'CommunityEngagement'
        ];

        for (const service of services) {
            try {
                // Run Jest programmatically for the service
                const startTime = Date.now();
                const { success, testResults } = await this.runJestTests(service);
                const duration = Date.now() - startTime;

                const result: TestResult = {
                    service,
                    status: success ? 'passed' : 'failed',
                    totalTests: testResults.numTotalTests,
                    passedTests: testResults.numPassedTests,
                    failedTests: testResults.numFailedTests,
                    duration,
                    timestamp: new Date()
                };

                results.push(result);
                
                // Store result history
                const history = this.testResults.get(service) || [];
                history.push(result);
                this.testResults.set(service, history);

            } catch (error) {
                console.error(`Failed to run tests for ${service}:`, error);
                results.push({
                    service,
                    status: 'failed',
                    totalTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    duration: 0,
                    timestamp: new Date()
                });
            }
        }

        return results;
    }

    private async runJestTests(service: string): Promise<any> {
        const { run } = require('jest');
        return run([
            '--silent',
            '--json',
            `--testNamePattern=${service}`,
            '--testPathPattern=src/services/__tests__'
        ]);
    }

    private async getCampaignsList(): Promise<CampaignStatus[]> {
        // Implement campaign list retrieval
        return [];
    }

    private async getCampaignStatus(contentId: string): Promise<CampaignStatus | null> {
        // Implement campaign status retrieval
        return null;
    }

    private async optimizeCampaign(contentId: string): Promise<void> {
        // Implement campaign optimization
    }

    private async setupCommandPermissions() {
        try {
            // Get all guilds the bot is in
            const guilds = this.client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                // Find the Admin role in the guild
                const adminRole = guild.roles.cache.find(role => role.name === 'Admin');
                
                if (!adminRole) {
                    console.warn(`No Admin role found in guild ${guild.name} (${guildId})`);
                    continue;
                }

                // Get the test command for this guild
                const testCommand = (await guild.commands.fetch()).find(cmd => cmd.name === 'tests');
                
                if (!testCommand) {
                    console.warn(`Test command not found in guild ${guild.name} (${guildId})`);
                    continue;
                }

                // Set permissions for the test command
                await testCommand.permissions.set({
                    permissions: [
                        {
                            id: adminRole.id,
                            type: 'ROLE',
                            permission: true
                        }
                    ]
                });

                console.log(`Set up test command permissions for guild ${guild.name} (${guildId})`);
            }
        } catch (error) {
            console.error('Error setting up command permissions:', error);
        }
    }

    private async registerCommands() {
        try {
            // Get all guilds the bot is in
            const guilds = this.client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                // Register commands for this guild
                await guild.commands.set(commands);
                console.log(`Registered commands for guild ${guild.name} (${guildId})`);
            }
        } catch (error) {
            console.error('Error registering commands:', error);
        }
    }

    public async initialize(
        musicPromotion: MusicPromotionService, 
        tokenDistribution: TokenDistributionService,
        memoryCrystal: MemoryCrystal,
        moreToken: MOREToken,
        morePool: MOREPool
    ) {
        if (this.isInitialized) return;
        
        this.musicPromotion = musicPromotion;
        this.tokenDistribution = tokenDistribution;
        this.memoryCrystal = memoryCrystal;
        this.moreToken = moreToken;
        this.morePool = morePool;

        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user?.tag}!`);
            this.setupCommands();
            this.setupButtonHandlers();
            this.setupCommandPermissions();
            this.registerCommands();
        });

        await this.client.login(process.env.DISCORD_BOT_TOKEN);
        this.isInitialized = true;
    }

    public async cleanup() {
        if (this.isInitialized) {
            await this.client.destroy();
            this.isInitialized = false;
        }
    }

    private async getAdminChannel(): Promise<any> {
        const guild = this.client.guilds.cache.first();
        if (!guild) return null;
        return guild.channels.cache.find(channel => 
            channel.name.toLowerCase().includes('bot-monitoring'));
    }

    private async handleCommand(message: Message): Promise<void> {
        const opId = uuidv4();
        const [command, ...args] = message.content.slice(1).split(' ');
        
        this.monitor.startOperation(opId, `command_${command}`, {
            userId: message.author.id,
            command,
            args
        });
        
        try {
            switch (command) {
                case 'promote':
                    await this.handlePromoteCommand(message, args);
                    break;
                case 'stats':
                    await this.handleStatsCommand(message);
                    break;
                case 'milestone':
                    await this.handleMilestoneCommand(message);
                    break;
                case 'distribute':
                    await this.handleDistributeCommand(message, args);
                    break;
                case 'youtube':
                    await this.handleYouTubeAuth(message);
                    break;
                case 'twitter':
                    await this.handleTwitterAuth(message);
                    break;
                case 'socials':
                    await this.handleSocialsStatus(message);
                    break;
                case 'campaigns':
                    await this.handleCampaignsCommand(message);
                    break;
            }
            
            this.monitor.completeOperation(opId, 'success');
        } catch (error) {
            console.error('Command error:', error);
            this.monitor.completeOperation(opId, 'failure', error.message);
            throw error;
        }
    }
} 