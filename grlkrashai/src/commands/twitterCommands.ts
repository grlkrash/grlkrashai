import { TwitterAutoMode } from '../services/TwitterAutoMode';
import { TwitterService } from '../services/TwitterService';
import { CommandResult } from '../types/commands';

interface CommandResponse {
    success: boolean;
    message: string;
    data?: any;
}

export class TwitterCommands {
    private autoMode: TwitterAutoMode;
    private twitterService: TwitterService;

    constructor() {
        this.autoMode = TwitterAutoMode.getInstance();
        this.twitterService = TwitterService.getInstance();
    }

    public async handleCommand(command: string, args: string[]): Promise<CommandResult> {
        try {
            const response = await this.twitterService.executeCommand(command, args);
            return {
                status: {
                    message: response
                }
            };
        } catch (error) {
            return {
                status: {
                    message: error instanceof Error ? error.message : 'Unknown error occurred',
                    error: 'Command execution failed'
                }
            };
        }
    }

    private async startAutoMode(args: string[]): Promise<CommandResponse> {
        try {
            if (args.length === 0) {
                return {
                    success: false,
                    message: 'Please provide at least one target account. Usage: start @account1 @account2'
                };
            }

            const config = {
                enabled: true,
                targetAccounts: args.map(arg => arg.replace('@', '')),
                lastRun: new Date()
            };

            this.autoMode.updateConfig(config);
            
            return {
                success: true,
                message: `Auto mode started for accounts: ${args.join(', ')}`,
                data: this.autoMode.getConfig()
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to start auto mode: ${error.message}`
            };
        }
    }

    private async stopAutoMode(): Promise<CommandResponse> {
        try {
            this.autoMode.updateConfig({ enabled: false });
            return {
                success: true,
                message: 'Auto mode stopped successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to stop auto mode: ${error.message}`
            };
        }
    }

    private async getStatus(): Promise<CommandResponse> {
        const config = this.autoMode.getConfig();
        return {
            success: true,
            message: 'Current auto mode status:',
            data: {
                enabled: config.enabled,
                targetAccounts: config.targetAccounts,
                campaignTypes: config.campaignTypes,
                postFrequency: config.postFrequency,
                lastRun: config.lastRun
            }
        };
    }

    private async addTargetAccount(args: string[]): Promise<CommandResponse> {
        if (args.length === 0) {
            return {
                success: false,
                message: 'Please provide a target account. Usage: add-target @account'
            };
        }

        const config = this.autoMode.getConfig();
        const newAccount = args[0].replace('@', '');
        
        if (config.targetAccounts.includes(newAccount)) {
            return {
                success: false,
                message: `Account @${newAccount} is already a target`
            };
        }

        this.autoMode.updateConfig({
            targetAccounts: [...config.targetAccounts, newAccount]
        });

        return {
            success: true,
            message: `Added @${newAccount} to target accounts`,
            data: { targetAccounts: this.autoMode.getConfig().targetAccounts }
        };
    }

    private async removeTargetAccount(args: string[]): Promise<CommandResponse> {
        if (args.length === 0) {
            return {
                success: false,
                message: 'Please provide a target account. Usage: remove-target @account'
            };
        }

        const config = this.autoMode.getConfig();
        const account = args[0].replace('@', '');
        
        if (!config.targetAccounts.includes(account)) {
            return {
                success: false,
                message: `Account @${account} is not a target`
            };
        }

        this.autoMode.updateConfig({
            targetAccounts: config.targetAccounts.filter(a => a !== account)
        });

        return {
            success: true,
            message: `Removed @${account} from target accounts`,
            data: { targetAccounts: this.autoMode.getConfig().targetAccounts }
        };
    }

    private async setPostFrequency(args: string[]): Promise<CommandResponse> {
        if (args.length === 0 || isNaN(Number(args[0]))) {
            return {
                success: false,
                message: 'Please provide a valid frequency in minutes. Usage: set-frequency 30'
            };
        }

        const frequency = Number(args[0]);
        if (frequency < 15 || frequency > 120) {
            return {
                success: false,
                message: 'Frequency must be between 15 and 120 minutes'
            };
        }

        this.autoMode.updateConfig({ postFrequency: frequency });

        return {
            success: true,
            message: `Post frequency updated to ${frequency} minutes`,
            data: { postFrequency: frequency }
        };
    }

