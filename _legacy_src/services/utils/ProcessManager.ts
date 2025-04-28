import { ChildProcess, spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class ProcessManager {
    private static instance: ProcessManager;
    private readonly MAX_RESTARTS = 3;
    private readonly RESTART_WINDOW = 60000;
    private restarts: number[] = [];
    private currentProcess?: ChildProcess;

    static getInstance(): ProcessManager {
        if (!ProcessManager.instance) {
            ProcessManager.instance = new ProcessManager();
        }
        return ProcessManager.instance;
    }

    async safeStart(command: string[], env: Record<string, string> = {}): Promise<void> {
        this.cleanOldRestarts();
        if (this.isRestartLimitExceeded()) {
            throw new Error('Service unstable - max restarts exceeded');
        }

        await this.killExistingProcesses();
        
        this.currentProcess = spawn(command[0], command.slice(1), {
            stdio: 'inherit',
            env: { ...process.env, ...env },
            detached: true
        });
        
        this.restarts.push(Date.now());
        this.watchProcess(this.currentProcess);
    }

    private async killExistingProcesses(): Promise<void> {
        try {
            await execAsync('pkill -f "node.*server.ts"');
        } catch (error) {
            // Ignore errors if no processes found
        }
    }

    private cleanOldRestarts(): void {
        const now = Date.now();
        this.restarts = this.restarts.filter(time => now - time < this.RESTART_WINDOW);
    }

    private isRestartLimitExceeded(): boolean {
        return this.restarts.length >= this.MAX_RESTARTS;
    }

    private watchProcess(proc: ChildProcess): void {
        proc.once('exit', (code, signal) => {
            if (code !== 0 && signal !== 'SIGTERM') {
                this.handleUnexpectedExit(proc);
            }
        });

        process.once('SIGINT', () => this.gracefulShutdown());
        process.once('SIGTERM', () => this.gracefulShutdown());
    }

    private async handleUnexpectedExit(proc: ChildProcess): Promise<void> {
        try {
            await this.safeStart([proc.spawnargs[0], ...proc.spawnargs.slice(1)], proc.env as Record<string, string>);
        } catch (error) {
            console.error('Failed to restart process:', error);
            process.exit(1);
        }
    }

    private async gracefulShutdown(timeout: number = 5000): Promise<void> {
        if (!this.currentProcess) return;

        const killTimeout = setTimeout(() => {
            this.currentProcess?.kill('SIGKILL');
        }, timeout);

        try {
            this.currentProcess.kill('SIGTERM');
            await new Promise<void>(resolve => this.currentProcess?.once('exit', resolve));
        } finally {
            clearTimeout(killTimeout);
            process.exit(0);
        }
    }
} 