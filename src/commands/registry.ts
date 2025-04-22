import { WalletService } from '../services/WalletService';
import { TwitterOAuthService } from '../services/TwitterOAuthService';
import { UserVerificationService } from '../services/UserVerificationService';
import { SoundEffects, SoundAction } from '../utils/soundEffects';
import { CommandContext, CommandResult, CommandHandler } from '../types/commands';
import { basicTwitterCommands, advancedTwitterCommands } from './advancedTwitterCommands';
import { TwitterService } from '../services/TwitterService';
import { TwitterCommands } from './twitterCommands';

export class CommandRegistry {
    private commands: Map<string, (context: CommandContext, ...args: string[]) => Promise<CommandResult>>;
    private walletService: WalletService;
    private twitterOAuth: TwitterOAuthService;
    private userVerification: UserVerificationService;
    private soundEffects: SoundEffects;
    private messageCallback: (message: string) => Promise<void>;
    private twitterService: TwitterService;
    private twitterCommands: TwitterCommands;

    constructor(walletService: WalletService, messageCallback: (message: string) => Promise<void>) {
        this.commands = new Map();
        this.walletService = walletService;
        this.messageCallback = messageCallback;
        this.twitterOAuth = TwitterOAuthService.getInstance();
        this.userVerification = UserVerificationService.getInstance();
        this.soundEffects = SoundEffects.getInstance();
        this.twitterService = TwitterService.getInstance();
        this.twitterCommands = new TwitterCommands();
        this.registerCommands();
    }

    private async updateMessage(message: string): Promise<void> {
        if (this.messageCallback) {
            await this.messageCallback(message);
        } else {
            console.error('[DEBUG] Message callback not initialized');
        }
    }

    private registerCommands(): void {
        // Register basic Twitter commands
        Object.entries(basicTwitterCommands).forEach(([name, handler]) => {
            this.commands.set(name, handler);
        });

        // Register advanced Twitter commands
        Object.entries(advancedTwitterCommands).forEach(([name, handler]) => {
            this.commands.set(name, handler);
        });

        // Backup email command
        this.commands.set('backup', async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
            if (!context.isWalletConnected) {
                return {
                    status: {
                        message: "⚠️ SECURE CHANNEL REQUIRED\n\n" +
                                "Please connect your wallet first to establish a secure connection."
                    }
                };
            }

            if (args[0] !== 'email' || !args[1]) {
                return {
                    status: {
                        message: "⚠️ MISSING BACKUP FREQUENCY\n\n" +
                                "Please provide your backup email address:\n" +
                                "Use: backup email <address>"
                    }
                };
            }

            const email = args[1];
            const result = await this.userVerification.addBackupEmail(context.userAddress, email);
            return {
                status: { message: result.message },
                error: result.error
            };
        });

        // Email recovery command
        this.commands.set('recover', async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
            if (!context.isWalletConnected) {
                return {
                    status: {
                        message: "⚠️ SECURE CHANNEL REQUIRED\n\n" +
                                "Please connect your wallet first to establish a secure connection."
                    }
                };
            }

            if (args[0] !== 'email') {
                return {
                    status: {
                        message: "⚠️ INVALID RECOVERY METHOD\n\n" +
                                "Please specify 'email' as the recovery method:\n" +
                                "Use: recover email"
                    }
                };
            }

            const result = await this.userVerification.startEmailRecovery(context.userAddress);
            return {
                status: { message: result.message },
                error: result.error
            };
        });

        // Auto mode commands
        this.commands.set('auto', async (context: CommandContext, ...args: string[]): Promise<CommandResult> => {
            if (!context.isTwitterVerified) {
                return {
                    status: {
                        message: "⚠️ VERIFICATION REQUIRED\n\nPlease verify your Twitter account first."
                    }
                };
            }

            if (args.length === 0) {
                return {
                    status: {
                        message: "Please specify an auto mode command. Use 'AUTO HELP' for available commands."
                    }
                };
            }

            const [subCommand, ...subArgs] = args;
            try {
                const result = await this.twitterService.executeCommand(subCommand.toLowerCase(), subArgs);
                return {
                    status: {
                        message: result
                    }
                };
            } catch (error) {
                return {
                    status: {
                        message: error instanceof Error ? error.message : 'Unknown error occurred'
                    }
                };
            }
        });

        // Help command to show available commands
        this.commands.set('help', async (): Promise<CommandResult> => {
            return {
                status: {
                    message: `*adjusts resistance radio* Available commands:
                    
BASIC OPERATIONS:
- CLEAR - Clear the terminal screen
- HELP - Show this help message

AUTO MODE COMMANDS:
- AUTO START @account - Start auto mode for target account
- AUTO STOP - Stop auto mode
- AUTO STATUS - Check current auto mode status
- AUTO FREQUENCY minutes - Set post frequency (15-120 min)
- AUTO CAMPAIGNS type1 type2 - Set campaign types (engagement/growth/community)`
                }
            };
        });

        this.commands.set('clear', async (): Promise<CommandResult> => {
            return {
                status: {
                    message: '\x1Bc'
                }
            };
        });
    }

    public async executeCommand(command: string, context: CommandContext): Promise<CommandResult> {
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        const handler = this.commands.get(cmd);
        if (!handler) {
            return {
                status: {
                    message: "Command not recognized. Type 'HELP' for available commands."
                }
            };
        }

        try {
            return await handler(context, ...args);
        } catch (error) {
            return {
                status: {
                    message: error instanceof Error ? error.message : 'Unknown error occurred'
                }
            };
        }
    }

    public registerCommand(command: string, handler: (context: CommandContext, ...args: string[]) => Promise<CommandResult>) {
        this.commands.set(command.toLowerCase(), handler);
    }

    public addAlias(alias: string, command: string) {
        const handler = this.commands.get(command.toLowerCase());
        if (handler) {
            this.commands.set(alias.toLowerCase(), handler);
        }
    }
} 