    private async setCampaignTypes(args: string[]): Promise<CommandResponse> {
        if (args.length === 0) {
            return {
                success: false,
                message: 'Please provide campaign types. Usage: set-campaigns engagement growth community'
            };
        }

        const validTypes = ['engagement', 'growth', 'community'];
        const invalidTypes = args.filter(type => !validTypes.includes(type));
        
        if (invalidTypes.length > 0) {
            return {
                success: false,
                message: `Invalid campaign types: ${invalidTypes.join(', ')}. Valid types are: ${validTypes.join(', ')}`
            };
        }

        this.autoMode.updateConfig({
            campaignTypes: args as ('engagement' | 'growth' | 'community')[]
        });

        return {
            success: true,
            message: `Campaign types updated to: ${args.join(', ')}`,
            data: { campaignTypes: args }
        };
    }

    getHelpText(): string {
        return `
Available Twitter Commands:
- AUTO START @account - Start auto mode for target account
- AUTO STOP - Stop auto mode
- AUTO STATUS - Check current auto mode status
- AUTO FREQUENCY minutes - Set post frequency (15-120 min)
- AUTO CAMPAIGNS type1 type2 - Set campaign types (engagement/growth/community)
- HELP - Show this help message
        `.trim();
    }
}

export const registerTwitterCommands = (twitterService: TwitterService) => ({
    auto: {
        description: 'Manage auto mode for Twitter interactions',
        subcommands: {
            start: {
                description: 'Start auto mode for a target account',
                usage: 'auto start @username',
                handler: async (args: string[]) => {
                    if (args.length === 0) {
                        return 'Please specify a target account (e.g., AUTO START @username)';
                    }
                    return await twitterService.executeCommand('auto', ['start', args[0]]);
                }
            },
            stop: {
                description: 'Stop auto mode',
                usage: 'auto stop',
                handler: async () => {
                    return await twitterService.executeCommand('auto', ['stop']);
                }
            },
            status: {
                description: 'Check current auto mode status',
                usage: 'auto status',
                handler: async () => {
                    return await twitterService.executeCommand('auto', ['status']);
                }
            },
            report: {
                description: 'Get analytics report (basic metrics only)',
                usage: 'auto report',
                handler: async () => {
                    return await twitterService.executeCommand('auto', ['report']);
                }
            },
            frequency: {
                description: 'Set post frequency (15-120 minutes)',
                usage: 'auto frequency <minutes>',
                handler: async (args: string[]) => {
                    if (args.length === 0) {
                        return 'Please specify frequency in minutes (15-120)';
                    }
                    return await twitterService.executeCommand('auto', ['frequency', args[0]]);
                }
            },
            campaigns: {
                description: 'Set campaign types (engagement, growth, community)',
                usage: 'auto campaigns <type1> [type2] [type3]',
                handler: async (args: string[]) => {
                    if (args.length === 0) {
                        return 'Please specify campaign types (engagement, growth, community)';
                    }
                    return await twitterService.executeCommand('auto', ['campaigns', ...args]);
                }
            },
            help: {
                description: 'Show help for auto mode commands',
                usage: 'auto help',
                handler: async () => {
                    return await twitterService.executeCommand('auto', ['help']);
                }
            }
        }
    }
});

export const twitterCommands: Command[] = [
    {
        name: 'auto',
        description: 'Auto mode commands for Twitter',
        subcommands: [
            {
                name: 'start',
                description: 'Start auto mode for a target account',
                args: ['@username'],
                example: 'auto start @grlkrash'
            },
            {
                name: 'stop',
                description: 'Stop auto mode',
                example: 'auto stop'
            },
            {
                name: 'status',
                description: 'Check current auto mode status',
                example: 'auto status'
            },
            {
                name: 'report',
                description: 'Get detailed analytics report',
                example: 'auto report'
            },
            {
                name: 'frequency',
                description: 'Set post frequency (15-120 minutes)',
                args: ['minutes'],
                example: 'auto frequency 30'
            },
            {
                name: 'campaigns',
                description: 'Set campaign types (engagement/growth/community)',
                args: ['type1', 'type2?', 'type3?'],
                example: 'auto campaigns engagement growth'
            }
        ]
    },
    {
        name: 'tweet',
        description: 'Post a tweet',
        args: ['message'],
        example: 'tweet Hello world!'
    },
    {
        name: 'reply',
        description: 'Reply to a tweet',
        args: ['tweet_id', 'message'],
        example: 'reply 123456789 Thanks for sharing!'
    },
    {
        name: 'verify',
        description: 'Verify Twitter account',
        example: 'verify'
    }
]; 