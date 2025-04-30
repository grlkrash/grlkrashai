import { spawn } from 'child_process';
import path from 'path';
import { ScriptMonitor } from './monitor';

interface RunOptions {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    timeout?: number;
    retries?: number;
}

export async function runScript(
    scriptPath: string,
    options: RunOptions = {}
): Promise<void> {
    const {
        env = process.env,
        cwd = process.cwd(),
        timeout = 30 * 60 * 1000, // 30 minutes
        retries = 3
    } = options;

    const scriptName = path.basename(scriptPath);
    const monitor = new ScriptMonitor(scriptName);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await new Promise<void>((resolve, reject) => {
                const child = spawn('node', [scriptPath], {
                    env: { ...env, FORCE_COLOR: '1' },
                    cwd,
                    stdio: 'inherit'
                });

                const timer = setTimeout(() => {
                    child.kill();
                    reject(new Error(`Script timed out after ${timeout}ms`));
                }, timeout);

                child.on('error', (error) => {
                    clearTimeout(timer);
                    reject(error);
                });

                child.on('exit', (code) => {
                    clearTimeout(timer);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Script exited with code ${code}`));
                    }
                });
            });

            monitor.complete();
            return;
        } catch (error: any) {
            if (attempt === retries) {
                monitor.fail(error);
                throw error;
            }
            console.error(`Attempt ${attempt} failed:`, error.message);
            await new Promise(r => setTimeout(r, attempt * 1000));
        }
    }
}

export async function runScriptSequence(
    scripts: string[],
    options: RunOptions = {}
): Promise<void> {
    for (const script of scripts) {
        await runScript(script, options);
    }
}

export async function runScriptsConcurrently(
    scripts: string[],
    options: RunOptions = {}
): Promise<void> {
    await Promise.all(
        scripts.map(script => runScript(script, options))
    );
}

// Cleanup old status files periodically
setInterval(() => {
    ScriptMonitor.cleanup();
}, 60 * 60 * 1000); // Every hour 