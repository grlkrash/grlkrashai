import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, MessageEmbed } from 'discord.js';
import { GovernanceManager } from '../../../governance/GovernanceManager';
import { TokenContract } from '../../../types/contracts';
import { NLPService } from '../../../services/nlp/NLPService';

const MINIMUM_PROPOSAL_TOKENS = 1000;
const MINIMUM_VOTING_TOKENS = 100;

export const data = new SlashCommandBuilder()
    .setName('governance')
    .setDescription('Interact with governance system')
    .addSubcommandGroup(group =>
        group
            .setName('propose')
            .setDescription('Create proposals')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('create')
                    .setDescription('Create a new proposal with specific fields')
                    .addStringOption(option =>
                        option
                            .setName('title')
                            .setDescription('Proposal title')
                            .setRequired(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('description')
                            .setDescription('Proposal description')
                            .setRequired(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('execution_data')
                            .setDescription('Technical execution data (optional)')
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('natural')
                    .setDescription('Create a proposal using natural language')
                    .addStringOption(option =>
                        option
                            .setName('text')
                            .setDescription('Describe your proposal in natural language')
                            .setRequired(true)
                    )
            )
    )
    .addSubcommandGroup(group =>
        group
            .setName('vote')
            .setDescription('Vote on proposals')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('cast')
                    .setDescription('Cast a vote with specific options')
                    .addIntegerOption(option =>
                        option
                            .setName('proposal_id')
                            .setDescription('ID of the proposal')
                            .setRequired(true)
                    )
                    .addBooleanOption(option =>
                        option
                            .setName('support')
                            .setDescription('True for support, false against')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('natural')
                    .setDescription('Cast a vote using natural language')
                    .addStringOption(option =>
                        option
                            .setName('text')
                            .setDescription('Express your vote in natural language')
                            .setRequired(true)
                    )
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List active proposals')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View details of a specific proposal')
            .addIntegerOption(option =>
                option
                    .setName('proposal_id')
                    .setDescription('ID of the proposal')
                    .setRequired(true)
            )
    );

export async function execute(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager,
    tokenContract: TokenContract,
    nlpService: NLPService
) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    // Check token balance for propose and vote actions
    if (subcommandGroup === 'propose' || subcommandGroup === 'vote') {
        const balance = await tokenContract.balanceOf(interaction.user.id);
        const requiredAmount = subcommandGroup === 'propose' ? 
            MINIMUM_PROPOSAL_TOKENS : MINIMUM_VOTING_TOKENS;

        if (balance < requiredAmount) {
            await interaction.reply({
                content: `You need at least ${requiredAmount} MORE tokens to ${subcommandGroup}. Current balance: ${balance}`,
                ephemeral: true
            });
            return;
        }
    }

    switch (subcommandGroup) {
        case 'propose':
            if (subcommand === 'natural') {
                await handleNaturalProposal(interaction, governanceManager, nlpService);
            } else {
                await handlePropose(interaction, governanceManager);
            }
            break;
        case 'vote':
            if (subcommand === 'natural') {
                await handleNaturalVote(interaction, governanceManager, nlpService);
            } else {
                await handleVote(interaction, governanceManager);
            }
            break;
        default:
            switch (subcommand) {
                case 'list':
                    await handleList(interaction, governanceManager);
                    break;
                case 'view':
                    await handleView(interaction, governanceManager);
                    break;
            }
    }
}

async function handleNaturalProposal(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager,
    nlpService: NLPService
) {
    const text = interaction.options.getString('text', true);
    
    try {
        const { title, description, executionData } = await nlpService.parseProposal(text);
        
        const proposal = await governanceManager.createProposal(
            interaction.user.id,
            title,
            description,
            executionData
        );

        const embed = new MessageEmbed()
            .setTitle('Proposal Created from Natural Language')
            .setColor('#0099ff')
            .addField('ID', proposal.id.toString())
            .addField('Interpreted Title', title)
            .addField('Interpreted Description', description)
            .addField('Voting Period', `Ends <t:${Math.floor(proposal.endTime / 1000)}:R>`)
            .addField('Minimum Quorum', proposal.minimumQuorum.toString());

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({
            content: `Error creating proposal: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleNaturalVote(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager,
    nlpService: NLPService
) {
    const text = interaction.options.getString('text', true);
    
    try {
        const { proposalId, support } = await nlpService.parseVote(text);
        
        await governanceManager.castVote(
            interaction.user.id,
            proposalId,
            support
        );

        const proposal = governanceManager.getProposal(proposalId);
        const embed = new MessageEmbed()
            .setTitle('Vote Cast from Natural Language')
            .setColor('#0099ff')
            .addField('Proposal', proposal.title)
            .addField('Interpreted Vote', support ? 'For' : 'Against')
            .addField('Current Votes For', proposal.votesFor.toString())
            .addField('Current Votes Against', proposal.votesAgainst.toString());

        await interaction.reply({
            content: 'Your vote has been recorded.',
            embeds: [embed],
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: `Error casting vote: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handlePropose(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager
) {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const executionData = interaction.options.getString('execution_data') || '';

    try {
        const proposal = await governanceManager.createProposal(
            interaction.user.id,
            title,
            description,
            executionData
        );

        const embed = new MessageEmbed()
            .setTitle('Proposal Created')
            .setColor('#0099ff')
            .addField('ID', proposal.id.toString())
            .addField('Title', proposal.title)
            .addField('Description', proposal.description)
            .addField('Voting Period', `Ends <t:${Math.floor(proposal.endTime / 1000)}:R>`)
            .addField('Minimum Quorum', proposal.minimumQuorum.toString());

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({
            content: `Error creating proposal: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleVote(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager
) {
    const proposalId = interaction.options.getInteger('proposal_id', true);
    const support = interaction.options.getBoolean('support', true);

    try {
        await governanceManager.castVote(
            interaction.user.id,
            proposalId,
            support
        );

        const proposal = governanceManager.getProposal(proposalId);
        const embed = new MessageEmbed()
            .setTitle('Vote Cast')
            .setColor('#0099ff')
            .addField('Proposal', proposal.title)
            .addField('Vote', support ? 'For' : 'Against')
            .addField('Current Votes For', proposal.votesFor.toString())
            .addField('Current Votes Against', proposal.votesAgainst.toString());

        await interaction.reply({
            content: 'Your vote has been recorded.',
            embeds: [embed],
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: `Error casting vote: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleList(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager
) {
    const activeProposals = governanceManager.getActiveProposals();

    if (activeProposals.length === 0) {
        await interaction.reply({
            content: 'No active proposals.',
            ephemeral: true
        });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle('Active Proposals')
        .setColor('#0099ff');

    activeProposals.forEach(proposal => {
        embed.addField(
            `#${proposal.id}: ${proposal.title}`,
            `Votes: ${proposal.votesFor} For / ${proposal.votesAgainst} Against\n` +
            `Ends <t:${Math.floor(proposal.endTime / 1000)}:R>`
        );
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleView(
    interaction: CommandInteraction,
    governanceManager: GovernanceManager
) {
    const proposalId = interaction.options.getInteger('proposal_id', true);
    const proposal = governanceManager.getProposal(proposalId);

    if (!proposal) {
        await interaction.reply({
            content: 'Proposal not found.',
            ephemeral: true
        });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle(`Proposal #${proposal.id}: ${proposal.title}`)
        .setColor('#0099ff')
        .setDescription(proposal.description)
        .addField('Status', proposal.status)
        .addField('Proposer', proposal.proposer)
        .addField('Votes For', proposal.votesFor.toString())
        .addField('Votes Against', proposal.votesAgainst.toString())
        .addField('Minimum Quorum', proposal.minimumQuorum.toString())
        .addField('Created', `<t:${Math.floor(proposal.startTime / 1000)}:R>`)
        .addField('Ends', `<t:${Math.floor(proposal.endTime / 1000)}:R>`);

    await interaction.reply({ embeds: [embed] });
} 