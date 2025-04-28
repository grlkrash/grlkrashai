import { Context, Telegraf } from 'telegraf';
import { WalletVerificationService } from '../../auth/WalletVerificationService';
import { WalletConnectionService } from '../../auth/WalletConnectionService';
import { ethers } from 'ethers';

export class TelegramWalletVerificationCommands {
    private verificationService: WalletVerificationService;
    private walletConnectionService: WalletConnectionService;
    private bot: Telegraf;

    constructor(
        bot: Telegraf,
        verificationService: WalletVerificationService,
        walletConnectionService: WalletConnectionService
    ) {
        this.bot = bot;
        this.verificationService = verificationService;
        this.walletConnectionService = walletConnectionService;
        this.setupCommands();
    }

    private setupCommands(): void {
        this.bot.command('verify_wallet', this.handleVerifyWallet.bind(this));
        this.bot.command('submit_signature', this.handleSubmitSignature.bind(this));
        this.bot.command('unlink_wallet', this.handleUnlinkWallet.bind(this));
        this.bot.command('wallet_info', this.handleWalletInfo.bind(this));
    }

    /**
     * Handle the verify_wallet command
     */
    private async handleVerifyWallet(ctx: Context): Promise<void> {
        try {
            const message = ctx.message.text.split(' ');
            if (message.length !== 2) {
                await ctx.reply(
                    'Please provide a wallet address.\nUsage: /verify_wallet <address>'
                );
                return;
            }

            const walletAddress = message[1];

            // Validate wallet address
            if (!ethers.isAddress(walletAddress)) {
                await ctx.reply('Invalid wallet address. Please provide a valid Ethereum address.');
                return;
            }

            // Generate nonce
            const nonce = await this.verificationService.generateNonce(
                ctx.from.id.toString(),
                'telegram',
                walletAddress
            );

            // Generate message and links
            const messageToSign = this.verificationService.generateMessage(walletAddress, nonce);
            const mobileSigningLink = this.verificationService.generateMobileSigningLink(walletAddress, nonce);
            const walletDeepLinks = this.verificationService.generateWalletDeepLinks(walletAddress, messageToSign);

            // Create WalletConnect session
            const connectionDetails = await this.walletConnectionService.createSession();

            // Send QR code image
            await ctx.replyWithPhoto(
                { source: Buffer.from(connectionDetails.qrCode.split(',')[1], 'base64') },
                {
                    caption: '🔗 Scan this QR code with your wallet app to connect'
                }
            );

            // Send verification instructions
            const instructions = [
                '🔐 *Wallet Verification*\n',
                '*Method 1: WalletConnect (Recommended)*',
                '• Scan the QR code above with your wallet app, or',
                `• Click/copy this link: \`${connectionDetails.uri}\`\n`,
                '*Method 2: Mobile Wallet Direct Links*',
                '📱 Click the appropriate link for your wallet:',
                `• [MetaMask](${walletDeepLinks.metamask})`,
                `• [Coinbase Wallet](${walletDeepLinks.coinbase})`,
                `• [Coinbase Pro](${walletDeepLinks.coinbasepro})`,
                `• [Trust Wallet](${walletDeepLinks.trustwallet})`,
                `• [Rainbow](${walletDeepLinks.rainbow})\n`,
                '🔗 Universal signing links:',
                `• [Sign with any wallet](${mobileSigningLink})`,
                `• [Sign with Coinbase](${walletDeepLinks.coinbaseuniversal})\n`,
                '*Method 3: Manual Signature*',
                'Sign this message with your wallet:',
                '```',
                messageToSign,
                '```\n',
                'After signing, use:',
                '/submit_signature <nonce> <signature>\n',
                '💡 *Tip: Mobile users can click the direct links above for easier signing!*'
            ].join('\n');

            await ctx.reply(instructions, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

            // Set up event listener for WalletConnect signature
            this.walletConnectionService.connector.on('signature', async (error, payload) => {
                if (error) {
                    await ctx.reply(`Error: ${error.message}`);
                    return;
                }

                try {
                    const signature = payload.params[0];
                    const token = await this.verificationService.verifySignature(nonce, signature);

                    await ctx.reply(
                        '✅ *Wallet Verification Successful!*\n\n' +
                        'Your wallet has been linked to your Telegram account.',
                        { parse_mode: 'Markdown' }
                    );

                    // Disconnect WalletConnect session
                    await this.walletConnectionService.disconnect();
                } catch (error) {
                    await ctx.reply(`Error: ${error.message}`);
                }
            });
        } catch (error) {
            await ctx.reply(`Error: ${error.message}`);
        }
    }

    /**
     * Handle the submit_signature command
     */
    private async handleSubmitSignature(ctx: Context): Promise<void> {
        try {
            const message = ctx.message.text.split(' ');
            if (message.length !== 3) {
                await ctx.reply(
                    'Please provide both nonce and signature.\nUsage: /submit_signature <nonce> <signature>'
                );
                return;
            }

            const [_, nonce, signature] = message;

            // Verify signature
            const token = await this.verificationService.verifySignature(nonce, signature);

            await ctx.reply(
                '✅ Wallet verification successful!\n\nYour wallet has been linked to your Telegram account.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(`Error: ${error.message}`);
        }
    }

    /**
     * Handle the unlink_wallet command
     */
    private async handleUnlinkWallet(ctx: Context): Promise<void> {
        try {
            await this.verificationService.unlinkWallet(ctx.from.id.toString(), 'telegram');

            await ctx.reply(
                '🔓 Your wallet has been successfully unlinked from your Telegram account.'
            );
        } catch (error) {
            await ctx.reply(`Error: ${error.message}`);
        }
    }

    /**
     * Handle the wallet_info command
     */
    private async handleWalletInfo(ctx: Context): Promise<void> {
        try {
            const walletAddress = await this.verificationService.getWalletAddress(
                ctx.from.id.toString(),
                'telegram'
            );

            if (!walletAddress) {
                await ctx.reply('No wallet is currently linked to your Telegram account.');
                return;
            }

            await ctx.reply(
                '💼 *Wallet Information*\n\n' +
                `*Linked Wallet:* \`${walletAddress}\`\n` +
                `*Telegram User:* @${ctx.from.username || ctx.from.id}`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(`Error: ${error.message}`);
        }
    }
} 