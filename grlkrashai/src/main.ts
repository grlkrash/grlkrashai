import { WalletService } from './services/authentication/WalletService';
import { ethers, Event } from 'ethers';
import { Chatbot } from './services/chatbot/ChatbotService';
import { BASIC_CONTENT, PREMIUM_CONTENT, ELITE_CONTENT, getRandomContent } from './constants/content';

// Contract ABIs
import MemoryCrystalABI from '../artifacts/contracts/MemoryCrystal.sol/MemoryCrystal.json';
import CrystalHolderABI from '../artifacts/contracts/CrystalHolder.sol/CrystalHolder.json';

// Import collaboration components
import { CollaborationService } from './services/collaboration/CollaborationService';
import { commands as collaborationCommands, handleGenerate3D, handleCoWrite, handleTrain3D, handleTrainLyrics } from './commands/collaborationCommands';
import { HealthMonitor } from './services/collaboration/HealthMonitor';

class App {
    private walletService: WalletService;
    private networkStatus: HTMLElement;
    private walletError: HTMLElement;
    private dashboard: HTMLElement;
    private walletAddress: HTMLElement;
    private moreBalance: HTMLElement;
    private forgeAnimation: HTMLElement;
    private forgeOutput: HTMLElement;
    private autoConnectToggle: HTMLInputElement;
    private establishPresenceButton: HTMLButtonElement;
    private chatbot: Chatbot;
    private memoryCrystal: ethers.Contract;
    private crystalHolder: ethers.Contract;
    private commandInput: HTMLInputElement;
    private commandOutput: HTMLElement;
    private turnButton: HTMLElement;

    constructor() {
        this.walletService = WalletService.getInstance();
        this.chatbot = new Chatbot(this.updateCommandOutput.bind(this));
        
        // Get UI elements
        this.networkStatus = document.getElementById('networkStatus')!;
        this.walletError = document.getElementById('walletError')!;
        this.dashboard = document.getElementById('dashboard')!;
        this.walletAddress = document.getElementById('walletAddress')!;
        this.moreBalance = document.getElementById('moreBalance')!;
        this.forgeAnimation = document.getElementById('forgeAnimation')!;
        this.forgeOutput = document.getElementById('forgeOutput')!;
        this.autoConnectToggle = document.getElementById('autoConnectToggle') as HTMLInputElement;
        this.establishPresenceButton = document.getElementById('establishPresence') as HTMLButtonElement;
        this.commandInput = document.getElementById('commandInput') as HTMLInputElement;
        this.commandOutput = document.getElementById('commandOutput')!;
        this.turnButton = document.getElementById('turnButton')!;

        this.initializeUI();
        this.initializeCommandInterface();
    }

    private async initializeUI() {
        // Set up auto-connect toggle
        this.autoConnectToggle.checked = this.walletService.isAutoConnectEnabled();
        this.autoConnectToggle.addEventListener('change', () => {
            this.walletService.toggleAutoConnect();
        });

        // Set up establish presence button
        this.establishPresenceButton.addEventListener('click', async () => {
            await this.connectWallet();
            await this.initializeContracts();
        });

        // Check if we should auto-connect
        if (this.walletService.isAutoConnectEnabled()) {
            await this.connectWallet();
        }
    }

