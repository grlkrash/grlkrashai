import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';
import { join } from 'path';

interface LogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    service: string;
    message: string;
    metadata?: any;
}

interface ErrorRecoveryStrategy {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs: number;
    timeout: number;
    messages?: {
        retry: string;
        failure: string;
    };
}

export class LoggingService extends EventEmitter {
    private runtime: IAgentRuntime;
    private logPath: string;
    private errorStrategies: Map<string, ErrorRecoveryStrategy>;
    private retryCounters: Map<string, number>;
    private readonly DEFAULT_STRATEGY: ErrorRecoveryStrategy = {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        timeout: 60000
    };

    constructor(runtime: IAgentRuntime, logPath: string) {
        super();
        this.runtime = runtime;
        this.logPath = logPath;
        this.errorStrategies = new Map();
        this.retryCounters = new Map();
        this.initializeErrorStrategies();
    }

    private initializeErrorStrategies(): void {
        // Platform-specific strategies
        this.errorStrategies.set('youtube', {
            maxRetries: 5,
            backoffMs: 2000,
            maxBackoffMs: 60000,
            timeout: 120000,
            messages: {
                retry: "🔄 Resistance broadcast interference detected. Recalibrating transmission signal...",
                failure: "⚠️ Broadcast node compromised. Switching to backup frequencies..."
            }
        });

        this.errorStrategies.set('ipfs', {
            maxRetries: 4,
            backoffMs: 3000,
            maxBackoffMs: 45000,
            timeout: 90000,
            messages: {
                retry: "💎 Crystal data fragmentation detected. Realigning storage matrix...",
                failure: "⚠️ Crystal storage network disrupted. Activating backup nodes..."
            }
        });

        // Service-specific strategies
        this.errorStrategies.set('contentRepurposing', {
            maxRetries: 3,
            backoffMs: 5000,
            maxBackoffMs: 30000,
            timeout: 180000,
            messages: {
                retry: "🌟 Crystal resonance mismatch. Adjusting frequency patterns...",
                failure: "⚠️ Energy pattern transformation failed. Reverting to base configuration..."
            }
        });

        this.errorStrategies.set('campaignScheduling', {
            maxRetries: 2,
            backoffMs: 1000,
            maxBackoffMs: 15000,
            timeout: 30000,
            messages: {
                retry: "⚡ Resistance operation timing distortion. Recalculating mission parameters...",
                failure: "⚠️ Mission schedule compromised. Initiating contingency protocols..."
            }
        });
    }

    async log(entry: LogEntry): Promise<void> {
        const logFile = join(this.logPath, `${entry.service}.log`);
        const formattedEntry = this.formatLogEntry(entry);

        try {
            await this.runtime.fs.appendFile(logFile, formattedEntry + '\n');
            this.emit('logged', entry);

            if (entry.level === 'error') {
                await this.handleError(entry);
            }
        } catch (error) {
            console.error('Failed to write log:', error);
            // Fallback to console
            console.log(formattedEntry);
        }
    }

    private formatLogEntry(entry: LogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const levelEmoji = {
            info: "💫",
            warn: "⚡",
            error: "🚨",
            debug: "🔮"
        }[entry.level];

        return JSON.stringify({
            ...entry,
            message: `${levelEmoji} [${entry.service.toUpperCase()}] >> ${entry.message}`,
            timestamp
        });
    }

    async handleError(entry: LogEntry): Promise<void> {
        const strategy = this.errorStrategies.get(entry.service) || this.DEFAULT_STRATEGY;
        const retryKey = `${entry.service}_${JSON.stringify(entry.metadata)}`;
        const retryCount = this.retryCounters.get(retryKey) || 0;

        if (retryCount < strategy.maxRetries) {
            const backoff = Math.min(
                strategy.backoffMs * Math.pow(2, retryCount),
                strategy.maxBackoffMs
            );

            this.retryCounters.set(retryKey, retryCount + 1);

            // Use themed retry message
            const retryMessage = strategy.messages?.retry || 
                "🔄 Energy pattern disruption detected. Attempting signal realignment...";

            setTimeout(async () => {
                try {
                    await this.retryOperation(entry);
                    this.retryCounters.delete(retryKey);
                } catch (error) {
                    await this.log({
                        timestamp: new Date(),
                        level: 'error',
                        service: entry.service,
                        message: `${strategy.messages?.failure || "⚠️ Crystal matrix stabilization failed"}: ${error.message}`,
                        metadata: { originalError: entry.metadata, retryCount: retryCount + 1 }
                    });
                }
            }, backoff);
        } else {
            this.retryCounters.delete(retryKey);
            this.emit('maxRetriesExceeded', {
                ...entry,
                message: "🚨 CRITICAL NETWORK DISRUPTION >> Maximum retry attempts exceeded. Resistance support intervention required."
            });
        }
    }

    private async retryOperation(entry: LogEntry): Promise<void> {
        if (!entry.metadata?.operation) return;

        const { operation, params } = entry.metadata;
        
        switch (operation) {
            case 'uploadToYoutube':
                await this.retryYoutubeUpload(params);
                break;
            case 'ipfsUpload':
                await this.retryIpfsUpload(params);
                break;
            case 'contentRepurposing':
                await this.retryContentRepurposing(params);
                break;
            case 'campaignScheduling':
                await this.retryCampaignScheduling(params);
                break;
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    private async retryYoutubeUpload(params: any): Promise<void> {
        // Implement YouTube upload retry logic
    }

    private async retryIpfsUpload(params: any): Promise<void> {
        // Implement IPFS upload retry logic
    }

    private async retryContentRepurposing(params: any): Promise<void> {
        // Implement content repurposing retry logic
    }

    private async retryCampaignScheduling(params: any): Promise<void> {
        // Implement campaign scheduling retry logic
    }

    async getErrorStats(service: string): Promise<{
        totalErrors: number;
        recoveredErrors: number;
        failedRecoveries: number;
    }> {
        const logFile = join(this.logPath, `${service}.log`);
        try {
            const content = await this.runtime.fs.readFile(logFile, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            const entries = lines.map(line => JSON.parse(line));

            return {
                totalErrors: entries.filter(e => e.level === 'error').length,
                recoveredErrors: entries.filter(e => e.message.includes('recovered')).length,
                failedRecoveries: entries.filter(e => e.message.includes('max retries')).length
            };
        } catch (error) {
            return { totalErrors: 0, recoveredErrors: 0, failedRecoveries: 0 };
        }
    }

    async cleanup(): Promise<void> {
        this.errorStrategies.clear();
        this.retryCounters.clear();
        this.removeAllListeners();
    }
} 
