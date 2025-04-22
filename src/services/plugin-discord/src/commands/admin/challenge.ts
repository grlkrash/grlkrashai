import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, MessageEmbed } from 'discord.js';
import { TemplateFormatter } from '../../../../challenges/TemplateFormatter';
import { HolderChallengeManager } from '../../../../challenges/HolderChallengeManager';

export const data = new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Manage challenge templates')
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Add a new challenge template')
            .addStringOption(option =>
                option
                    .setName('template')
                    .setDescription('Challenge template in the required format')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('format')
            .setDescription('Show the template format')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List all available challenge templates')
    );

export async function execute(interaction: CommandInteraction, challengeManager: HolderChallengeManager) {
    if (!interaction.memberPermissions?.has('ADMINISTRATOR')) {
        await interaction.reply({
            content: 'You need administrator permissions to use this command.',
            ephemeral: true
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'add':
            const templateInput = interaction.options.getString('template', true);
            const template = TemplateFormatter.parseTemplateInput(templateInput);

            if (template instanceof Error) {
                await interaction.reply({
                    content: `Error: ${template.message}`,
                    ephemeral: true
                });
                return;
            }

            try {
                const templateId = await challengeManager.addChallengeTemplate(template);
                await interaction.reply({
                    content: `Challenge template added successfully! Template ID: ${templateId}`,
                    ephemeral: true
                });
            } catch (error) {
                await interaction.reply({
                    content: `Error adding template: ${error.message}`,
                    ephemeral: true
                });
            }
            break;

        case 'format':
            const formatEmbed = new MessageEmbed()
                .setTitle('Challenge Template Format')
                .setDescription(TemplateFormatter.getTemplateFormat())
                .setColor('#0099ff');

            await interaction.reply({
                embeds: [formatEmbed],
                ephemeral: true
            });
            break;

        case 'list':
            const templates = challengeManager.getAvailableTemplates();
            const listEmbed = new MessageEmbed()
                .setTitle('Available Challenge Templates')
                .setColor('#0099ff');

            if (templates.length === 0) {
                listEmbed.setDescription('No templates available.');
            } else {
                templates.forEach(template => {
                    listEmbed.addField(
                        template.name,
                        `Type: ${template.type}\nDescription: ${template.description}`
                    );
                });
            }

            await interaction.reply({
                embeds: [listEmbed],
                ephemeral: true
            });
            break;
    }
} 