import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, MessageEmbed } from 'discord.js';
import { ProgressTracker } from '../../../../tracking/ProgressTracker';
import { AchievementManager } from '../../../../achievements/AchievementManager';

export const data = new SlashCommandBuilder()
    .setName('progress')
    .setDescription('View your progress and achievements')
    .addSubcommand(subcommand =>
        subcommand
            .setName('overview')
            .setDescription('View your overall progress')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('achievements')
            .setDescription('View your earned achievements')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('activity')
            .setDescription('View your recent activity')
            .addStringOption(option =>
                option
                    .setName('type')
                    .setDescription('Type of activity to view')
                    .addChoices(
                        { name: 'All', value: 'all' },
                        { name: 'Posts', value: 'post' },
                        { name: 'Comments', value: 'comment' },
                        { name: 'Shares', value: 'share' }
                    )
            )
    );

export async function execute(
    interaction: CommandInteraction,
    progressTracker: ProgressTracker,
    achievementManager: AchievementManager
) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (subcommand) {
        case 'overview':
            await handleOverview(interaction, userId, progressTracker);
            break;
        case 'achievements':
            await handleAchievements(interaction, userId, achievementManager);
            break;
        case 'activity':
            await handleActivity(interaction, userId, progressTracker);
            break;
    }
}

async function handleOverview(
    interaction: CommandInteraction,
    userId: string,
    progressTracker: ProgressTracker
) {
    const progress = progressTracker.getUserProgress(userId);
    if (!progress) {
        await interaction.reply({
            content: 'No progress data found. Start participating to earn points and achievements!',
            ephemeral: true
        });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle('Your Progress Overview')
        .setColor('#0099ff')
        .addField('Level', progress.level.toString(), true)
        .addField('Total Points', progress.totalPoints.toString(), true)
        .addField('Achievements', progress.achievements.length.toString(), true);

    // Add activity summary
    const activitySummary = progress.activities
        .map(a => `${a.type}: ${a.count}`)
        .join('\n');

    embed.addField('Activity Summary', activitySummary || 'No activities yet');

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleAchievements(
    interaction: CommandInteraction,
    userId: string,
    achievementManager: AchievementManager
) {
    const achievements = achievementManager.getUserAchievements(userId);
    const embed = new MessageEmbed()
        .setTitle('Your Achievements')
        .setColor('#0099ff');

    if (achievements.length === 0) {
        embed.setDescription('No achievements earned yet. Keep participating to earn badges!');
    } else {
        achievements.forEach(achievement => {
            const progress = achievementManager.getUserProgress(userId, achievement.id);
            const progressText = progress
                ? progress.progress
                    .map(p => `${p.type}: ${p.current}/${p.required}`)
                    .join('\n')
                : 'Completed!';

            embed.addField(
                `${achievement.name} (${achievement.category})`,
                `${achievement.description}\nProgress:\n${progressText}`
            );
        });
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleActivity(
    interaction: CommandInteraction,
    userId: string,
    progressTracker: ProgressTracker
) {
    const type = interaction.options.getString('type');
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const history = progressTracker.getActivityHistory(
        userId,
        type === 'all' ? undefined : type,
        weekAgo,
        now
    );

    const embed = new MessageEmbed()
        .setTitle('Your Recent Activity')
        .setColor('#0099ff');

    if (history.length === 0) {
        embed.setDescription('No recent activity found.');
    } else {
        const activityGroups = new Map<string, number>();
        history.forEach(event => {
            const count = activityGroups.get(event.type) || 0;
            activityGroups.set(event.type, count + 1);
        });

        const summary = Array.from(activityGroups.entries())
            .map(([type, count]) => `${type}: ${count}`)
            .join('\n');

        embed.addField('Last 7 Days', summary);

        // Add recent events
        const recentEvents = history
            .slice(0, 5)
            .map(event => {
                const date = event.timestamp.toLocaleDateString();
                return `${date}: ${event.type}`;
            })
            .join('\n');

        embed.addField('Recent Events', recentEvents);
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
} 