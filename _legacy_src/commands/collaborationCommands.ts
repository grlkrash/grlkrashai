import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, MessageAttachment } from 'discord.js';
import { CollaborationService } from '../services/collaboration/CollaborationService';
import { WalletService } from '../services/authentication/WalletService';
import path from 'path';
import { ResourceManager, EventController } from '../utils/ResourceControl';

const MIN_MORE_BALANCE = 1000; // Minimum $MORE required for collaboration features

interface TrainingProgress {
    currentEpoch: number;
    totalEpochs: number;
    currentLoss?: number;
    currentAccuracy?: number;
}

const activeListeners = new WeakMap<CollaborationService, NodeJS.Timeout>();

async function checkMoreBalance(interaction: CommandInteraction): Promise<boolean> {
    try {
        const walletService = WalletService.getInstance();
        const userAddress = await walletService.getAddressFromDiscordId(interaction.user.id);
        
        if (!userAddress) {
            await interaction.reply({
                content: '❌ Please connect your wallet first using `/connect-wallet`',
                ephemeral: true
            });
            return false;
        }

        const balance = await walletService.getMoreBalance(userAddress);
        if (balance < MIN_MORE_BALANCE) {
            await interaction.reply({
                content: `❌ You need at least ${MIN_MORE_BALANCE} $MORE tokens to access collaboration features. Your balance: ${balance.toFixed(2)} $MORE`,
                ephemeral: true
            });
            return false;
        }

        return true;
    } catch (error) {
        await interaction.reply({
            content: `❌ Error checking balance: ${error.message}`,
            ephemeral: true
        });
        return false;
    }
}

