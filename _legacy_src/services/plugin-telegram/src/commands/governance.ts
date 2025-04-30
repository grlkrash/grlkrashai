import { Context } from 'telegraf';
import { GovernanceManager } from '../../../governance/GovernanceManager';
import { TokenContract } from '../../../types/contracts';
import { NLPService } from '../../../services/nlp/NLPService';

const MINIMUM_PROPOSAL_TOKENS = 1000;
const MINIMUM_VOTING_TOKENS = 100;

export function setupGovernanceCommands(
    bot: any,
    governanceManager: GovernanceManager,
    tokenContract: TokenContract,
    nlpService: NLPService
) {
    // Natural language proposal command
    bot.command('propose_natural', async (ctx: Context) => {
        const balance = await tokenContract.balanceOf(ctx.from.id.toString());
        if (balance < MINIMUM_PROPOSAL_TOKENS) {
            await ctx.reply(
                `You need at least ${MINIMUM_PROPOSAL_TOKENS} MORE tokens to create proposals. Current balance: ${balance}`
            );
            return;
        }

        const text = ctx.message.text.replace('/propose_natural', '').trim();
        if (!text) {
            await ctx.reply(
                'Usage: /propose_natural Your proposal in natural language'
            );
            return;
        }

        try {
            const { title, description, executionData } = await nlpService.parseProposal(text);
            
            const proposal = await governanceManager.createProposal(
                ctx.from.id.toString(),
                title,
                description,
                executionData
            );

            const message = [
                '*Proposal Created from Natural Language*',
                '',
                `ID: ${proposal.id}`,
                `Interpreted Title: ${title}`,
                `Interpreted Description: ${description}`,
                `Voting Period Ends: ${new Date(proposal.endTime).toLocaleString()}`,
                `Minimum Quorum: ${proposal.minimumQuorum}`
            ].join('\n');

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`Error creating proposal: ${error.message}`);
        }
    });

    // Natural language vote command
    bot.command('vote_natural', async (ctx: Context) => {
        const balance = await tokenContract.balanceOf(ctx.from.id.toString());
        if (balance < MINIMUM_VOTING_TOKENS) {
            await ctx.reply(
                `You need at least ${MINIMUM_VOTING_TOKENS} MORE tokens to vote. Current balance: ${balance}`
            );
            return;
        }

        const text = ctx.message.text.replace('/vote_natural', '').trim();
        if (!text) {
            await ctx.reply(
                'Usage: /vote_natural Your vote in natural language (include proposal number)'
            );
            return;
        }

        try {
            const { proposalId, support } = await nlpService.parseVote(text);
            
            await governanceManager.castVote(
                ctx.from.id.toString(),
                proposalId,
                support
            );

            const proposal = governanceManager.getProposal(proposalId);
            const message = [
                '*Vote Cast from Natural Language*',
                '',
                `Proposal: ${proposal.title}`,
                `Interpreted Vote: ${support ? 'For' : 'Against'}`,
                `Current Votes For: ${proposal.votesFor}`,
                `Current Votes Against: ${proposal.votesAgainst}`
            ].join('\n');

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`Error casting vote: ${error.message}`);
        }
    });

    // Original structured commands with token requirements
    bot.command('propose', async (ctx: Context) => {
        const balance = await tokenContract.balanceOf(ctx.from.id.toString());
        if (balance < MINIMUM_PROPOSAL_TOKENS) {
            await ctx.reply(
                `You need at least ${MINIMUM_PROPOSAL_TOKENS} MORE tokens to create proposals. Current balance: ${balance}`
            );
            return;
        }

        const args = ctx.message.text.split('\n');
        if (args.length < 3) {
            await ctx.reply(
                'Usage:\n/propose\nTitle\nDescription\n[Execution Data]'
            );
            return;
        }

        const title = args[1];
        const description = args[2];
        const executionData = args[3] || '';

        try {
            const proposal = await governanceManager.createProposal(
                ctx.from.id.toString(),
                title,
                description,
                executionData
            );

            const message = [
                '*Proposal Created*',
                '',
                `ID: ${proposal.id}`,
                `Title: ${proposal.title}`,
                `Description: ${proposal.description}`,
                `Voting Period Ends: ${new Date(proposal.endTime).toLocaleString()}`,
                `Minimum Quorum: ${proposal.minimumQuorum}`
            ].join('\n');

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`Error creating proposal: ${error.message}`);
        }
    });

    bot.command('vote', async (ctx: Context) => {
        const balance = await tokenContract.balanceOf(ctx.from.id.toString());
        if (balance < MINIMUM_VOTING_TOKENS) {
            await ctx.reply(
                `You need at least ${MINIMUM_VOTING_TOKENS} MORE tokens to vote. Current balance: ${balance}`
            );
            return;
        }

        const args = ctx.message.text.split(' ');
        if (args.length !== 3) {
            await ctx.reply(
                'Usage: /vote <proposal_id> <yes/no>'
            );
            return;
        }

        const proposalId = parseInt(args[1]);
        const support = args[2].toLowerCase() === 'yes';

        try {
            await governanceManager.castVote(
                ctx.from.id.toString(),
                proposalId,
                support
            );

            const proposal = governanceManager.getProposal(proposalId);
            const message = [
                '*Vote Cast*',
                '',
                `Proposal: ${proposal.title}`,
                `Vote: ${support ? 'For' : 'Against'}`,
                `Current Votes For: ${proposal.votesFor}`,
                `Current Votes Against: ${proposal.votesAgainst}`
            ].join('\n');

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`Error casting vote: ${error.message}`);
        }
    });

    bot.command('proposals', async (ctx: Context) => {
        const activeProposals = governanceManager.getActiveProposals();

        if (activeProposals.length === 0) {
            await ctx.reply('No active proposals.');
            return;
        }

        const message = [
            '*Active Proposals*',
            '',
            ...activeProposals.map(proposal => [
                `#${proposal.id}: ${proposal.title}`,
                `Votes: ${proposal.votesFor} For / ${proposal.votesAgainst} Against`,
                `Ends: ${new Date(proposal.endTime).toLocaleString()}`,
                ''
            ].join('\n'))
        ].join('\n');

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    bot.command('proposal', async (ctx: Context) => {
        const args = ctx.message.text.split(' ');
        if (args.length !== 2) {
            await ctx.reply('Usage: /proposal <proposal_id>');
            return;
        }

        const proposalId = parseInt(args[1]);
        const proposal = governanceManager.getProposal(proposalId);

        if (!proposal) {
            await ctx.reply('Proposal not found.');
            return;
        }

        const message = [
            `*Proposal #${proposal.id}: ${proposal.title}*`,
            '',
            proposal.description,
            '',
            `Status: ${proposal.status}`,
            `Proposer: ${proposal.proposer}`,
            `Votes For: ${proposal.votesFor}`,
            `Votes Against: ${proposal.votesAgainst}`,
            `Minimum Quorum: ${proposal.minimumQuorum}`,
            `Created: ${new Date(proposal.startTime).toLocaleString()}`,
            `Ends: ${new Date(proposal.endTime).toLocaleString()}`
        ].join('\n');

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });
} 