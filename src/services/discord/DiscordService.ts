import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { EventEmitter } from 'events';
import { ChatbotService } from './ChatbotService';
import { IAgentRuntime } from '../types/agent';
import { DiscordBotService } from './DiscordBotService';
import { MusicPromotionService } from './MusicPromotionService';
import { TokenDistributionService } from './TokenDistributionService';
import { MemoryCrystal } from '../contracts/MemoryCrystal';
import { MOREToken } from '../contracts/MOREToken';
import { MOREPool } from '../contracts/MOREPool';

export class DiscordService extends EventEmitter {
    private client: Client;
    private chatbot: ChatbotService;
    private runtime: IAgentRuntime;
    private autoChannels: string[] = [];
    private discordBot: DiscordBotService;

    constructor(runtime: IAgentRuntime, chatbot: ChatbotService) {
        super();
        this.runtime = runtime;
        this.chatbot = chatbot;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        // Initialize DiscordBotService
        this.discordBot = DiscordBotService.getInstance();

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Discord.js client events
        this.client.on('ready', () => {
            console.log('💎 RESISTANCE BOT ONLINE >> Discord node activated!');
        });

        this.client.on('messageCreate', async (message) => {
            // Ignore bot messages
            if (message.author.bot) return;

            try {
                // First try to handle as a blockchain/NFT command through DiscordBotService
                const botHandled = await this.discordBot.handleMessage(message);
                
                // If not handled by DiscordBotService, process through ChatbotService
                if (!botHandled) {
                    const response = await this.chatbot.handleMessage(
                        message.author.id,
                        'discord',
                        message.content
                    );
                    await message.channel.send(response);
                }
            } catch (error) {
                console.error('Error handling Discord message:', error);
                await message.channel.send(
                    "🚨 CRYSTAL MATRIX DISRUPTION >> Communication error detected. Stabilizing connection... ⚠️"
                );
            }
        });

        // Listen for chatbot auto messages
        this.chatbot.on('autoMessage', async ({ message, platforms }) => {
            if (platforms.includes('discord')) {
                await this.broadcastToAutoChannels(message);
            }
        });

        // Listen for direct Discord messages from chatbot
        this.chatbot.on('discordMessage', async ({ channelId, message }) => {
            try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel && channel instanceof TextChannel) {
                    await channel.send(message);
                }
            } catch (error) {
                console.error('Error sending Discord message:', error);
            }
        });
    }

    async start(token: string): Promise<void> {
        try {
            // Initialize DiscordBotService with required services
            const musicPromotion = new MusicPromotionService();
            const tokenDistribution = new TokenDistributionService();
            const memoryCrystal = new MemoryCrystal(process.env.MEMORY_CRYSTAL_ADDRESS!);
            const moreToken = new MOREToken(process.env.MORE_TOKEN_ADDRESS!);
            const morePool = new MOREPool(process.env.MORE_POOL_ADDRESS!);

            await this.discordBot.initialize(
                musicPromotion,
                tokenDistribution,
                memoryCrystal,
                moreToken,
                morePool
            );

            await this.client.login(token);
        } catch (error) {
            console.error('Error starting Discord bot:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        await this.discordBot.cleanup();
        this.client.destroy();
    }

    setAutoChannels(channelIds: string[]): void {
        this.autoChannels = channelIds;
    }

    private async broadcastToAutoChannels(message: string): Promise<void> {
        for (const channelId of this.autoChannels) {
            try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel && channel instanceof TextChannel) {
                    await channel.send(message);
                }
            } catch (error) {
                console.error(`Error broadcasting to Discord channel ${channelId}:`, error);
            }
        }
    }
} 
