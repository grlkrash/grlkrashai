import { Context } from 'telegraf';
import { ProgressTracker } from '../../../../tracking/ProgressTracker';
import { AchievementManager } from '../../../../achievements/AchievementManager';

export function setupProgressCommands(
    bot: any,
    progressTracker: ProgressTracker,
    achievementManager: AchievementManager
) {
    bot.command('progress', async (ctx: Context) => {
        const userId = ctx.from.id.toString();
        await handleOverview(ctx, userId, progressTracker);
    });

    bot.command('achievements', async (ctx: Context) => {
        const userId = ctx.from.id.toString();
        await handleAchievements(ctx, userId, achievementManager);
    });

    bot.command('activity', async (ctx: Context) => {
        const userId = ctx.from.id.toString();
        const args = ctx.message.text.split(' ');
        const type = args[1] || 'all';
        await handleActivity(ctx, userId, type, progressTracker);
    });
}

async function handleOverview(
    ctx: Context,
    userId: string,
    progressTracker: ProgressTracker
) {
    const progress = progressTracker.getUserProgress(userId);
    if (!progress) {
        await ctx.reply('No progress data found. Start participating to earn points and achievements!');
        return;
    }

    const message = [
        '*Your Progress Overview*',
        '',
        `Level: ${progress.level}`,
        `Total Points: ${progress.totalPoints}`,
        `Achievements: ${progress.achievements.length}`,
        '',
        '*Activity Summary:*',
        ...progress.activities.map(a => `${a.type}: ${a.count}`)
    ].join('\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleAchievements(
    ctx: Context,
    userId: string,
    achievementManager: AchievementManager
) {
    const achievements = achievementManager.getUserAchievements(userId);
    
    if (achievements.length === 0) {
        await ctx.reply('No achievements earned yet. Keep participating to earn badges!');
        return;
    }

    const message = [
        '*Your Achievements*',
        '',
        ...achievements.map(achievement => {
            const progress = achievementManager.getUserProgress(userId, achievement.id);
            const progressText = progress
                ? progress.progress
                    .map(p => `${p.type}: ${p.current}/${p.required}`)
                    .join('\n')
                : 'Completed!';

            return [
                `*${achievement.name}* (${achievement.category})`,
                achievement.description,
                'Progress:',
                progressText,
                ''
            ].join('\n');
        })
    ].join('\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleActivity(
    ctx: Context,
    userId: string,
    type: string,
    progressTracker: ProgressTracker
) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const history = progressTracker.getActivityHistory(
        userId,
        type === 'all' ? undefined : type,
        weekAgo,
        now
    );

    if (history.length === 0) {
        await ctx.reply('No recent activity found.');
        return;
    }

    const activityGroups = new Map<string, number>();
    history.forEach(event => {
        const count = activityGroups.get(event.type) || 0;
        activityGroups.set(event.type, count + 1);
    });

    const message = [
        '*Your Recent Activity*',
        '',
        '*Last 7 Days:*',
        ...Array.from(activityGroups.entries()).map(([type, count]) => `${type}: ${count}`),
        '',
        '*Recent Events:*',
        ...history
            .slice(0, 5)
            .map(event => `${event.timestamp.toLocaleDateString()}: ${event.type}`)
    ].join('\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });
} 