    private async connectWallet() {
        try {
            this.showLoading(true);
            this.hideError();

            const address = await this.walletService.loginOrCreate();
            
            // Update UI with connected state
            this.walletAddress.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
            await this.updateBalance();
            
            // Show dashboard
            this.dashboard.style.display = 'block';
            
            // Update network status
            this.networkStatus.textContent = 'Connected to Base Sepolia';
            this.networkStatus.className = 'network-status success';

        } catch (error: any) {
            console.error('Wallet connection error:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    private async updateBalance() {
        try {
            const balance = await this.walletService.getMoreBalance();
            this.moreBalance.textContent = `${Number(balance).toFixed(6)} $MORE`;
        } catch (error) {
            console.error('Error updating balance:', error);
            this.moreBalance.textContent = 'Error loading balance';
        }
    }

    private showLoading(isLoading: boolean) {
        this.establishPresenceButton.textContent = isLoading ? 
            'ESTABLISHING DIGITAL PRESENCE...' : 
            'ESTABLISH DIGITAL PRESENCE';
        this.establishPresenceButton.disabled = isLoading;
    }

    private showError(message: string) {
        this.walletError.textContent = message;
        this.walletError.style.display = 'block';
        this.networkStatus.textContent = 'Connection Failed';
        this.networkStatus.className = 'network-status error';
    }

    private hideError() {
        this.walletError.style.display = 'none';
        this.networkStatus.textContent = '';
        this.networkStatus.className = 'network-status';
    }

    private async initializeContracts() {
        try {
            const signer = await this.walletService.getSigner();
            if (!signer) throw new Error('No signer available');

            // Initialize Memory Crystal contract
            this.memoryCrystal = new ethers.Contract(
                process.env.MEMORY_CRYSTAL_ADDRESS!,
                MemoryCrystalABI.abi,
                signer
            );

            // Initialize Crystal Holder contract
            this.crystalHolder = new ethers.Contract(
                process.env.CRYSTAL_HOLDER_ADDRESS!,
                CrystalHolderABI.abi,
                signer
            );

            // Update crystal vault display
            await this.updateCrystalVault();

        } catch (error: any) {
            console.error('Failed to initialize contracts:', error);
            this.showError('Failed to initialize contracts: ' + error.message);
        }
    }

    private async updateCrystalVault() {
        const crystalGrid = document.getElementById('crystalGrid');
        if (!crystalGrid) return;

        try {
            // Get user's holder ID
            const holderId = await this.crystalHolder.getHolderId(await this.walletService.getAddress());
            if (holderId.toString() === '0') {
                // User doesn't have a holder yet
                crystalGrid.innerHTML = '<p>No crystals found. Forge your first crystal to begin!</p>';
                return;
            }

            // Get bound crystals
            const crystals = await this.crystalHolder.getBoundCrystals(holderId);
            
            if (crystals.length === 0) {
                crystalGrid.innerHTML = '<p>No crystals found. Forge your first crystal to begin!</p>';
                return;
            }

            // Clear and update grid
            crystalGrid.innerHTML = '';
            for (const crystalId of crystals) {
                const crystal = await this.memoryCrystal.crystals(crystalId);
                const card = this.createCrystalCard(crystalId, crystal);
                crystalGrid.appendChild(card);
            }

        } catch (error: any) {
            console.error('Error updating crystal vault:', error);
            crystalGrid.innerHTML = '<p>Error loading crystals: ' + error.message + '</p>';
        }
    }

    private createCrystalCard(tokenId: string, crystal: any) {
        const card = document.createElement('div');
        card.className = 'crystal-card';
        card.innerHTML = `
            <h4>Crystal #${tokenId}</h4>
            <p>Type: ${['BASIC', 'PREMIUM', 'ELITE'][crystal.accessLevel]}</p>
            <button onclick="playCrystal('${tokenId}')">PLAY</button>
        `;
        return card;
    }

    private async playCrystal(tokenId: string) {
        try {
            const uri = await this.memoryCrystal.getMediaURI(tokenId);
            // TODO: Implement media playback based on content type
            console.log('Playing crystal:', uri);
        } catch (error: any) {
            console.error('Error playing crystal:', error);
        }
    }

    private async initializeCommandInterface() {
        // Set up command input handlers
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.processCommand();
            }
        });

        this.turnButton.addEventListener('click', () => {
            this.processCommand();
        });

