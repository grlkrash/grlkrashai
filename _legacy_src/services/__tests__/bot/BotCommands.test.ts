import { WalletVerificationService } from '../../auth/WalletVerificationService';
import { WalletConnectionService } from '../../auth/WalletConnectionService';
import { WalletVerificationCommands } from '../../discord/commands/WalletVerificationCommands';
import { TelegramWalletVerificationCommands } from '../../telegram/commands/WalletVerificationCommands';
import { Redis } from 'ioredis';
import { Telegraf } from 'telegraf';
import { CommandInteraction, EmbedBuilder } from 'discord.js';

jest.mock('ioredis');
jest.mock('@walletconnect/client');
jest.mock('discord.js');
jest.mock('telegraf');

describe('Bot Commands Tests', () => {
    let walletVerificationService: WalletVerificationService;
    let walletConnectionService: WalletConnectionService;
    let discordCommands: WalletVerificationCommands;
    let telegramCommands: TelegramWalletVerificationCommands;
    let mockRedis: jest.Mocked<Redis>;

    beforeEach(() => {
        // Mock Redis
        mockRedis = new Redis() as jest.Mocked<Redis>;
        mockRedis.get = jest.fn();
        mockRedis.set = jest.fn();
        mockRedis.setex = jest.fn();
        mockRedis.del = jest.fn();
        mockRedis.incr = jest.fn().mockResolvedValue(1);
        mockRedis.expire = jest.fn();

        // Initialize services
        walletVerificationService = new WalletVerificationService(
            'redis://localhost:6379',
            'test-jwt-secret'
        );
        walletConnectionService = new WalletConnectionService();

        // Initialize command handlers
        discordCommands = new WalletVerificationCommands(
            walletVerificationService,
            walletConnectionService
        );
        telegramCommands = new TelegramWalletVerificationCommands(
            new Telegraf('test-token'),
            walletVerificationService,
            walletConnectionService
        );
    });

    describe('Discord Commands', () => {
        test('verify-wallet command should validate address', async () => {
            const mockInteraction = {
                options: {
                    getString: jest.fn().mockReturnValue('0x123...'), // Invalid address
                },
                reply: jest.fn(),
                user: { id: 'test-user' },
            } as unknown as CommandInteraction;

            await discordCommands.handleVerifyWallet(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Invalid wallet address'),
                    ephemeral: true,
                })
            );
        });

        test('verify-wallet command should generate verification message', async () => {
            const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
            const mockInteraction = {
                options: {
                    getString: jest.fn().mockReturnValue(validAddress),
                },
                reply: jest.fn(),
                user: { id: 'test-user' },
            } as unknown as CommandInteraction;

            await discordCommands.handleVerifyWallet(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.any(EmbedBuilder),
                    ]),
                    ephemeral: true,
                })
            );
        });
    });

    describe('Telegram Commands', () => {
        test('verify_wallet command should validate address', async () => {
            const mockContext = {
                message: {
                    text: '/verify_wallet 0x123...', // Invalid address
                },
                reply: jest.fn(),
                from: { id: 'test-user' },
            };

            await telegramCommands['handleVerifyWallet'](mockContext as any);

            expect(mockContext.reply).toHaveBeenCalledWith(
                expect.stringContaining('Invalid wallet address')
            );
        });

        test('verify_wallet command should generate verification message', async () => {
            const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
            const mockContext = {
                message: {
                    text: `/verify_wallet ${validAddress}`,
                },
                reply: jest.fn(),
                replyWithPhoto: jest.fn(),
                from: { id: 'test-user' },
            };

            await telegramCommands['handleVerifyWallet'](mockContext as any);

            expect(mockContext.replyWithPhoto).toHaveBeenCalled();
            expect(mockContext.reply).toHaveBeenCalledWith(
                expect.stringContaining('Wallet Verification'),
                expect.any(Object)
            );
        });
    });

    describe('Wallet Verification Service', () => {
        test('should generate and store nonce', async () => {
            const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
            const nonce = await walletVerificationService.generateNonce(
                'test-user',
                'discord',
                address
            );

            expect(nonce).toBeTruthy();
            expect(mockRedis.setex).toHaveBeenCalled();
        });

        test('should verify signature', async () => {
            const mockRequestData = JSON.stringify({
                userId: 'test-user',
                platform: 'discord',
                walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
                nonce: 'test-nonce',
                timestamp: Date.now(),
            });

            mockRedis.get.mockResolvedValueOnce(mockRequestData);

            // This will fail because we're not actually signing anything
            await expect(
                walletVerificationService.verifySignature('test-nonce', 'invalid-signature')
            ).rejects.toThrow();
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits', async () => {
            const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
            mockRedis.incr.mockResolvedValue(6); // Exceed rate limit

            await expect(
                walletVerificationService.generateNonce('test-user', 'discord', address)
            ).rejects.toThrow('Rate limit exceeded');
        });
    });
}); 