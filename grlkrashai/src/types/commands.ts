import { TwitterAuthService } from '../services/TwitterAuthService';
import { TwitterOAuthService } from '../services/TwitterOAuthService';
import { SoundEffects } from '../utils/soundEffects';

export interface CommandStatus {
    message: string;
    error?: string;
}

export interface CommandResult {
    status: CommandStatus;
    error?: string;
}

// Add a helper function to create command results
export function createCommandResult(message: string, error?: string, verified?: boolean): CommandResult {
    return {
        status: { message },
        ...(error && { error }),
        ...(verified && { verified })
    };
}

export interface CommandContext {
    userAddress: string;
    isWalletConnected: boolean;
    isTwitterVerified: boolean;
    twitterUsername?: string;
    twitterAuth: TwitterAuthService;
    soundEffects: SoundEffects;
    updateMessage: (message: string) => Promise<void>;
}

export type CommandHandler = (context: CommandContext, ...args: string[]) => Promise<CommandResult>; 