        // Show initial welcome message
        await this.updateCommandOutput('🔮 MEMORY CRYSTAL INTERFACE v1.0\n\nType HELP to see available commands.');
    }

    private async processCommand() {
        const command = this.commandInput.value.trim();
        if (!command) return;

        // Clear input
        this.commandInput.value = '';

        // Show command in output
        await this.updateCommandOutput(`> ${command}\n`);

        // Process command through chatbot
        await this.chatbot.processMessage(command);
    }

    private async updateCommandOutput(message: string) {
        // Append new message
        this.commandOutput.innerHTML += message + '\n';
        
        // Auto-scroll to bottom
        this.commandOutput.scrollTop = this.commandOutput.scrollHeight;
    }

    private async forgeCrystal(crystalType: string) {
        const forgeStatus = document.getElementById('forgeStatus');
        
        try {
            if (forgeStatus) forgeStatus.textContent = 'FORGING CRYSTAL...';
            
            // Get cost for selected crystal type
            const cost = await this.memoryCrystal.getMintCost(crystalType);
            
            // Forge the crystal
            const forgeTx = await this.memoryCrystal.forgeCrystal(crystalType, { value: cost });
            const forgeReceipt = await forgeTx.wait();
            
            // Get crystal ID from event
            const event = forgeReceipt.events?.find((e: Event) => e.event === 'CrystalForged');
            if (!event) throw new Error('Crystal forge event not found');
            const crystalId = event.args?.[0];
            
            // Set content URI based on access level
            if (forgeStatus) forgeStatus.textContent = 'SETTING CONTENT...';
            
            const selectedContent = getRandomContent(parseInt(crystalType) as 0 | 1 | 2);
            
            if (selectedContent) {
                await this.memoryCrystal.setContentURI(crystalId, selectedContent.contentURI);
            }
            
            // Bind the crystal to holder
            if (forgeStatus) forgeStatus.textContent = 'BINDING CRYSTAL...';
            
            try {
                // Ask user to confirm binding and warn about popup
                if (!confirm('Crystal forged successfully! Click OK to bind it to your holder. Please ensure popups are allowed for this site.')) {
                    throw new Error('Crystal binding cancelled by user');
                }
                
                // Add a longer delay before binding to ensure wallet UI is ready
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Use fixed gas limit for binding
                const bindTx = await this.crystalHolder.bindCrystal(crystalId, {
                    gasLimit: 100000 // Fixed gas limit that should be sufficient for binding
                });
                
                if (forgeStatus) forgeStatus.textContent = 'CONFIRMING BIND...';
                const bindReceipt = await bindTx.wait();
                
                if (!bindReceipt.status) {
                    throw new Error('Crystal binding failed');
                }
                
                // Update crystal vault display
                if (forgeStatus) forgeStatus.textContent = 'UPDATING VAULT...';
                await this.updateCrystalVault();
                
                alert(`Successfully forged and bound Crystal #${crystalId}!`);
            } catch (bindError) {
                console.error('Error binding crystal:', bindError);
                throw new Error(`Failed to bind crystal: ${bindError.message}`);
            }
        } catch (error) {
            console.error('Error forging crystal:', error);
            if (forgeStatus) forgeStatus.textContent = 'FORGE FAILED';
            throw error;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

async function forgeCrystal(crystalType: string) {
    // ... existing code ...

    // Set content URI based on access level
    if (forgeStatus) forgeStatus.textContent = 'SETTING CONTENT...';
    
    const selectedContent = getRandomContent(parseInt(crystalType) as 0 | 1 | 2);
    
    if (selectedContent) {
        await memoryCrystal.setContentURI(crystalId, selectedContent.contentURI);
    }

    // ... rest of existing code ...
}

// Initialize services
const collaborationService = new CollaborationService(runtime);
const healthMonitor = new HealthMonitor(collaborationService);

// Register health monitoring handlers
healthMonitor.on('healthAlert', async (status) => {
    console.error('🚨 Health Alert:', {
        status: status.status,
        recommendations: status.recommendations,
        metrics: {
            errorRate: `${((status.metrics.failedOperations / (status.metrics.successfulOperations + status.metrics.failedOperations)) * 100).toFixed(1)}%`,
            recoveryRate: `${((status.metrics.successfulRecoveries / status.metrics.recoveryAttempts) * 100).toFixed(1)}%`,
            uptime: `${(status.metrics.uptime / (1000 * 60 * 60)).toFixed(1)} hours`,
            memoryUsage: `${((status.metrics.memoryUsage.heapUsed / status.metrics.memoryUsage.heapTotal) * 100).toFixed(1)}%`
        }
    });

    // Send alert to Discord if configured
    if (process.env.DISCORD_ALERT_CHANNEL) {
        try {
            const channel = await client.channels.fetch(process.env.DISCORD_ALERT_CHANNEL);
            if (channel?.isText()) {
                await channel.send({
                    embeds: [{
                        title: '🚨 Collaboration Service Health Alert',
                        color: status.status === 'unhealthy' ? 0xFF0000 : 0xFFA500,
                        fields: [
                            {
                                name: 'Status',
                                value: status.status.toUpperCase(),
                                inline: true
                            },
                            {
                                name: 'Error Rate',
                                value: `${((status.metrics.failedOperations / (status.metrics.successfulOperations + status.metrics.failedOperations)) * 100).toFixed(1)}%`,
                                inline: true
                            },
                            {
                                name: 'Recovery Rate',
                                value: `${((status.metrics.successfulRecoveries / status.metrics.recoveryAttempts) * 100).toFixed(1)}%`,
                                inline: true
                            },
                            {
                                name: 'Recommendations',
                                value: status.recommendations.join('\n') || 'None',
                            },
                            {
                                name: 'Last Error',
                                value: status.metrics.lastError ? 
                                    `${status.metrics.lastError.context}: ${status.metrics.lastError.message}` : 
                                    'None'
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                });
            }
        } catch (error) {
            console.error('Failed to send health alert to Discord:', error);
        }
    }
});

// Add health check command
const commands = [
    // ... existing commands ...
    new SlashCommandBuilder()
        .setName('health')
        .setDescription('Check the health status of collaboration services')
];

export async function handleHealthCheck(interaction: CommandInteraction) {
    try {
        const status = await healthMonitor.getHealthStatus();
        
        const statusEmoji = {
            healthy: '✅',
            degraded: '⚠️',
            unhealthy: '❌'
        };

        await interaction.reply({
            embeds: [{
                title: `${statusEmoji[status.status]} Collaboration Service Health Status`,
                color: status.status === 'healthy' ? 0x00FF00 : status.status === 'degraded' ? 0xFFA500 : 0xFF0000,
                fields: [
                    {
                        name: 'Status',
                        value: status.status.toUpperCase(),
                        inline: true
                    },
                    {
                        name: 'Uptime',
                        value: `${(status.metrics.uptime / (1000 * 60 * 60)).toFixed(1)} hours`,
                        inline: true
                    },
                    {
                        name: 'Success Rate',
                        value: `${((status.metrics.successfulOperations / (status.metrics.successfulOperations + status.metrics.failedOperations)) * 100).toFixed(1)}%`,
                        inline: true
                    },
                    {
                        name: 'Memory Usage',
                        value: `${((status.metrics.memoryUsage.heapUsed / status.metrics.memoryUsage.heapTotal) * 100).toFixed(1)}%`,
                        inline: true
                    },
                    {
                        name: 'Recovery Success Rate',
                        value: status.metrics.recoveryAttempts > 0 ? 
                            `${((status.metrics.successfulRecoveries / status.metrics.recoveryAttempts) * 100).toFixed(1)}%` :
                            'N/A',
                        inline: true
                    },
                    {
                        name: 'Recommendations',
                        value: status.recommendations.join('\n') || 'None',
                    }
                ],
                timestamp: new Date().toISOString()
            }],
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: `❌ Error checking health status: ${error.message}`,
            ephemeral: true
        });
    }
}

// Register collaboration commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
        // ... existing command cases ...
        
        case 'health':
            await handleHealthCheck(interaction);
            break;
    }
}); 