async function checkServiceReady(interaction: CommandInteraction, collaborationService: CollaborationService): Promise<boolean> {
    try {
        const state = await collaborationService.getServiceState();
        
        if (state.state === 'ERROR') {
            await interaction.reply({
                content: `❌ Service is not available: ${state.error}`,
                ephemeral: true
            });
            return false;
        }
        
        if (state.state !== 'READY') {
            await interaction.reply({
                content: '⏳ Service is still initializing. Please try again in a moment.',
                ephemeral: true
            });
            return false;
        }

        return true;
    } catch (error) {
        await interaction.reply({
            content: `❌ Error checking service state: ${error.message}`,
            ephemeral: true
        });
        return false;
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('generate3d')
        .setDescription('Generate a 3D model based on GRLKRASH style (Requires 1000 $MORE)')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('What you want to generate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('base_model')
                .setDescription('Base model to use (grlkrash, toybox, forest)')
                .setRequired(true)
                .addChoices(
                    { name: 'GRLKRASH Character', value: 'grlkrash.blend' },
                    { name: 'Toybox', value: 'toybox.blend' },
                    { name: 'Forest Scene', value: 'forest_scene_compiled.blend' }
                )),
        
    new SlashCommandBuilder()
        .setName('cowrite')
        .setDescription('Co-write lyrics with GRLKRASHai (Requires 1000 $MORE)')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your lyric idea or theme')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Reference song style')
                .setRequired(true)
                .addChoices(
                    { name: 'RIDE OR DIE', value: 'RIDE OR DIE - GRLKRASH LYRICS.txt' },
                    { name: 'PSILOCYBIN', value: 'PSILOCYBIN- GRLKRASH LYRICS.txt' },
                    { name: 'MORE', value: 'MORE - GRLKRASH LYRICS.txt' }
                )),

    new SlashCommandBuilder()
        .setName('train3d')
        .setDescription('Train the 3D generation model (Requires 1000 $MORE)')
        .addIntegerOption(option =>
            option.setName('epochs')
                .setDescription('Number of training epochs')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('batch_size')
                .setDescription('Batch size for training')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('trainlyrics')
        .setDescription('Train the lyric generation model (Requires 1000 $MORE)')
        .addIntegerOption(option =>
            option.setName('epochs')
                .setDescription('Number of training epochs')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('batch_size')
                .setDescription('Batch size for training')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('collab-status')
        .setDescription('Check the status of collaboration services'),
];

export async function handleCollabStatus(interaction: CommandInteraction, collaborationService: CollaborationService) {
    try {
        const state = await collaborationService.getServiceState();
        
        const statusEmoji = {
            UNINITIALIZED: '⚪',
            INITIALIZING: '🔄',
            READY: '✅',
            ERROR: '❌'
        };

        await interaction.reply({
            content: `Collaboration Service Status:\n` +
                    `${statusEmoji[state.state]} State: ${state.state}\n` +
                    `📚 Loaded Models: ${state.modelCount || 0}\n` +
                    `🎵 Loaded Lyrics: ${state.lyricCount || 0}\n` +
                    (state.error ? `❌ Error: ${state.error}` : ''),
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: `❌ Error getting service status: ${error.message}`,
            ephemeral: true
        });
    }
}

export async function handleGenerate3D(interaction: CommandInteraction, collaborationService: CollaborationService) {
    if (!await checkServiceReady(interaction, collaborationService)) return;
    if (!await checkMoreBalance(interaction)) return;
    
    await interaction.deferReply();
    
    try {
        const prompt = interaction.options.getString('prompt', true);
        const baseModel = interaction.options.getString('base_model', true);

        const modelPath = await collaborationService.generate3DModel(prompt, {
            baseModel,
            temperature: 0.8
        });

        await interaction.editReply({
            content: '🎨 Generated 3D model based on your prompt!',
            files: [new MessageAttachment(modelPath)]
        });
    } catch (error) {
        await interaction.editReply(`❌ Error generating 3D model: ${error.message}`);
    }
}

export async function handleCoWrite(interaction: CommandInteraction, collaborationService: CollaborationService) {
    if (!await checkServiceReady(interaction, collaborationService)) return;
    if (!await checkMoreBalance(interaction)) return;
    
    await interaction.deferReply();
    
    try {
        const prompt = interaction.options.getString('prompt', true);
        const style = interaction.options.getString('style', true);

        const lyrics = await collaborationService.generateLyrics(prompt, {
            baseModel: style,
            temperature: 0.9
        });

        await interaction.editReply({
            content: '✍️ Here are your co-written lyrics:\n\n```' + lyrics + '```'
        });
    } catch (error) {
        await interaction.editReply(`❌ Error generating lyrics: ${error.message}`);
    }
}

async function attachTrainingListeners(
    interaction: CommandInteraction,
    collaborationService: CollaborationService,
    type: '3d' | 'lyrics',
    epochs: number
): Promise<() => void> {
    let lastUpdate = Date.now();
    const minUpdateInterval = 5000;
    const progress: TrainingProgress = {
        currentEpoch: 0,
        totalEpochs: epochs
    };

    const onProgress = async (epochData: any) => {
        const now = Date.now();
        if (now - lastUpdate >= minUpdateInterval && collaborationService.emit(`${type}TrainingProgress`, epochData)) {
            progress.currentEpoch = epochData.epoch;
            progress.currentLoss = epochData.loss;
            progress.currentAccuracy = epochData.accuracy;

            try {
                await interaction.editReply({
                    content: `🚀 Training in progress...\n` +
                            `Epoch: ${progress.currentEpoch}/${progress.totalEpochs}\n` +
                            `Loss: ${progress.currentLoss?.toFixed(4) || 'N/A'}\n` +
                            `Accuracy: ${(progress.currentAccuracy || 0) * 100}%`
                });
                lastUpdate = now;
            } catch (error) {
                console.error('Failed to update progress:', error);
            }
        }
    };

    const cleanup = () => {
        collaborationService.off(`${type}TrainingProgress`, onProgress);
        collaborationService.off('error', onError);
        const timeout = activeListeners.get(collaborationService);
        if (timeout) clearTimeout(timeout);
        activeListeners.delete(collaborationService);
    };

    const onError = (error: Error) => {
        cleanup();
        interaction.editReply(`❌ Training error: ${error.message}`).catch(console.error);
    };

    collaborationService.on(`${type}TrainingProgress`, onProgress);
    collaborationService.on('error', onError);

    const timeout = setTimeout(cleanup, 2 * 60 * 60 * 1000);
    activeListeners.set(collaborationService, timeout);

    return cleanup;
}

export async function handleTrain3D(interaction: CommandInteraction, collaborationService: CollaborationService) {
    if (!await checkServiceReady(interaction, collaborationService)) return;
    if (!await checkMoreBalance(interaction)) return;
    
    await interaction.deferReply();
    
    try {
        const epochs = interaction.options.getInteger('epochs', true);
        const batchSize = interaction.options.getInteger('batch_size', true);

        await interaction.editReply('🔄 Starting 3D model training...');
        
        const cleanup = await attachTrainingListeners(interaction, collaborationService, '3d', epochs);
        
        try {
            const metrics = await collaborationService.train3DModel({ epochs, batchSize });
            
            await interaction.editReply({
                content: `✅ 3D model training completed!\n\nMetrics:\n` +
                        `• Loss: ${metrics.loss.toFixed(4)}\n` +
                        `• Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%\n` +
                        `• Epochs completed: ${metrics.epochsCompleted}`
            });
        } finally {
            cleanup(); // Always remove event listeners
        }
    } catch (error) {
        await interaction.editReply(`❌ Error training 3D model: ${error.message}`);
    }
}

export async function handleTrainLyrics(interaction: CommandInteraction, collaborationService: CollaborationService) {
    if (!await checkServiceReady(interaction, collaborationService)) return;
    if (!await checkMoreBalance(interaction)) return;
    
    await interaction.deferReply();
    
    try {
        const epochs = interaction.options.getInteger('epochs', true);
        const batchSize = interaction.options.getInteger('batch_size', true);

        await interaction.editReply('🔄 Starting lyrics model training...');
        
        const cleanup = await attachTrainingListeners(interaction, collaborationService, 'lyrics', epochs);
        
        try {
            const metrics = await collaborationService.trainLyricGeneration({ epochs, batchSize });
            
            await interaction.editReply({
                content: `✅ Lyrics model training completed!\n\nMetrics:\n` +
                        `• Loss: ${metrics.loss.toFixed(4)}\n` +
                        `• Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%\n` +
                        `• Epochs completed: ${metrics.epochsCompleted}`
            });
        } finally {
            cleanup(); // Always remove event listeners
        }
    } catch (error) {
        await interaction.editReply(`❌ Error training lyrics model: ${error.message}`);
    }
}

export { commands }; 