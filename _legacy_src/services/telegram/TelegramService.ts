import { Telegraf, Context } from 'telegraf';
import { EventEmitter } from 'events';
import { ChatbotService } from './ChatbotService';
import { IAgentRuntime } from '../types/agent';
import { MusicPromotionService } from './MusicPromotionService';
import { TokenDistributionService } from './TokenDistributionService';
import { AuthorizationService } from './AuthorizationService';
import { MemoryCrystal } from '../contracts/MemoryCrystal';
import { MOREToken } from '../contracts/MOREToken';
import { MOREPool } from '../contracts/MOREPool';
import { LeaderboardService } from './LeaderboardService';
import { StreakService } from './StreakService';

interface CampaignTask {
    platform: string;
    time: string;
    action: string;
    content: any;
    metadata: any;
}

export class TelegramService extends EventEmitter {
    private bot: Telegraf;
    private chatbot: ChatbotService;
    private runtime: IAgentRuntime;
    private autoChats: string[] = [];

    // Additional services
    private musicPromotion: MusicPromotionService;
    private tokenDistribution: TokenDistributionService;
    private memoryCrystal: MemoryCrystal;
    private moreToken: MOREToken;
    private morePool: MOREPool;
    private authService: AuthorizationService;
    private leaderboardService: LeaderboardService;
    private streakService: StreakService;
    private isInitialized: boolean = false;

    constructor(runtime: IAgentRuntime, chatbot: ChatbotService) {
        super();
        this.runtime = runtime;
        this.chatbot = chatbot;
        this.bot = new Telegraf('');  // Token will be set in start method

        // Initialize services
        this.leaderboardService = new LeaderboardService();
        this.streakService = new StreakService();

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Handle text messages
        this.bot.on('text', async (ctx) => {
            try {
                const response = await this.chatbot.handleMessage(
                    ctx.from.id.toString(),
                    'telegram',
                    ctx.message.text
                );

                await ctx.reply(response, { parse_mode: 'HTML' });
            } catch (error) {
                console.error('Error handling Telegram message:', error);
                await ctx.reply(
                    "🚨 CRYSTAL MATRIX DISRUPTION >> Communication error detected. Stabilizing connection... ⚠️",
                    { parse_mode: 'HTML' }
                );
            }
        });

        // Handle commands
        this.bot.command('start', async (ctx) => {
            const welcomeMessage = "💎 RESISTANCE NETWORK INITIALIZED >> Welcome to the KRASH WORLD resistance movement! Ready to amplify your energy? 🌟\n\nUse these commands to navigate:\n/help - View available operations\n/status - Check network status";
            await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
        });

        this.bot.command('help', async (ctx) => {
            const helpMessage = "📡 RESISTANCE COMMAND MATRIX >>\n\n" +
                "🔮 Basic Operations:\n" +
                "/start - Initialize connection\n" +
                "/status - Check network status\n" +
                "/help - View this guide\n" +
                "/leaderboard - View weekly rankings\n" +
                "/streak - Check your activity streak\n" +
                "/verify - Link your wallet\n\n" +
                "💎 Advanced Operations:\n" +
                "• Share music files for upload\n" +
                "• Ask about campaigns\n" +
                "• Request performance data\n" +
                "• Get content optimization tips";
            await ctx.reply(helpMessage, { parse_mode: 'HTML' });
        });

        this.bot.command('status', async (ctx) => {
            const statusMessage = "⚡ RESISTANCE NETWORK STATUS >>\n\n" +
                "💫 Connection: STABLE\n" +
                "🔮 Energy Level: OPTIMAL\n" +
                "📡 Signal Strength: STRONG\n\n" +
                "Ready for your next operation, resistance fighter!";
            await ctx.reply(statusMessage, { parse_mode: 'HTML' });
        });

        // Add new commands from TelegramBotService
        this.bot.command('leaderboard', this.handleLeaderboardCommand.bind(this));
        this.bot.command('streak', this.handleStreakCommand.bind(this));
        this.bot.command('verify', this.handleVerifyPrompt.bind(this));

        // Listen for chatbot auto messages
        this.chatbot.on('autoMessage', async ({ message, platforms }) => {
            if (platforms.includes('telegram')) {
                await this.broadcastToAutoChats(message);
            }
        });

        // Listen for direct Telegram messages from chatbot
        this.chatbot.on('telegramMessage', async ({ chatId, message }) => {
            try {
                await this.bot.telegram.sendMessage(chatId, message, {
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error('Error sending Telegram message:', error);
            }
        });
    }

    private async handleLeaderboardCommand(ctx: Context) {
        const leaderboard = await this.leaderboardService.getLeaderboard('weekly');
        
        await ctx.reply(`
🏆 Weekly Leaderboard:

${leaderboard.map((entry, index) => 
    `${index + 1}. ${entry.username}
     Points: ${entry.points}
     Level: ${entry.level} (${entry.title})`
).join('\n\n')}
        `);
    }

    private async handleStreakCommand(ctx: Context) {
        const userId = ctx.from?.id.toString();
        if (!userId) return;

        const streak = await this.streakService.getStreak(userId);
        const multiplier = 1 + Math.min(streak * 0.1, 0.5);
        
        await ctx.reply(`
🔥 Activity Streak: ${streak} days
📈 Point Multiplier: ${multiplier}x

Keep your streak alive by:
- Engaging with the community
- Creating or sharing content
- Participating in challenges
- Forging new crystals

Come back tomorrow to increase your streak!
        `);
    }

    private async handleVerifyPrompt(ctx: Context) {
        await ctx.reply(
            '🔐 To verify your wallet:\n\n' +
            '1. Send your wallet address\n' +
            '2. Sign the verification message\n' +
            '3. Send the signature\n\n' +
            'Format: /verify <address> <signature>'
        );
    }

    async start(token: string): Promise<void> {
        try {
            this.bot = new Telegraf(token);
            this.setupEventListeners();

            // Initialize additional services
            this.musicPromotion = new MusicPromotionService();
            this.tokenDistribution = new TokenDistributionService();
            this.memoryCrystal = new MemoryCrystal(process.env.MEMORY_CRYSTAL_ADDRESS!);
            this.moreToken = new MOREToken(process.env.MORE_TOKEN_ADDRESS!);
            this.morePool = new MOREPool(process.env.MORE_POOL_ADDRESS!);
            this.authService = AuthorizationService.getInstance(this.moreToken);

            await this.bot.launch();
            this.isInitialized = true;
            console.log('💎 RESISTANCE BOT ONLINE >> Telegram node activated!');
        } catch (error) {
            console.error('Error starting Telegram bot:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.bot.stop('SIGINT');
    }

    setAutoChats(chatIds: string[]): void {
        this.autoChats = chatIds;
    }

    private async broadcastToAutoChats(message: string): Promise<void> {
        for (const chatId of this.autoChats) {
            try {
                await this.bot.telegram.sendMessage(chatId, message, {
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error(`Error broadcasting to Telegram chat ${chatId}:`, error);
            }
        }
    }

    private formatContentMessage(content: any, metadata: any): string {
        return `🎵 *New Content Alert!*\n\n${metadata.description || ''}\n\nCheck it out: ${content.url}`;
    }

    private formatEngagementMessage(content: any, metadata: any): string {
        return `💫 *Join the conversation!*\n\n${metadata.prompt || ''}\n\nShare your thoughts below!`;
    }

    private formatAnnouncementMessage(content: any, metadata: any): string {
        return `📢 *Announcement*\n\n${metadata.message || ''}\n\n${content.url ? `More info: ${content.url}` : ''}`;
    }
} 
