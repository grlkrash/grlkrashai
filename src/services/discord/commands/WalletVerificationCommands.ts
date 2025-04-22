import { CommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { WalletVerificationService } from '../../auth/WalletVerificationService';
import { WalletConnectionService } from '../../auth/WalletConnectionService';
import { ethers } from 'ethers';

export class WalletVerificationCommands {
    private verificationService: WalletVerificationService;
    private walletConnectionService: WalletConnectionService;

    constructor(
        verificationService: WalletVerificationService,
        walletConnectionService: WalletConnectionService
    ) {
        this.verificationService = verificationService;
        this.walletConnectionService = walletConnectionService;
    }

    /**
     * Handle the verify-wallet command
     */
    async handleVerifyWallet(interaction: CommandInteraction): Promise<void> {
        try {
            const walletAddress = interaction.options.getString('address', true);

            // Validate wallet address
            if (!ethers.isAddress(walletAddress)) {
                await interaction.reply({
                    content: 'Invalid wallet address. Please provide a valid Ethereum address.',
                    ephemeral: true
                });
                return;
            }

            // Generate nonce
            const nonce = await this.verificationService.generateNonce(
                interaction.user.id,
                'discord',
                walletAddress
            );

            // Generate message and links
            const message = this.verificationService.generateMessage(walletAddress, nonce);
            const mobileSigningLink = this.verificationService.generateMobileSigningLink(walletAddress, nonce);
            const walletDeepLinks = this.verificationService.generateWalletDeepLinks(walletAddress, message);

            // Create WalletConnect session
            const connectionDetails = await this.walletConnectionService.createSession();

            // Create QR code attachment
            const qrCodeBuffer = Buffer.from(connectionDetails.qrCode.split(',')[1], 'base64');
            const attachment = new AttachmentBuilder(qrCodeBuffer, { name: 'wallet-connect.png' });

            const embed = new EmbedBuilder()
                .setTitle('Wallet Verification')
                .setDescription('Please verify your wallet using one of these methods:')
                .addFields(
                    { 
                        name: '1️⃣ WalletConnect (Recommended)', 
                        value: 'Scan the QR code below with your wallet app or click the WalletConnect link' 
                    },
                    {
                        name: '2️⃣ Mobile Wallet Direct Links',
                        value: [
                            '📱 Click the appropriate link for your wallet:',
                            `• [MetaMask](${walletDeepLinks.metamask})`,
                            `• [Coinbase Wallet](${walletDeepLinks.coinbase})`,
                            `• [Coinbase Pro](${walletDeepLinks.coinbasepro})`,
                            `• [Trust Wallet](${walletDeepLinks.trustwallet})`,
                            `• [Rainbow](${walletDeepLinks.rainbow})`,
                            '',
                            '🔗 Universal signing links:',
                            `• [Sign with any wallet](${mobileSigningLink})`,
                            `• [Sign with Coinbase](${walletDeepLinks.coinbaseuniversal})`
                        ].join('\n')
                    },
                    { 
                        name: '3️⃣ Manual Signature', 
                        value: [
                            'Sign this message with your wallet:',
                            '```',
                            message,
                            '```',
                            'After signing, copy the signature and use:',
                            '`/submit-signature <signature>`'
                        ].join('\n')
                    },
                    {
                        name: 'WalletConnect Link',
                        value: `\`${connectionDetails.uri}\``
                    }
                )
                .setImage('attachment://wallet-connect.png')
                .setColor('#0099ff')
                .setFooter({ 
                    text: 'Tip: Mobile users can click the direct links above for easier signing!' 
                });

            await interaction.reply({
                embeds: [embed],
                files: [attachment],
                ephemeral: true
            });

            // Set up event listener for WalletConnect signature
            this.walletConnectionService.connector.on('signature', async (error, payload) => {
                if (error) {
                    await interaction.followUp({
                        content: `Error: ${error.message}`,
                        ephemeral: true
                    });
                    return;
                }

                try {
                    const signature = payload.params[0];
                    const token = await this.verificationService.verifySignature(nonce, signature);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('Wallet Verification Successful')
                        .setDescription('Your wallet has been successfully verified!')
                        .setColor('#00ff00');

                    await interaction.followUp({
                        embeds: [successEmbed],
                        ephemeral: true
                    });

                    // Disconnect WalletConnect session
                    await this.walletConnectionService.disconnect();
                } catch (error) {
                    await interaction.followUp({
                        content: `Error: ${error.message}`,
                        ephemeral: true
                    });
                }
            });
        } catch (error) {
            await interaction.reply({
                content: `Error: ${error.message}`,
                ephemeral: true
            });
        }
    }

    /**
     * Handle the submit-signature command
     */
    async handleSubmitSignature(interaction: CommandInteraction): Promise<void> {
        try {
            const signature = interaction.options.getString('signature', true);
            const nonce = interaction.options.getString('nonce', true);

            // Verify signature
            const token = await this.verificationService.verifySignature(nonce, signature);

            const embed = new EmbedBuilder()
                .setTitle('Wallet Verification Successful')
                .setDescription('Your wallet has been successfully verified!')
                .setColor('#00ff00');

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `Error: ${error.message}`,
                ephemeral: true
            });
        }
    }

    /**
     * Handle the unlink-wallet command
     */
    async handleUnlinkWallet(interaction: CommandInteraction): Promise<void> {
        try {
            await this.verificationService.unlinkWallet(interaction.user.id, 'discord');

            const embed = new EmbedBuilder()
                .setTitle('Wallet Unlinked')
                .setDescription('Your wallet has been successfully unlinked from your Discord account.')
                .setColor('#ff9900');

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `Error: ${error.message}`,
                ephemeral: true
            });
        }
    }

    /**
     * Handle the wallet-info command
     */
    async handleWalletInfo(interaction: CommandInteraction): Promise<void> {
        try {
            const walletAddress = await this.verificationService.getWalletAddress(
                interaction.user.id,
                'discord'
            );

            if (!walletAddress) {
                await interaction.reply({
                    content: 'No wallet is currently linked to your Discord account.',
                    ephemeral: true
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Wallet Information')
                .addFields(
                    { name: 'Linked Wallet', value: walletAddress },
                    { name: 'Discord User', value: interaction.user.tag }
                )
                .setColor('#0099ff');

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `Error: ${error.message}`,
                ephemeral: true
            });
        }
    }
} 