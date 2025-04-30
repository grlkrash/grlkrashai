import { Context } from 'telegraf';
import { TemplateFormatter } from '../../../../challenges/TemplateFormatter';
import { HolderChallengeManager } from '../../../../challenges/HolderChallengeManager';

export function setupChallengeCommands(bot: any, challengeManager: HolderChallengeManager) {
    bot.command('challenge_add', async (ctx: Context) => {
        if (!await isAdmin(ctx)) {
            await ctx.reply('You need administrator permissions to use this command.');
            return;
        }

        const input = ctx.message.text.split('/challenge_add ')[1];
        if (!input) {
            await ctx.reply('Please provide the challenge template. Use /challenge_format to see the required format.');
            return;
        }

        const template = TemplateFormatter.parseTemplateInput(input);
        if (template instanceof Error) {
            await ctx.reply(`Error: ${template.message}`);
            return;
        }

        try {
            const templateId = await challengeManager.addChallengeTemplate(template);
            await ctx.reply(`Challenge template added successfully! Template ID: ${templateId}`);
        } catch (error) {
            await ctx.reply(`Error adding template: ${error.message}`);
        }
    });

    bot.command('challenge_format', async (ctx: Context) => {
        if (!await isAdmin(ctx)) {
            await ctx.reply('You need administrator permissions to use this command.');
            return;
        }

        await ctx.reply(TemplateFormatter.getTemplateFormat(), { parse_mode: 'Markdown' });
    });

    bot.command('challenge_list', async (ctx: Context) => {
        if (!await isAdmin(ctx)) {
            await ctx.reply('You need administrator permissions to use this command.');
            return;
        }

        const templates = challengeManager.getAvailableTemplates();
        if (templates.length === 0) {
            await ctx.reply('No templates available.');
            return;
        }

        const message = templates.map(template => 
            `*${template.name}*\nType: ${template.type}\nDescription: ${template.description}`
        ).join('\n\n');

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });
}

async function isAdmin(ctx: Context): Promise<boolean> {
    const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ['creator', 'administrator'].includes(chatMember.status);
} 