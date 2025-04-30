import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, MessageEmbed } from 'discord.js';
import { OptimizedAirdropManager } from '../../../../airdrop/AirdropManager';
import { ProgressTracker } from '../../../../tracking/ProgressTracker';
import { AchievementManager } from '../../../../achievements/AchievementManager';

export const data = new SlashCommandBuilder()
    .setName('airdrop')
    .setDescription('Manage token airdrops')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Create a new airdrop')
            .addNumberOption(option =>
                option
                    .setName('amount')
                    .setDescription('Amount of tokens per recipient')
                    .setRequired(true)
            )
            .addNumberOption(option =>
                option
                    .setName('min_holding')
                    .setDescription('Minimum token holding required')
            )
            .addNumberOption(option =>
                option
                    .setName('min_engagement')
                    .setDescription('Minimum engagement score required')
            )
            .addStringOption(option =>
                option
                    .setName('achievement')
                    .setDescription('Required achievement ID')
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check airdrop status')
    );

export async function execute(
    interaction: CommandInteraction,
    airdropManager: OptimizedAirdropManager,
    progressTracker: ProgressTracker,
    achievementManager: AchievementManager
) {
    if (!interaction.memberPermissions?.has('ADMINISTRATOR')) {
        await interaction.reply({
            content: 'You need administrator permissions to use this command.',
            ephemeral: true
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'create':
            await handleCreateAirdrop(
                interaction,
                airdropManager,
                progressTracker,
                achievementManager
            );
            break;

        case 'status':
            await handleAirdropStatus(interaction, airdropManager);
            break;
    }
}

async function handleCreateAirdrop(
    interaction: CommandInteraction,
    airdropManager: OptimizedAirdropManager,
    progressTracker: ProgressTracker,
    achievementManager: AchievementManager
) {
    const amount = interaction.options.getNumber('amount', true);
    const minHolding = interaction.options.getNumber('min_holding');
    const minEngagement = interaction.options.getNumber('min_engagement');
    const requiredAchievement = interaction.options.getString('achievement');

    // Defer reply as this might take a while
    await interaction.deferReply({ ephemeral: true });

    try {
        // Get eligible recipients based on criteria
        const eligibleUsers = await getEligibleRecipients(
            progressTracker,
            achievementManager,
            {
                minHolding,
                minEngagement,
                requiredAchievements: requiredAchievement ? [requiredAchievement] : undefined
            }
        );

        if (eligibleUsers.length === 0) {
            await interaction.editReply('No eligible recipients found for the specified criteria.');
            return;
        }

        // Create airdrop
        const recipients = eligibleUsers.map(u => u.walletAddress);
        const amounts = new Array(recipients.length).fill(amount);

        await airdropManager.queueAirdrop(recipients, amounts, {
            minHolding,
            minEngagement,
            requiredAchievements: requiredAchievement ? [requiredAchievement] : undefined
        });

        const embed = new MessageEmbed()
            .setTitle('Airdrop Queued')
            .setColor('#0099ff')
            .addField('Recipients', eligibleUsers.length.toString(), true)
            .addField('Amount per Recipient', amount.toString(), true)
            .addField('Total Amount', (amount * eligibleUsers.length).toString(), true);

        if (minHolding) embed.addField('Min Holding Required', minHolding.toString());
        if (minEngagement) embed.addField('Min Engagement Required', minEngagement.toString());
        if (requiredAchievement) embed.addField('Required Achievement', requiredAchievement);

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error creating airdrop:', error);
        await interaction.editReply('Error creating airdrop. Please check the logs.');
    }
}

async function handleAirdropStatus(
    interaction: CommandInteraction,
    airdropManager: OptimizedAirdropManager
) {
    // Implementation would depend on how we track airdrop status
    await interaction.reply({
        content: 'Airdrop status feature coming soon.',
        ephemeral: true
    });
}

async function getEligibleRecipients(
    progressTracker: ProgressTracker,
    achievementManager: AchievementManager,
    criteria: {
        minHolding?: number;
        minEngagement?: number;
        requiredAchievements?: string[];
    }
): Promise<Array<{ userId: string; walletAddress: string }>> {
    // This would need to be implemented based on your user data structure
    // and how you track wallet addresses
    return [];
} 